#!/usr/bin/env node
/* ==========================================================================
   Seeds the LOCAL Supabase stack with a realistic operating picture so every
   portal screen can be looked at, measured and screenshotted with real data
   in it — including the awkward cases: a 120-character company name, a street
   address that will not fit on a phone, a standing detail with two dozen
   shifts, an emergency lead, an overdue invoice with a failed card attempt.

     supabase start -x vector          # from the repository root
     pnpm demo:seed                     # from app/

   What it does, in order:
     1. Reads `supabase status -o env` and writes app/.env.local (the portal's
        local env). Keys the file already holds are kept; the Supabase and
        APP_URL keys are overwritten. Refuses if the existing file points at a
        non-localhost Supabase — that file belongs to someone's real setup.
     2. Refuses to go on unless SUPABASE_URL and the database URL are local.
     3. Deletes the demo auth users, then wipes every operational table and
        restarts the number sequences, so Q-/J-/FPS- numbers are identical on
        every run and before/after screenshots compare like for like.
     4. Creates the owner (password + a verified TOTP factor, enrolled through
        the owner's own session exactly as /portal/security does), a client
        user scoped to one client, and an officer user.
     5. Inserts the operating data with the service role, then makes a handful
        of changes AS THE OWNER at aal2, so the audit trail and Activity show
        "Cameron Harrell" rather than only "system".
     6. Writes app/.demo/{owner,client,officer,ids}.json for the capture.

   Idempotent: run it as often as you like. Data is relative to today in
   America/Chicago (the portal's TZ), so "today" and "next 7 days" are always
   populated.

   WHY supabase-js AND pg. Rows go in through @supabase/supabase-js so they
   pass the same constraints, triggers and PostgREST grants the portal's own
   writes do, and database functions mint every number. `pg` is used only for
   the wipe: audit_log is append-only (no DELETE or TRUNCATE for service_role,
   20260910000009) and sequences cannot be restarted over PostgREST, so those
   two need the table owner on the local database URL.

   WHY source_env = 'production'. The Leads and Candidates inboxes, the
   dashboard and the nav badges show production rows only by default
   (SPEC-002, app/src/lib/domain/queries.ts). Seeded rows are production-shaped
   so they appear where a real lead would; one lead and one candidate are
   stamped 'preview' to exercise the "Include preview & local" switch.
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { APP_DIR, assertLocalUrl, demoDir, envFilePath, isLocalUrl, readEnvFile, totp, waitForFreshStep } from './demo-lib.mjs';
import { tiers } from '../shared/src/data/estimator.mjs';
import { armedPreferences } from '../shared/src/data/intake.mjs';

const REPO = join(APP_DIR, '..');
const DEMO_DOMAIN = 'demo.fps.local';
const APP_URL = process.env.APP_URL || 'http://localhost:3100';
const TZ = 'America/Chicago';

const log = (msg) => console.log(`seed-demo: ${msg}`);
const die = (msg) => {
    console.error(`seed-demo: ${msg}`);
    process.exit(1);
};

/* ==========================================================================
   1 · Local env
   ========================================================================== */

function supabaseStatus() {
    const candidates = [process.env.SUPABASE_BIN, 'supabase', join(homedir(), '.local', 'bin', 'supabase')].filter(Boolean);
    for (const bin of candidates) {
        try {
            const out = execFileSync(bin, ['status', '-o', 'env'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            const env = {};
            for (const line of out.split('\n')) {
                const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
                if (m) env[m[1]] = m[2];
            }
            if (env.API_URL) return env;
        } catch {
            /* next candidate */
        }
    }
    return null;
}

function writeLocalEnv() {
    const path = envFilePath();
    const existing = readEnvFile(path);
    for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
        if (existing[key] && !isLocalUrl(existing[key])) {
            die(`${path} sets ${key} to a non-local URL. It is somebody's real configuration; move it aside before seeding.`);
        }
    }
    const status = supabaseStatus();
    if (!status) {
        if (existing.SUPABASE_URL) {
            log('supabase status is unavailable; using the existing local env file as-is.');
            return existing;
        }
        die('the local Supabase stack is not running. From the repository root: supabase start -x vector');
    }
    const ours = {
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
        SUPABASE_URL: status.API_URL,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        SUPABASE_DB_URL: status.DB_URL,
        APP_URL
    };
    const kept = Object.entries(existing).filter(([k]) => !(k in ours));
    const body = [
        '# Written by app/scripts/seed-demo.mjs from `supabase status -o env`.',
        '# LOCAL STACK ONLY. These are the Supabase CLI\'s well-known development keys.',
        '# Resend, Twilio and Stripe are deliberately unset: the portal degrades honestly.',
        ...Object.entries(ours).map(([k, v]) => `${k}=${v}`),
        ...(kept.length ? ['', '# Kept from the previous file', ...kept.map(([k, v]) => `${k}=${v}`)] : []),
        ''
    ].join('\n');
    writeFileSync(path, body, { mode: 0o600 });
    log(`wrote ${path}`);
    return { ...existing, ...ours };
}

/* ==========================================================================
   Time, in the portal's timezone
   ========================================================================== */

const chicagoParts = (date) =>
    Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
            .formatToParts(date)
            .map((p) => [p.type, p.value])
    );

const NOW = new Date();
const TODAY = (() => {
    const p = chicagoParts(NOW);
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
})();

/** ISO instant for a Chicago wall-clock time `dayOffset` days from today. */
function at(dayOffset, hh = 0, mm = 0) {
    const wall = Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d + dayOffset, hh, mm);
    const p = chicagoParts(new Date(wall));
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    return new Date(wall - (shown - wall)).toISOString();
}

/** YYYY-MM-DD in Chicago, `dayOffset` days from today. */
const ymd = (dayOffset) => {
    const d = new Date(Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d + dayOffset));
    return d.toISOString().slice(0, 10);
};

/** Day of week (0 = Sunday) of the Chicago date `dayOffset` days from today. */
const weekdayOf = (dayOffset) => new Date(Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d + dayOffset)).getUTCDay();

const minutesAgo = (n) => new Date(NOW.getTime() - n * 60000).toISOString();
const hoursAgo = (n) => minutesAgo(n * 60);
const daysAgo = (n, hh = 10, mm = 0) => at(-n, hh, mm);

/* ==========================================================================
   Money, matching app/src/lib/money.ts
   ========================================================================== */

const rate = (level) => Math.round((tiers.find((t) => t.id === level)?.rate ?? 65) * 100);
const lineCents = (officers, hours, rateCents) => Math.sign(rateCents) * Math.floor(Math.abs(officers * hours * rateCents) + 0.5);
const totals = (lines, taxRatePct = 8.25, exempt = false) => {
    const subtotal_cents = Math.max(0, lines.reduce((s, l) => s + l.amount_cents, 0));
    const tax_rate_pct = exempt ? 0 : taxRatePct;
    const tax_cents = Math.floor((subtotal_cents * tax_rate_pct) / 100 + 0.5);
    return { subtotal_cents, tax_rate_pct, tax_cents, total_cents: subtotal_cents + tax_cents };
};
const line = (description, officers, hours, rateCents, shiftId = null) => ({
    description,
    officers,
    hours,
    rate_cents: rateCents,
    amount_cents: lineCents(officers, hours, rateCents),
    ...(shiftId ? { shift_id: shiftId } : {})
});

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const refCode = (prefix) => `${prefix}-${[...randomBytes(6)].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
const hexToken = () => randomBytes(24).toString('hex');

/* ==========================================================================
   Helpers over PostgREST
   ========================================================================== */

function must(result, what) {
    if (result.error) die(`${what}: ${result.error.message}${result.error.details ? ` (${result.error.details})` : ''}`);
    return result.data;
}

/* defaultToNull: false — a multi-row PostgREST insert otherwise sends NULL for
   any column a row omits, which defeats NOT NULL DEFAULT columns
   (reviews.permission_to_publish, payments.currency). */
async function insert(db, table, rows, what = table) {
    const many = Array.isArray(rows);
    const data = must(await db.from(table).insert(many ? rows : [rows], { defaultToNull: false }).select(), `insert ${what}`);
    return many ? data : data[0];
}

/* ==========================================================================
   Main
   ========================================================================== */

const env = writeLocalEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = env.SUPABASE_DB_URL;

try {
    assertLocalUrl(SUPABASE_URL, 'SUPABASE_URL');
    assertLocalUrl(DB_URL, 'SUPABASE_DB_URL');
} catch (err) {
    die(err.message);
}
if (!ANON || !SERVICE) die('the local env file is missing the anon or service role key.');

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

/* ---------- 3 · Wipe ---------- */

async function deleteDemoUsers() {
    for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) die(`listUsers: ${error.message}`);
        const demo = data.users.filter((u) => (u.email ?? '').endsWith(`@${DEMO_DOMAIN}`));
        for (const u of demo) must(await admin.auth.admin.deleteUser(u.id), `delete user ${u.email}`);
        if (data.users.length < 1000) break;
    }
}

async function wipe() {
    await deleteDemoUsers();
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
        await client.query('BEGIN');
        /* Children before parents; RESTRICT foreign keys make the order matter.
           The delete triggers write audit rows, which the TRUNCATE then clears. */
        for (const sql of [
            'DELETE FROM public.payments',
            'DELETE FROM public.stripe_events',
            'DELETE FROM public.reviews',
            'DELETE FROM public.shift_assignments',
            'DELETE FROM public.shifts',
            'UPDATE public.jobs SET deposit_invoice_id = NULL WHERE deposit_invoice_id IS NOT NULL',
            'DELETE FROM public.invoices',
            'DELETE FROM public.jobs',
            'DELETE FROM public.proposals',
            'DELETE FROM public.quotes',
            'DELETE FROM public.sites',
            'DELETE FROM public.clients',
            'DELETE FROM public.officers',
            'DELETE FROM public.client_quotes',
            'DELETE FROM public.candidate_applications',
            'DELETE FROM public.notifications',
            'DELETE FROM public.settings',
            'DELETE FROM public.sms_opt_outs',
            /* Also clears the sign-in rate-limit window, so a run of captures
               never locks the demo owner out for 15 minutes. */
            'DELETE FROM public.intake_gate',
            'TRUNCATE public.audit_log RESTART IDENTITY',
            'ALTER SEQUENCE public.quote_number_seq RESTART WITH 1',
            'ALTER SEQUENCE public.job_number_seq RESTART WITH 1',
            'ALTER SEQUENCE public.invoice_number_seq RESTART WITH 1'
        ]) {
            await client.query(sql);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        die(`wipe failed: ${err.message}`);
    } finally {
        await client.end();
    }
    log('wiped demo users, operational tables, audit log and number sequences');
}

/* ---------- 4 · Users ---------- */

const password = () => `Demo-${randomBytes(15).toString('base64url')}`;

async function createUser(email, metadata, pw = password()) {
    const data = must(
        await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: metadata }),
        `create user ${email}`
    );
    return { id: data.user.id, email, password: pw };
}

/** Enrols and verifies TOTP through the user's own session, as /portal/security does. */
async function enrolTotp(email, pw) {
    const session = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    must(await session.auth.signInWithPassword({ email, password: pw }), `sign in ${email}`);
    const enrolled = must(await session.auth.mfa.enroll({ factorType: 'totp', friendlyName: `FUSED portal — ${email}` }), 'mfa.enroll');
    const secret = enrolled.totp.secret;
    for (let attempt = 0; attempt < 2; attempt++) {
        await waitForFreshStep(5);
        const challenge = must(await session.auth.mfa.challenge({ factorId: enrolled.id }), 'mfa.challenge');
        const { error } = await session.auth.mfa.verify({ factorId: enrolled.id, challengeId: challenge.id, code: totp(secret) });
        if (!error) return { session, secret, factorId: enrolled.id };
        if (attempt === 1) die(`mfa.verify: ${error.message}. Is [auth.mfa.totp] enabled in supabase/config.toml (restart the stack after changing it)?`);
        await new Promise((r) => setTimeout(r, 31000));
    }
    throw new Error('unreachable');
}

/* ==========================================================================
   The operating picture
   ========================================================================== */

async function seed() {
    await wipe();

    /* ---------- Clients and sites ---------- */

    const LONG_NAME = 'The Greater Central Texas Consolidated Independent Hospitality, Entertainment & Live Venue Operators Cooperative Association, LLC';

    const clientRows = {
        moontower: {
            kind: 'company', name: 'Moontower Hospitality Group', billing_contact_name: 'Dana Whitfield', billing_email: `client@${DEMO_DOMAIN}`,
            billing_phone: '+15125550142', billing_address_line1: '1100 E 6th St', billing_city: 'Austin', billing_state: 'TX', billing_postal_code: '78702',
            default_net_term_id: 'net-15', sms_consent: true, sms_consent_at: daysAgo(40), notes: 'Three venues. Weekend door teams at the Rooftop are a standing detail; the Saloon books one-offs.'
        },
        cooperative: {
            kind: 'company', name: LONG_NAME, billing_contact_name: 'Bartholomew Montgomery-Fitzgerald III',
            billing_email: 'accounts.payable.department@greatercentraltexashospitalitycooperative.example', billing_phone: '+15125550199',
            billing_address_line1: '12500 Research Boulevard Northwest, Building 4, Suite 1450 (Loading Dock C, rear entrance off the Burnet Road service lane)',
            billing_address_line2: 'Attn: Accounts Payable — Remittance Processing Center, Mail Stop 44-B', billing_city: 'Austin', billing_state: 'TX', billing_postal_code: '78759-4471',
            default_net_term_id: 'net-30', notes: 'Purchase order number is required on every invoice. PO-2026-000418877-GALA covers the annual gala.'
        },
        hoa: { kind: 'company', name: 'Barton Creek Estates HOA', billing_contact_name: 'Dr. Samuel Whitaker', billing_email: 'board@bartoncreekestates.example', billing_phone: '+15125550117', billing_address_line1: '8212 Barton Club Dr', billing_city: 'Austin', billing_postal_code: '78735', default_net_term_id: 'net-30' },
        build: { kind: 'company', name: 'Lone Star Build Partners', billing_contact_name: 'Travis McAllister', billing_email: 'ap@lonestarbuild.example', billing_phone: '+15125550163', billing_address_line1: '400 W 15th St, Suite 900', billing_city: 'Austin', billing_postal_code: '78701', default_net_term_id: 'net-30' },
        vance: { kind: 'individual', name: 'Eleanor Vance', billing_contact_name: 'Eleanor Vance', billing_email: 'eleanor@vance-family.example', billing_phone: '+15125550108', billing_address_line1: '2200 Ranch Road 12', billing_city: 'Dripping Springs', billing_postal_code: '78620', default_net_term_id: 'due-on-receipt' },
        rainey: { kind: 'company', name: 'Rainey Street Social Club', billing_contact_name: 'Marcus Delgado', billing_email: 'marcus@raineysocial.example', billing_phone: '+15125550131', billing_address_line1: '91 Rainey St', billing_city: 'Austin', billing_postal_code: '78701', default_net_term_id: 'net-7', sms_consent: true, sms_consent_at: daysAgo(3) },
        logistics: { kind: 'company', name: 'Capital Metro Logistics Park', billing_contact_name: 'Ellen Brightwater', billing_email: 'security@capmetrologistics.example', billing_phone: '+15125550177', billing_address_line1: '9000 Johnny Morris Rd', billing_city: 'Austin', billing_postal_code: '78724', tax_exempt: true, notes: 'Tax-exempt certificate on file (TX 01-339).' },
        festival: { kind: 'company', name: 'Hill Country Film Festival', billing_contact_name: 'Jordan Ruiz', billing_email: 'ops@hcff.example', billing_phone: '+15125550155', billing_address_line1: '713 Congress Ave', billing_city: 'Austin', billing_postal_code: '78701', default_net_term_id: 'net-15' }
    };
    const clients = {};
    for (const [key, row] of Object.entries(clientRows)) clients[key] = await insert(admin, 'clients', row, `client ${key}`);

    const siteRows = {
        rooftop: { client_id: clients.moontower.id, name: 'Moontower Rooftop — 6th Street', address_line1: '1100 E 6th St, Rooftop Level', city: 'Austin', postal_code: '78702', onsite_contact_name: 'Luis Ortega (GM)', onsite_contact_phone: '+15125550143', access_notes: 'Staff entrance on the alley side; badge in with the GM. Freight elevator to roof.', parking_notes: 'Two reserved spaces in the Waller St garage, level 2.', gear_notes: 'Black polo, radio earpiece, wand at the door.' },
        saloon: { client_id: clients.moontower.id, name: 'Moontower Saloon — South Congress', address_line1: '2400 S Congress Ave', city: 'Austin', postal_code: '78704', onsite_contact_name: 'Jess Park', onsite_contact_phone: '+15125550144' },
        ballroom: {
            client_id: clients.cooperative.id,
            name: 'Cooperative Member Venue #14 — The Grand Ballroom at the Historic Congress Avenue Convention Annex',
            address_line1: '12500 Research Boulevard Northwest, Building 4, Suite 1450 (Loading Dock C, rear entrance off the Burnet Road service lane)',
            address_line2: 'Attn: Security Operations Center — Night Supervisor Desk, Extension 4471',
            city: 'Austin', postal_code: '78759-4471', onsite_contact_name: 'Anastasia Konstantinidou-Beauregard', onsite_contact_phone: '+15125550198',
            access_notes: 'Check in at the SOC desk with government ID; vendor wristbands issued there. No access through the main lobby after 17:00 on event days under any circumstances.'
        },
        gatehouse: { client_id: clients.hoa.id, name: 'Barton Creek Estates — North Gatehouse', address_line1: '8212 Barton Club Dr', city: 'Austin', postal_code: '78735', onsite_contact_name: 'Gate staff', onsite_contact_phone: '+15125550118' },
        sh130: { client_id: clients.build.id, name: 'SH-130 Distribution Center (Phase II)', address_line1: 'SH-130 & E Pecan St', city: 'Pflugerville', postal_code: '78660', onsite_contact_name: 'Site super: Ray Coleman', onsite_contact_phone: '+15125550164', gear_notes: 'Hard hat and hi-vis required past the trailer.' },
        ranch: { client_id: clients.vance.id, name: 'Vance Ranch — Dripping Springs', address_line1: '2200 Ranch Road 12', city: 'Dripping Springs', postal_code: '78620', access_notes: 'Gate code changes weekly; dispatch holds it.' },
        rainey: { client_id: clients.rainey.id, name: 'Rainey Street Social Club', address_line1: '91 Rainey St', city: 'Austin', postal_code: '78701', onsite_contact_name: 'Marcus Delgado', onsite_contact_phone: '+15125550131' },
        fleet: { client_id: clients.logistics.id, name: 'Fleet Yard 3', address_line1: '9000 Johnny Morris Rd, Gate C', city: 'Austin', postal_code: '78724' },
        paramount: { client_id: clients.festival.id, name: 'Paramount Theatre', address_line1: '713 Congress Ave', city: 'Austin', postal_code: '78701', onsite_contact_name: 'Jordan Ruiz', onsite_contact_phone: '+15125550155' }
    };
    const sites = {};
    for (const [key, row] of Object.entries(siteRows)) sites[key] = await insert(admin, 'sites', row, `site ${key}`);

    /* ---------- Users ---------- */

    const ownerUser = await createUser(`owner@${DEMO_DOMAIN}`, { role: 'owner', full_name: 'Cameron Harrell' });
    const { session: ownerDb, secret, factorId } = await enrolTotp(ownerUser.email, ownerUser.password);
    log('owner created with a verified TOTP factor');

    const clientUser = await createUser(`client@${DEMO_DOMAIN}`, { role: 'client', client_id: clients.moontower.id, full_name: 'Dana Whitfield' });

    const officers = await insert(admin, 'officers', [
        { full_name: 'Marcus Reyes', email: `officer@${DEMO_DOMAIN}`, phone: '+15125550170', dps_license_level: 'level-3', dps_license_number: 'C-00481-7729', dps_license_expires_on: ymd(420) },
        { full_name: 'Alicia Tran', email: 'alicia.tran@officers.example', phone: '+15125550171', dps_license_level: 'level-4', dps_license_number: 'P-00193-2210', dps_license_expires_on: ymd(60) },
        { full_name: 'Derrick Owens', email: 'derrick.owens@officers.example', phone: '+15125550172', dps_license_level: 'level-2', dps_license_number: 'B-01177-0045', dps_license_expires_on: ymd(200) }
    ]);
    const officerUser = await createUser(`officer@${DEMO_DOMAIN}`, { role: 'officer', officer_id: officers[0].id, full_name: 'Marcus Reyes' });

    /* ---------- Leads ---------- */

    const pref = armedPreferences;
    const leadRows = [
        { key: 'emergency', full_name: 'Priya Natarajan', company: 'Natarajan Family Office', phone: '+15125550101', email: 'priya@natarajan-fo.example', service_division: 'Emergency Tactical Dispatch', armed_preference: pref.armed, deployment_location: 'Westlake Hills residence, 1 Rollingwood Dr, West Lake Hills, TX 78746', schedule: 'Tonight — immediately, open-ended until further notice', notes: 'A former employee made a direct threat against my husband this afternoon and has been seen driving past the house twice. Police report filed (APD case 26-114502). We need an armed officer at the residence tonight and a plan for the school run tomorrow morning. Please call rather than email.', status: 'new', created_at: minutesAgo(25), sms_consent: true, sms_consent_at: minutesAgo(25) },
        { key: 'rainey', full_name: 'Marcus Delgado', company: 'Rainey Street Social Club', phone: '+15125550131', email: 'marcus@raineysocial.example', service_division: 'Restaurant, Bar & Nightlife Venue Security', armed_preference: pref.armed, deployment_location: 'Rainey Street Historic District, Austin', schedule: 'Fridays and Saturdays, 9 PM – 3 AM, starting this weekend', notes: 'Two fights at close last weekend. Urgent: we want a door team in place before Friday.', status: 'new', created_at: hoursAgo(3), client_id: clients.rainey.id },
        { key: 'wedding', full_name: 'Hannah Okafor', company: null, phone: '+15125550112', email: 'hannah.okafor@mail.example', service_division: 'Special Event & Venue Security', armed_preference: pref.unarmed, deployment_location: 'Laguna Gloria, 3809 W 35th St, Austin', schedule: 'Saturday, October 17 · 4 PM – 11 PM (wedding reception, 220 guests)', notes: 'Uniformed presence at the gate and the parking field, and someone to keep an eye on the gift table.', status: 'new', created_at: daysAgo(1, 14, 12) },
        { key: 'build', full_name: 'Travis McAllister', company: 'Lone Star Build Partners', phone: '+15125550163', email: 'travis@lonestarbuild.example', service_division: 'Construction Site Security', armed_preference: pref.mixed, deployment_location: 'SH-130 & E Pecan St, Pflugerville, TX', schedule: 'Nightly 6 PM – 6 AM through project completion (est. 9 months)', notes: 'Copper wire theft twice in August.', status: 'new', created_at: daysAgo(3, 9, 40), client_id: clients.build.id },
        { key: 'logistics', full_name: 'Ellen Brightwater', company: 'Capital Metro Logistics Park', phone: '+15125550177', email: 'security@capmetrologistics.example', service_division: 'Commercial & Property Patrol', armed_preference: pref.armed, deployment_location: '9000 Johnny Morris Rd, Gate C through Gate F, including the unlit east perimeter fence line along Walnut Creek', schedule: 'Overnight, 7 nights, 10 PM – 6 AM', notes: 'Repeated catalytic converter theft from the fleet yard. Urgent overnight patrol quote please.', status: 'contacted', first_response_at: daysAgo(4, 11), created_at: daysAgo(4, 8, 5), client_id: clients.logistics.id },
        { key: 'hoa', full_name: 'Dr. Samuel Whitaker', company: 'Barton Creek Estates HOA', phone: '+15125550117', email: 'board@bartoncreekestates.example', service_division: 'Private Estate & Ranch Defense', armed_preference: pref.recommend, deployment_location: 'Barton Creek Estates, North and South gatehouses', schedule: 'To be determined after the site audit', notes: null, status: 'audit_scheduled', first_response_at: daysAgo(5, 10), created_at: daysAgo(5, 7, 30), client_id: clients.hoa.id },
        { key: 'moontower', full_name: 'Dana Whitfield', company: 'Moontower Hospitality Group', phone: '+15125550142', email: `client@${DEMO_DOMAIN}`, service_division: 'Special Event & Venue Security', armed_preference: pref.armed, deployment_location: 'Moontower Rooftop, 1100 E 6th St', schedule: 'Halloween weekend, Friday and Saturday', notes: 'Costume rules make the door harder than usual.', status: 'proposal_sent', first_response_at: daysAgo(8, 12), created_at: daysAgo(8, 9), client_id: clients.moontower.id },
        { key: 'cooperative', full_name: 'Bartholomew Montgomery-Fitzgerald III', company: LONG_NAME, phone: '+15125550199', email: 'accounts.payable.department@greatercentraltexashospitalitycooperative.example', service_division: 'Special Event & Venue Security', armed_preference: pref.mixed, deployment_location: 'Cooperative Member Venue #14 — The Grand Ballroom at the Historic Congress Avenue Convention Annex, 12500 Research Boulevard Northwest, Building 4, Suite 1450', schedule: 'Annual Members Gala, doors 6 PM, close 1 AM', notes: 'VIP arrivals through Loading Dock C. Needs a PO number on the invoice.', status: 'proposal_sent', first_response_at: daysAgo(9, 15), created_at: daysAgo(9, 13), client_id: clients.cooperative.id },
        { key: 'vance', full_name: 'Eleanor Vance', company: null, phone: '+15125550108', email: 'eleanor@vance-family.example', service_division: 'Private Estate & Ranch Defense', armed_preference: pref.armed, deployment_location: 'Vance Ranch, Dripping Springs', schedule: 'While the family travels, three days', notes: null, status: 'dispatched', first_response_at: daysAgo(12, 9), created_at: daysAgo(12, 8), client_id: clients.vance.id },
        { key: 'festival', full_name: 'Jordan Ruiz', company: 'Hill Country Film Festival', phone: '+15125550155', email: 'ops@hcff.example', service_division: 'Special Event & Venue Security', armed_preference: pref.mixed, deployment_location: 'Paramount Theatre, 713 Congress Ave', schedule: 'Closing night screening and after-party', notes: null, status: 'closed_won', first_response_at: daysAgo(20, 10), created_at: daysAgo(21, 16), client_id: clients.festival.id },
        { key: 'sterling', full_name: 'Victoria Sterling', company: 'Sterling Capital Partners', phone: '+15125550186', email: 'office@sterlingcap.example', service_division: 'Executive & VIP Close Protection (Level IV PPO)', armed_preference: pref.armed, deployment_location: 'Four Seasons Austin, and the investor dinner at Jeffrey\'s', schedule: 'Two days, principal arriving AUS 8:40 AM', notes: 'Discretion is the priority.', status: 'closed_won', first_response_at: daysAgo(25, 9), created_at: daysAgo(25, 7) },
        { key: 'brandt', full_name: 'Kevin Brandt', company: 'Brandt Auto Group', phone: '+15125550190', email: 'kbrandt@brandtauto.example', service_division: 'Commercial & Property Patrol', armed_preference: pref.unarmed, deployment_location: 'Brandt Auto Group, 11900 N I-35 Frontage Rd', schedule: 'Weekend lot patrol', notes: 'Went with their incumbent provider on price.', status: 'closed_lost', first_response_at: daysAgo(29, 10), created_at: daysAgo(30, 15) },
        { key: 'preview', full_name: 'Preview Test Submission', company: 'QA — preview deploy', phone: '+15125550000', email: 'qa@preview.example', service_division: 'Commercial & Property Patrol', armed_preference: pref.recommend, deployment_location: 'Nowhere, TX', schedule: 'n/a', notes: 'Submitted from a preview URL to check intake.', status: 'new', created_at: hoursAgo(6), source_env: 'preview' }
    ];
    const leads = {};
    for (const { key, ...row } of leadRows) {
        leads[key] = await insert(admin, 'client_quotes', { ref_code: refCode('TX-FPS'), estimated_value: 0, source_env: 'production', ...row }, `lead ${key}`);
    }
    for (const [clientKey, leadKey] of [['moontower', 'moontower'], ['cooperative', 'cooperative'], ['hoa', 'hoa'], ['build', 'build'], ['vance', 'vance'], ['rainey', 'rainey'], ['logistics', 'logistics'], ['festival', 'festival']]) {
        must(await admin.from('clients').update({ source_quote_id: leads[leadKey].id }).eq('id', clients[clientKey].id), 'link client to lead');
    }

    /* ---------- Quotes and proposals ---------- */

    const TERMS = 'Rates are per officer, per hour, with a four-hour minimum per shift. Cancellations inside 24 hours are billed at the minimum. Officers operate under Texas Occupations Code Chapter 1702 and the post orders agreed for the site. Invoices are payable within the stated terms; late balances accrue no interest but pause new scheduling.';

    async function quoteWithProposal({ key, client, site, lead, division, level, officers, hours, deposit = 0, starts, ends, validUntil, status, sentAt, decidedAt, notes, proposal }) {
        const rateCents = rate(level === 'mixed' ? 'level-3' : level);
        const subtotal = lineCents(officers, hours, rateCents);
        const t = totals([{ amount_cents: subtotal }], 8.25, client.tax_exempt);
        const quote = await insert(admin, 'quotes', {
            client_id: client.id, site_id: site?.id ?? null, source_quote_id: lead?.id ?? null, division_quote_value: division, armed_level: level,
            officer_count: officers, hours, bill_rate_cents: rateCents, ...t, deposit_pct: deposit, starts_at: starts, ends_at: ends, valid_until: validUntil,
            status, sent_at: sentAt ?? null, decided_at: decidedAt ?? null, notes: notes ?? null, created_by: ownerUser.id
        }, `quote ${key}`);
        const proposalStatus = proposal.status ?? status;
        const row = {
            quote_id: quote.id, client_id: client.id, title: proposal.title, scope: proposal.scope, exclusions: proposal.exclusions ?? null, terms: TERMS,
            status: proposalStatus, sent_at: sentAt ?? null,
            snapshot: proposalStatus === 'draft' ? null : { quote, proposal: { title: proposal.title, scope: proposal.scope, exclusions: proposal.exclusions ?? null, terms: TERMS }, client: { name: client.name, contact: client.billing_contact_name, email: client.billing_email }, sent_at: sentAt },
            ...(proposal.extra ?? {})
        };
        const prop = await insert(admin, 'proposals', row, `proposal ${key}`);
        return { quote, proposal: prop };
    }

    const q = {};
    q.draft = await quoteWithProposal({
        key: 'draft', client: clients.hoa, site: sites.gatehouse, lead: leads.hoa, division: 'Private Estate & Ranch Defense', level: 'level-3', officers: 2, hours: 12, starts: at(21, 18), ends: at(22, 6), validUntil: ymd(30), status: 'draft',
        proposal: { title: 'Barton Creek Estates — gatehouse coverage (draft)', scope: 'Two Level III officers staffing the North Gatehouse overnight, with a mobile check of the South Gate every two hours.' }
    });
    q.sentClient = await quoteWithProposal({
        key: 'sentClient', client: clients.moontower, site: sites.rooftop, lead: leads.moontower, division: 'Special Event & Venue Security', level: 'level-3', officers: 4, hours: 7, deposit: 25, starts: at(33, 20), ends: at(34, 3), validUntil: ymd(14), status: 'sent', sentAt: daysAgo(2, 16),
        proposal: { title: 'Moontower Rooftop — Halloween weekend door and floor team', scope: 'Four Level III commissioned officers: two at the street door running ID and costume checks (no masks past the door, no replica weapons), one on the rooftop floor, one on the stairwell and freight elevator. Officers arrive 30 minutes before doors for a walk-through with the GM.', exclusions: 'Parking enforcement in the Waller St garage. Cash handling.' }
    });
    q.accepted = await quoteWithProposal({
        key: 'accepted', client: clients.moontower, site: sites.rooftop, division: 'Restaurant, Bar & Nightlife Venue Security', level: 'level-3', officers: 2, hours: 6, deposit: 25, starts: at(-26, 21), ends: at(-25, 3), validUntil: ymd(-20), status: 'accepted', sentAt: daysAgo(34, 10), decidedAt: daysAgo(33, 17),
        proposal: { title: 'Moontower Rooftop — standing Friday & Saturday door team', scope: 'Two Level III officers every Friday and Saturday, 9 PM to 3 AM, at the street door and the rooftop floor.', extra: { accepted_at: daysAgo(33, 17), accepted_name: 'Dana Whitfield', accepted_ip: '203.0.113.24', accepted_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)' } }
    });
    q.declined = await quoteWithProposal({
        key: 'declined', client: clients.moontower, site: sites.saloon, division: 'Special Event & Venue Security', level: 'level-4', officers: 3, hours: 5, starts: at(-12, 19), ends: at(-12, 24), validUntil: ymd(-15), status: 'declined', sentAt: daysAgo(22, 10), decidedAt: daysAgo(20, 9),
        proposal: { title: 'Moontower Saloon — New Year\'s Eve PPO detail', scope: 'Three Level IV officers for the headline act\'s arrival, set and departure.', extra: { declined_at: daysAgo(20, 9), declined_reason: 'The artist\'s management is bringing their own close protection team, so we only need the door.' } }
    });
    q.expired = await quoteWithProposal({
        key: 'expired', client: clients.cooperative, site: sites.ballroom, division: 'Special Event & Venue Security', level: 'mixed', officers: 8, hours: 9, starts: at(-40, 17), ends: at(-39, 2), validUntil: ymd(-45), status: 'expired', sentAt: daysAgo(60, 10),
        proposal: { title: 'Spring Members Mixer — perimeter, credentialing and VIP escort', scope: 'Eight officers across credential check, perimeter and VIP escort.' }
    });
    q.sentLong = await quoteWithProposal({
        key: 'sentLong', client: clients.cooperative, site: sites.ballroom, lead: leads.cooperative, division: 'Special Event & Venue Security', level: 'mixed', officers: 6, hours: 8.5, deposit: 30, starts: at(6, 17, 30), ends: at(7, 2), validUntil: ymd(4), status: 'sent', sentAt: daysAgo(1, 9),
        notes: 'PO-2026-000418877-GALA must appear on every invoice.',
        proposal: { title: 'Annual Members Gala — Grand Ballroom perimeter, credentialing, VIP arrivals through Loading Dock C and after-hours asset protection', scope: 'Six officers (two Level III armed at Loading Dock C and the ballroom doors, four uniformed on credential check, coat check, the mezzanine and the service corridor). Command post at the SOC desk with a direct line to dispatch. Post orders to be agreed with Anastasia Konstantinidou-Beauregard no later than 72 hours before doors.', exclusions: 'Valet. Crowd control on Research Blvd. Any responsibility for member-provided private security.' }
    });
    q.festival = await quoteWithProposal({
        key: 'festival', client: clients.festival, site: sites.paramount, lead: leads.festival, division: 'Special Event & Venue Security', level: 'mixed', officers: 5, hours: 6, starts: at(-10, 18), ends: at(-10, 24), validUntil: ymd(-15), status: 'accepted', sentAt: daysAgo(19, 10), decidedAt: daysAgo(18, 12),
        proposal: { title: 'Closing night — Paramount Theatre', scope: 'Five officers for red carpet, lobby, house and after-party.', extra: { accepted_at: daysAgo(18, 12), accepted_name: 'Jordan Ruiz', accepted_ip: '198.51.100.7', accepted_user_agent: 'Mozilla/5.0 (Macintosh)' } }
    });

    /* ---------- Jobs and shifts ---------- */

    async function job(key, row) {
        return insert(admin, 'jobs', { created_by: ownerUser.id, deposit_pct: 0, ...row }, `job ${key}`);
    }
    const shiftRow = (jobRow, starts, ends, extra = {}) => ({ job_id: jobRow.id, starts_at: starts, ends_at: ends, officers_required: 1, armed_level: 'level-3', bill_rate_cents: rate('level-3'), pay_rate_cents: 3200, status: 'scheduled', ...extra });

    const jobs = {};

    /* J1 — the standing detail: every Friday and Saturday, from four weeks ago
       to eight weeks out. Past nights are completed, one future Saturday is
       cancelled for a private buyout. The shift list is deliberately long. */
    let firstFri = -28;
    while (weekdayOf(firstFri) !== 5) firstFri++;
    jobs.standing = await job('standing', {
        client_id: clients.moontower.id, site_id: sites.rooftop.id, quote_id: q.accepted.quote.id, division_quote_value: 'Restaurant, Bar & Nightlife Venue Security',
        title: 'Moontower Rooftop — Friday & Saturday door team', starts_at: at(firstFri, 21), ends_at: at(firstFri + 1, 3),
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR,SA', recurrence_until: ymd(56), arrival_window: 'Officers arrive 30 minutes before start',
        onsite_contact_name: 'Luis Ortega (GM)', onsite_contact_phone: '+15125550143', client_prep_notes: 'Have the banned-guest list printed at the door by 8:45 PM.',
        post_orders: 'ID every guest. No re-entry after 1 AM. Escalate any weapon sighting to dispatch before engaging.', deposit_pct: 25, status: 'in_progress', confirmed_at: daysAgo(30, 12)
    });
    const standingShifts = [];
    let cancelledOne = false;
    for (let d = firstFri; d <= 56; d++) {
        const wd = weekdayOf(d);
        if (wd !== 5 && wd !== 6) continue;
        const past = d < 0;
        let status = past ? 'completed' : 'scheduled';
        let notes = null;
        if (!past && wd === 6 && d > 14 && !cancelledOne) {
            status = 'cancelled';
            notes = 'Venue closed for a private buyout.';
            cancelledOne = true;
        }
        standingShifts.push(shiftRow(jobs.standing, at(d, 21), at(d + 1, 3), { officers_required: wd === 6 ? 3 : 2, status, notes }));
    }
    const standing = await insert(admin, 'shifts', standingShifts, 'standing shifts');

    jobs.today = await job('today', { client_id: clients.rainey.id, site_id: sites.rainey.id, division_quote_value: 'Restaurant, Bar & Nightlife Venue Security', title: 'Rainey Street Social Club — first weekend door team', starts_at: at(0, 20), ends_at: at(1, 2), onsite_contact_name: 'Marcus Delgado', onsite_contact_phone: '+15125550131', status: 'scheduled' });
    jobs.tomorrow = await job('tomorrow', { client_id: clients.build.id, site_id: sites.sh130.id, division_quote_value: 'Construction Site Security', title: 'SH-130 Phase II — overnight site watch', starts_at: at(1, 18), ends_at: at(2, 6), post_orders: 'Patrol the laydown yard hourly. Log every vehicle at the gate.', status: 'scheduled', confirmed_at: hoursAgo(20) });
    jobs.ranch = await job('ranch', { client_id: clients.vance.id, site_id: sites.ranch.id, division_quote_value: 'Private Estate & Ranch Defense', title: 'Vance Ranch — estate coverage while the family travels', starts_at: at(3, 7), ends_at: at(3, 19), status: 'scheduled', confirmed_at: hoursAgo(30) });
    jobs.gala = await job('gala', { client_id: clients.cooperative.id, site_id: sites.ballroom.id, quote_id: q.sentLong.quote.id, division_quote_value: 'Special Event & Venue Security', title: 'Annual Members Gala — Grand Ballroom perimeter, credentialing and VIP arrivals through Loading Dock C', starts_at: at(6, 17, 30), ends_at: at(7, 2), arrival_window: 'Command post staffed from 4:30 PM; officers on post by 5:15 PM', onsite_contact_name: 'Anastasia Konstantinidou-Beauregard', onsite_contact_phone: '+15125550198', deposit_pct: 30, status: 'scheduled' });
    jobs.showcase = await job('showcase', { client_id: clients.moontower.id, site_id: sites.saloon.id, division_quote_value: 'Special Event & Venue Security', title: 'Moontower Saloon — label showcase night', starts_at: at(5, 19), ends_at: at(5, 24), status: 'scheduled', confirmed_at: hoursAgo(4) });
    jobs.cancelled = await job('cancelled', { client_id: clients.logistics.id, site_id: sites.fleet.id, division_quote_value: 'Commercial & Property Patrol', title: 'Fleet Yard 3 — overnight patrol trial', starts_at: at(2, 22), ends_at: at(3, 6), status: 'cancelled', cancelled_at: hoursAgo(26) });
    jobs.festival = await job('festival', { client_id: clients.festival.id, site_id: sites.paramount.id, quote_id: q.festival.quote.id, division_quote_value: 'Special Event & Venue Security', title: 'Hill Country Film Festival — closing night', starts_at: at(-10, 18), ends_at: at(-10, 24), status: 'completed', confirmed_at: daysAgo(15, 9), completed_at: daysAgo(9, 1), completion_summary: 'Red carpet ran 40 minutes long; no incidents. One guest refused entry for intoxication, escorted to a rideshare. Lobby cleared by 12:10 AM.' });
    jobs.album = await job('album', { client_id: clients.moontower.id, site_id: sites.saloon.id, division_quote_value: 'Special Event & Venue Security', title: 'Moontower Saloon — private album release party', starts_at: at(-2, 19), ends_at: at(-2, 23, 30), status: 'completed', confirmed_at: daysAgo(6, 9), completed_at: daysAgo(1, 0), completion_summary: 'Quiet night. Guest list held at 180.' });
    jobs.fireworks = await job('fireworks', { client_id: clients.hoa.id, site_id: sites.gatehouse.id, division_quote_value: 'Private Estate & Ranch Defense', title: 'Barton Creek Estates — holiday fireworks patrol', starts_at: at(-30, 19), ends_at: at(-30, 24), status: 'completed', confirmed_at: daysAgo(35, 9), completed_at: daysAgo(29, 1) });

    const oneOff = await insert(admin, 'shifts', [
        shiftRow(jobs.today, jobs.today.starts_at, jobs.today.ends_at, { officers_required: 2 }),
        shiftRow(jobs.tomorrow, jobs.tomorrow.starts_at, jobs.tomorrow.ends_at, { armed_level: 'level-2', bill_rate_cents: rate('level-2'), pay_rate_cents: 2200 }),
        shiftRow(jobs.ranch, jobs.ranch.starts_at, jobs.ranch.ends_at, { officers_required: 2, armed_level: 'level-4', bill_rate_cents: rate('level-4'), pay_rate_cents: 5000 }),
        shiftRow(jobs.gala, jobs.gala.starts_at, jobs.gala.ends_at, { officers_required: 2, notes: 'Armed posts: Loading Dock C and ballroom doors.' }),
        shiftRow(jobs.gala, jobs.gala.starts_at, jobs.gala.ends_at, { officers_required: 4, armed_level: 'level-2', bill_rate_cents: rate('level-2'), pay_rate_cents: 2200, notes: 'Credential check, coat check, mezzanine, service corridor.' }),
        shiftRow(jobs.showcase, jobs.showcase.starts_at, jobs.showcase.ends_at, { officers_required: 2 }),
        shiftRow(jobs.cancelled, jobs.cancelled.starts_at, jobs.cancelled.ends_at, { status: 'cancelled' }),
        shiftRow(jobs.festival, jobs.festival.starts_at, jobs.festival.ends_at, { officers_required: 5, armed_level: 'mixed', status: 'completed' }),
        shiftRow(jobs.album, jobs.album.starts_at, jobs.album.ends_at, { officers_required: 2, status: 'completed' }),
        shiftRow(jobs.fireworks, jobs.fireworks.starts_at, jobs.fireworks.ends_at, { officers_required: 3, status: 'completed' })
    ], 'one-off shifts');

    const nextStanding = standing.filter((s) => s.status === 'scheduled').slice(0, 3);
    await insert(admin, 'shift_assignments', [
        ...nextStanding.map((s) => ({ shift_id: s.id, officer_id: officers[0].id, status: 'confirmed' })),
        { shift_id: oneOff[0].id, officer_id: officers[0].id, status: 'assigned' },
        { shift_id: oneOff[2].id, officer_id: officers[1].id, status: 'confirmed' },
        { shift_id: oneOff[1].id, officer_id: officers[2].id, status: 'assigned' }
    ], 'shift assignments');

    /* ---------- Invoices and payments ---------- */

    const addressOf = (c) => [c.billing_address_line1, c.billing_address_line2, [c.billing_city, c.billing_state, c.billing_postal_code].filter(Boolean).join(' ')].filter(Boolean).join('\n');
    const termLabel = { 'due-on-receipt': 'Due on receipt', 'net-7': 'Net 7', 'net-15': 'Net 15', 'net-30': 'Net 30' };

    async function invoice(key, client, { lines, jobRow = null, kind = 'standard', status, issue, due, paid = 0, extra = {} }) {
        const t = totals(lines, Number(client.default_tax_rate_pct), client.tax_exempt);
        return insert(admin, 'invoices', {
            client_id: client.id, job_id: jobRow?.id ?? null, kind, client_name: client.billing_contact_name ?? client.name,
            client_company: client.kind === 'company' ? client.name : null, client_email: client.billing_email, client_phone: client.billing_phone,
            client_address: addressOf(client), net_term_id: client.default_net_term_id, payment_terms: termLabel[client.default_net_term_id] ?? 'Net 30',
            issue_date: issue, due_date: due, line_items: lines, ...t, amount_paid_cents: paid, status,
            sent_at: status === 'draft' ? null : at(-Math.max(0, daysBetween(issue)), 9), created_by: ownerUser.id,
            notes: 'Thank you for trusting FUSED with your people and property.', ...extra
        }, `invoice ${key}`);
    }
    const daysBetween = (iso) => Math.round((Date.UTC(TODAY.y, TODAY.m - 1, TODAY.d) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);

    const completedStanding = standing.filter((s) => s.status === 'completed');
    const shiftLines = (shifts) => shifts.map((s) => {
        const label = new Date(s.starts_at).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
        return line(`Level III — Armed Commissioned — ${label}, 9:00 PM–3:00 AM`, s.officers_required, 6, s.bill_rate_cents, s.id);
    });

    const inv = {};
    const standingFull = totals(shiftLines(standing.filter((s) => s.status !== 'cancelled')), 8.25).total_cents;
    const depositAmount = Math.floor((standingFull * 25) / 100 + 0.5);
    inv.deposit = await invoice('deposit', clients.moontower, { jobRow: jobs.standing, kind: 'deposit', status: 'paid', issue: ymd(-33), due: ymd(-33), lines: [line(`Deposit (25%) — ${jobs.standing.title}`, 1, 1, depositAmount)], extra: { tax_rate_pct: 0 } });
    must(await admin.from('invoices').update({ tax_rate_pct: 0, tax_cents: 0, total_cents: depositAmount, subtotal_cents: depositAmount, amount_paid_cents: depositAmount, paid_at: daysAgo(32, 14) }).eq('id', inv.deposit.id), 'settle deposit');
    must(await admin.from('jobs').update({ deposit_invoice_id: inv.deposit.id }).eq('id', jobs.standing.id), 'link deposit');

    const partialLines = shiftLines(completedStanding.slice(0, 4));
    const partialTotal = totals(partialLines).total_cents;
    inv.partial = await invoice('partial', clients.moontower, { jobRow: jobs.standing, status: 'partially_paid', issue: ymd(-10), due: ymd(5), lines: partialLines, paid: Math.floor(partialTotal / 2) });
    inv.sent = await invoice('sent', clients.moontower, { jobRow: jobs.album, status: 'sent', issue: ymd(-1), due: ymd(14), lines: [line('Level III — Armed Commissioned — private album release party, 7:00 PM–11:30 PM', 2, 4.5, rate('level-3'))] });
    const overdueLines = shiftLines(completedStanding.slice(4, 8)).length ? shiftLines(completedStanding.slice(4, 8)) : [line('Door team — August weekends', 2, 24, rate('level-3'))];
    inv.overdue = await invoice('overdue', clients.moontower, { status: 'overdue', issue: ymd(-27), due: ymd(-12), lines: overdueLines });
    inv.draft = await invoice('draft', clients.build, { jobRow: jobs.tomorrow, status: 'draft', issue: ymd(0), due: ymd(30), lines: [line('Level II — Non-Commissioned — overnight site watch, 6:00 PM–6:00 AM', 1, 12, rate('level-2'))] });
    inv.void = await invoice('void', clients.logistics, { jobRow: jobs.cancelled, status: 'void', issue: ymd(-3), due: ymd(27), lines: [line('Level III — overnight patrol trial, 10:00 PM–6:00 AM', 1, 8, rate('level-3'))], extra: { voided_at: hoursAgo(26), notes: 'Voided: the trial was cancelled by the client before the first shift.' } });
    const festivalLines = [line('Mixed detail — red carpet, lobby, house and after-party, 6:00 PM–12:00 AM', 5, 6, rate('level-3'))];
    inv.paid = await invoice('paid', clients.festival, { jobRow: jobs.festival, status: 'paid', issue: ymd(-9), due: ymd(6), lines: festivalLines, paid: totals(festivalLines).total_cents, extra: { paid_at: daysAgo(4, 15) } });
    const galaLines = [
        line('Level III — Armed Commissioned — Loading Dock C and ballroom doors, 5:30 PM–2:00 AM (PO-2026-000418877-GALA)', 2, 8.5, rate('level-3')),
        line('Level II — Uniformed — credential check, coat check, mezzanine and service corridor, 5:30 PM–2:00 AM', 4, 8.5, rate('level-2')),
        line('Command post supervisor — SOC desk liaison and dispatch line', 1, 9, rate('level-4'))
    ];
    const galaTotal = totals(galaLines).total_cents;
    inv.longOverdue = await invoice('longOverdue', clients.cooperative, { status: 'overdue', issue: ymd(-70), due: ymd(-40), lines: galaLines, paid: 150000, extra: { notes: 'PO-2026-000418877-GALA. Remit to the address above; include the invoice number on the check stub.' } });

    await insert(admin, 'payments', [
        { invoice_id: inv.deposit.id, amount_cents: depositAmount, method: 'card', status: 'succeeded', stripe_payment_intent_id: 'pi_demo_deposit_0001', stripe_charge_id: 'ch_demo_0001', received_at: daysAgo(32, 14) },
        { invoice_id: inv.partial.id, amount_cents: Math.floor(partialTotal / 2), method: 'check', status: 'succeeded', received_at: daysAgo(3, 11) },
        { invoice_id: inv.overdue.id, amount_cents: totals(overdueLines).total_cents, method: 'card', status: 'failed', stripe_payment_intent_id: 'pi_demo_failed_0002', failure_message: 'Your card was declined. (card_declined: insufficient_funds)', received_at: daysAgo(8, 19) },
        { invoice_id: inv.paid.id, amount_cents: totals(festivalLines).total_cents, method: 'us_bank_account', status: 'succeeded', stripe_payment_intent_id: 'pi_demo_ach_0003', received_at: daysAgo(4, 15) },
        { invoice_id: inv.longOverdue.id, amount_cents: 150000, method: 'check', status: 'succeeded', received_at: daysAgo(35, 10) },
        { invoice_id: inv.longOverdue.id, amount_cents: galaTotal - 150000, method: 'card', status: 'failed', stripe_payment_intent_id: 'pi_demo_failed_0004', failure_message: 'Your card has expired. (expired_card)', received_at: daysAgo(20, 16) }
    ], 'payments');

    /* ---------- Reviews ---------- */

    const reviews = await insert(admin, 'reviews', [
        { job_id: jobs.festival.id, client_id: clients.festival.id, token: hexToken(), status: 'submitted', rating: 5, body: 'Calm, sharp and invisible until they needed to be. The red carpet ran long and the team adjusted without a word from us.', author_name: 'Jordan Ruiz, Festival Director', permission_to_publish: true, requested_at: daysAgo(9, 10), submitted_at: daysAgo(8, 13), published_at: daysAgo(7, 9) },
        { job_id: jobs.fireworks.id, client_id: clients.hoa.id, token: hexToken(), status: 'submitted', rating: 4, body: 'Good coverage at the gate. The south entrance could have used a second pass.', author_name: 'Samuel Whitaker', permission_to_publish: false, requested_at: daysAgo(29, 10), submitted_at: daysAgo(27, 20) },
        { job_id: jobs.album.id, client_id: clients.moontower.id, token: hexToken(), status: 'requested', requested_at: daysAgo(1, 10) }
    ], 'reviews');

    /* ---------- Candidates ---------- */

    const candidateRows = [
        { key: 'new1', position_id: 'pos-event', license_level: 'level-2', full_name: 'Jasmine Cole', phone: '+15125550201', email: 'jasmine.cole@mail.example', service_branch: null, bio: 'Five years of door and floor work on Sixth Street. Level II since 2023.', vetting_stage: 'application_received', created_at: hoursAgo(5), stage_changed_at: hoursAgo(5), sms_consent: true, sms_consent_at: hoursAgo(5) },
        { key: 'new2', position_id: 'general-roster', license_level: 'transfer', full_name: 'Oluwaseun Adeyemi-Castellanos', phone: '+15125550202', email: 'oluwaseun.adeyemi.castellanos@longdomain-mail-provider.example', service_branch: 'U.S. Army — Military Police Corps (31B), 2014–2022', bio: 'Eight years as a military police NCO including two overseas deployments, installation access control and protective services for general officers. Relocating from Fort Liberty; eligible to certify under the Texas military licensing provisions and ready to begin Level III and Level IV coursework immediately.', vetting_stage: 'application_received', created_at: daysAgo(1, 20), stage_changed_at: daysAgo(1, 20) },
        { key: 'tops', position_id: 'pos-patrol', license_level: 'level-3', full_name: 'Ray Castillo', phone: '+15125550203', email: 'ray.castillo@mail.example', tops_number: 'TOPS-00918273', service_branch: null, bio: 'Commissioned since 2019, patrol and loss prevention.', vetting_stage: 'tops_audit', created_at: daysAgo(6), stage_changed_at: daysAgo(4) },
        { key: 'background', position_id: 'pos-concierge', license_level: 'level-2', full_name: 'Megan Liu', phone: '+15125550204', email: 'megan.liu@mail.example', tops_number: 'TOPS-00771620', bio: 'Corporate front-of-house security at a downtown tower.', vetting_stage: 'tops_audit', created_at: daysAgo(9), stage_changed_at: daysAgo(7) },
        { key: 'range', position_id: 'pos-patrol', license_level: 'level-3', full_name: 'Andre Washington', phone: '+15125550205', email: 'andre.w@mail.example', tops_number: 'TOPS-00655102', service_branch: 'U.S. Marine Corps, 2010–2016', bio: 'Former Marine, commissioned officer, range-qualified annually.', vetting_stage: 'range_physical', created_at: daysAgo(15), stage_changed_at: daysAgo(3) },
        { key: 'interview', position_id: 'pos-ppo', license_level: 'level-4', full_name: 'Natalia Morozova', phone: '+15125550206', email: 'natalia.morozova@mail.example', tops_number: 'TOPS-00402211', service_branch: null, bio: 'Level IV PPO with seven years of executive protection for technology and entertainment principals, including international advance work, secure motorcade planning and residential security programme design. Fluent in Russian and Spanish. Current CPR/First Aid and TCCC certifications; completed a psychological evaluation in the last twelve months.', vetting_stage: 'command_interview', created_at: daysAgo(22), stage_changed_at: daysAgo(2), internal_notes: 'Strong references from two principals. Ask about availability for overnight travel details. Cameron to interview in person on Thursday.' },
        { key: 'roster', position_id: 'pos-dispatch', license_level: 'dispatcher', full_name: 'Tomás Herrera', phone: '+15125550207', email: 'tomas.herrera@mail.example', bio: 'Nine years as a 911 call-taker, fluent Spanish.', vetting_stage: 'active_roster', created_at: daysAgo(40), stage_changed_at: daysAgo(10) },
        { key: 'rejected', position_id: 'pos-patrol', license_level: 'level-3', full_name: 'Brent Hollis', phone: '+15125550208', email: 'brent.hollis@mail.example', tops_number: 'TOPS-00123987', bio: 'Commissioned officer, patrol.', vetting_stage: 'rejected', created_at: daysAgo(18), stage_changed_at: daysAgo(12), rejection_reason: 'TOPS audit found a lapsed commission and an undisclosed 2024 complaint.' },
        { key: 'preview', position_id: 'pos-event', license_level: 'level-2', full_name: 'Preview Test Applicant', phone: '+15125550000', email: 'qa@preview.example', bio: 'Submitted from a preview URL.', vetting_stage: 'application_received', created_at: hoursAgo(7), stage_changed_at: hoursAgo(7), source_env: 'preview' }
    ];
    const candidates = {};
    for (const { key, ...row } of candidateRows) {
        candidates[key] = await insert(admin, 'candidate_applications', { ref_code: refCode('TX-CAND'), source_env: 'production', ...row }, `candidate ${key}`);
    }
    for (const key of ['tops', 'range', 'interview']) {
        must(await admin.from('candidate_applications').update({ assigned_to: ownerUser.id }).eq('id', candidates[key].id), 'assign candidate');
    }

    /* ---------- Settings ---------- */

    await insert(admin, 'settings', [
        { key: 'owner_name', value: 'Cameron Harrell' },
        { key: 'owner_email', value: `owner@${DEMO_DOMAIN}` },
        { key: 'owner_phone', value: '+15125550100' },
        { key: 'default_deposit_pct', value: '25' },
        { key: 'brief_arrival_window', value: 'Officers arrive 30 minutes before start' }
    ], 'settings');

    /* ---------- Notification log: sent, failed and skipped ---------- */

    const n = (trigger, channel, recipient, role, entityType, entityId, status, subject, createdAt, extra = {}) => ({
        trigger, channel, recipient, recipient_role: role, entity_type: entityType, entity_id: entityId, status, subject,
        provider: channel === 'email' ? 'resend' : 'twilio', provider_id: status === 'sent' ? `${channel === 'email' ? 're' : 'SM'}_demo_${randomBytes(6).toString('hex')}` : null,
        created_at: createdAt, ...extra
    });
    await insert(admin, 'notifications', [
        n('lead_unanswered_2h', 'sms', '+15125550100', 'owner', 'client_quote', leads.rainey.id, 'sent', null, hoursAgo(1), { body_preview: 'Lead TX-FPS unanswered for 2h: Marcus Delgado, Rainey Street Social Club' }),
        n('lead_unanswered_2h', 'email', `owner@${DEMO_DOMAIN}`, 'owner', 'client_quote', leads.rainey.id, 'sent', 'Unanswered lead: Rainey Street Social Club', hoursAgo(1)),
        n('proposal_sent', 'email', `client@${DEMO_DOMAIN}`, 'client', 'proposal', q.sentClient.proposal.id, 'sent', 'Your proposal: Moontower Rooftop — Halloween weekend', daysAgo(2, 16)),
        n('proposal_sent', 'sms', '+15125550142', 'client', 'proposal', q.sentClient.proposal.id, 'failed', null, daysAgo(2, 16, 1), { error: 'Twilio 21610: Attempt to send to unsubscribed recipient' }),
        n('proposal_sent', 'email', 'accounts.payable.department@greatercentraltexashospitalitycooperative.example', 'client', 'proposal', q.sentLong.proposal.id, 'sent', 'Your proposal: Annual Members Gala — Grand Ballroom perimeter, credentialing, VIP arrivals through Loading Dock C and after-hours asset protection', daysAgo(1, 9)),
        n('job_confirmed', 'email', 'ap@lonestarbuild.example', 'client', 'job', jobs.tomorrow.id, 'sent', 'Your detail brief: SH-130 Phase II — overnight site watch', hoursAgo(20)),
        n('job_reminder_24h', 'sms', '+15125550131', 'client', 'job', jobs.today.id, 'skipped', null, hoursAgo(12), { error: 'non_production_env', provider_id: null }),
        n('invoice_sent', 'email', `client@${DEMO_DOMAIN}`, 'client', 'invoice', inv.sent.id, 'sent', `Invoice ${inv.sent.invoice_number} from FUSED`, daysAgo(1, 9)),
        n('invoice_overdue', 'email', 'accounts.payable.department@greatercentraltexashospitalitycooperative.example', 'client', 'invoice', inv.longOverdue.id, 'failed', `Overdue: invoice ${inv.longOverdue.invoice_number}`, daysAgo(33, 9), { error: 'Resend 422: The `to` field must be a valid email address with a deliverable domain.' }),
        n('payment_receipt', 'email', 'ops@hcff.example', 'client', 'invoice', inv.paid.id, 'sent', `Receipt for invoice ${inv.paid.invoice_number}`, daysAgo(4, 15, 2)),
        n('payment_received', 'sms', '+15125550100', 'owner', 'invoice', inv.paid.id, 'sent', null, daysAgo(4, 15, 2)),
        n('review_request', 'email', `client@${DEMO_DOMAIN}`, 'client', 'review', reviews[2].id, 'sent', 'How did we do at the album release party?', daysAgo(1, 10)),
        n('candidate_rejected', 'email', 'brent.hollis@mail.example', 'visitor', null, candidates.rejected.id, 'sent', 'Your application to FUSED', daysAgo(12, 11)),
        n('daily_digest', 'email', `owner@${DEMO_DOMAIN}`, 'owner', 'digest', null, 'sent', 'Today: 3 new leads, 1 job tonight, 2 invoices overdue', at(0, 7))
    ], 'notifications');

    /* ---------- 5 · Changes made as the owner, for the audit trail ---------- */

    const asOwner = async (what, promise) => must(await promise, `owner ${what}`);
    await asOwner('responds to a lead', ownerDb.from('client_quotes').update({ status: 'contacted', first_response_at: hoursAgo(50) }).eq('id', leads.build.id));
    await asOwner('advances a candidate', ownerDb.from('candidate_applications').update({ vetting_stage: 'background_mmpi2' }).eq('id', candidates.background.id));
    await asOwner('edits a quote', ownerDb.from('quotes').update({ notes: 'Confirm costume policy wording with Luis before the brief goes out.' }).eq('id', q.sentClient.quote.id));
    await asOwner('confirms a job', ownerDb.from('jobs').update({ arrival_window: 'Officers arrive 45 minutes before start for the gate walk' }).eq('id', jobs.ranch.id));
    await asOwner('updates a site', ownerDb.from('sites').update({ parking_notes: 'Park on the gravel pad inside the second gate, never on the drive.' }).eq('id', sites.ranch.id));
    const ownerCheck = must(await ownerDb.from('jobs').select('id', { count: 'exact', head: true }), 'owner read check');
    void ownerCheck;
    log('recorded owner-attributed changes at aal2');

    /* ---------- 6 · Artefacts ---------- */

    const dir = demoDir();
    mkdirSync(dir, { recursive: true });
    const write = (name, data) => {
        const path = join(dir, name);
        writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
        chmodSync(path, 0o600);
    };
    write('owner.json', { email: ownerUser.email, password: ownerUser.password, totpSecret: secret, factorId, userId: ownerUser.id, fullName: 'Cameron Harrell', role: 'owner' });
    write('client.json', { email: clientUser.email, userId: clientUser.id, clientId: clients.moontower.id, clientName: clients.moontower.name, signIn: 'magic link: auth.admin.generateLink → /auth/confirm?token_hash=…&type=magiclink&next=/client' });
    write('officer.json', { email: officerUser.email, userId: officerUser.id, officerId: officers[0].id, signIn: 'magic link, as client.json' });
    write('ids.json', {
        generatedAt: NOW.toISOString(),
        lead: leads.emergency.id,
        quote: q.sentLong.quote.id,
        job: jobs.standing.id,
        invoice: inv.longOverdue.id,
        client: clients.cooperative.id,
        candidate: candidates.interview.id,
        clientProposal: q.sentClient.proposal.id,
        clientJob: jobs.standing.id,
        clientInvoice: inv.partial.id,
        payToken: inv.sent.pay_token,
        reviewToken: reviews[2].token
    });

    const counts = { clients: 8, sites: Object.keys(sites).length, leads: leadRows.length, quotes: Object.keys(q).length, jobs: Object.keys(jobs).length, shifts: standing.length + oneOff.length, invoices: Object.keys(inv).length, candidates: candidateRows.length };
    log(`seeded ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    log(`artefacts in ${dir} (owner.json holds the demo password and TOTP secret; local only)`);
    if (!existsSync(join(APP_DIR, 'shared'))) log('note: app/shared is missing — run `node scripts/sync-shared.mjs` (pnpm dev does it) before starting the portal.');
}

seed().catch((err) => die(err.stack || err.message));
