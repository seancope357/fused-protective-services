// ==============================================================================
// Fused Protective Services — Vercel Serverless Intake Handler (/api/intake)
// Target: Node.js 18+ on Vercel Functions (Fluid Compute)
// Description: Zero-dependency intake router for Quotes and Candidate Applications.
//
// Request gate, before anything is delivered:
//   • CORS      → only the site's own origins get Access-Control-Allow-Origin
//   • Honeypot  → a filled `website` field is a bot; answer 200, deliver nothing
//   • Stage 0   → per-IP rate limit and duplicate suppression backed by
//                 public.intake_attempts. The guard fails open: a broken guard
//                 must never cost a real lead.
//
// Delivery chain, in order. Each stage is independent; a failure in one does not
// stop the next. The response reports which stages succeeded so nothing fails
// silently.
//   1.  Persist  → Supabase REST (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   2.  Alert    → Resend email to dispatch (RESEND_API_KEY + DISPATCH_ALERT_TO)
//   2b. Confirm  → Resend auto-reply to the submitter; never affects the status
//   2c. SMS      → Twilio text to DISPATCH_ALERT_SMS_TO, emergency quotes only
//   3.  Forward  → Optional JSON webhook (DISPATCH_ALERT_WEBHOOK | HUBSPOT_WEBHOOK_URL)
// If every configured stage fails, the visitor gets a 503 and is told to call.
// ==============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { site } from '../src/data/site.mjs';

/* Reference codes: 6 chars from an alphabet without 0/O/1/I. The DB enforces
   UNIQUE(ref_code); 32^6 ≈ 1e9 codes makes a collision a non-event. Both forms
   display whatever refCode the server returns, so this overrides the client's
   4-digit placeholder. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeRefCode(prefix) {
    let code = '';
    for (const byte of randomBytes(6)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    return `${prefix}-${code}`;
}

const text = (value, max = 500) =>
    (value == null ? '' : String(value)).trim().slice(0, max);

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);

const splitList = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);

/* The number the visitor is told to call. The env var exists so dispatch can
   swap lines without a rebuild; src/data/site.mjs is the same value the page
   itself prints, so the two never disagree by default. */
const dispatchPhone = () => process.env.DISPATCH_PHONE_DISPLAY || site.phone.display;

/* Mirrors the trg_triage_quote trigger so the alert is right even when the
   database write fails. When the row does persist, the DB's answer wins. */
function triagePriority(quote) {
    const division = quote.service_division;
    const notes = quote.notes || '';
    if (/emergency|tactical dispatch|level iv ppo/i.test(division)) return 'emergency';
    if (/urgent|threat|immediate/i.test(notes)) return 'priority';
    return 'standard';
}

function normalise(body) {
    const isCandidate = Boolean(body.appPosition || body.positionId || body.type === 'candidate');
    if (isCandidate) {
        return {
            isCandidate,
            table: 'candidate_applications',
            record: {
                ref_code: makeRefCode('TX-CAND'),
                position_id: text(body.appPosition) || 'general-roster',
                license_level: text(body.appLicenseLevel) || 'unspecified',
                full_name: text(body.appFullName) || 'Anonymous Candidate',
                phone: text(body.appPhone, 40),
                email: text(body.appEmail, 254),
                tops_number: text(body.appLicenseNumber, 40) || null,
                service_branch: text(body.appServiceBranch) || 'civilian',
                bio: text(body.appBio, 5000),
                vetting_stage: 'application_received'
            }
        };
    }
    return {
        isCandidate,
        table: 'client_quotes',
        record: {
            ref_code: makeRefCode('TX-FPS'),
            full_name: text(body.formName) || 'Anonymous Client',
            company: text(body.formCompany) || null,
            phone: text(body.formPhone, 40),
            email: text(body.formEmail, 254),
            service_division: text(body.formDivision) || 'Commercial & Property Patrol',
            armed_preference: text(body.formArmedPreference) || 'Armed (Level III / IV)',
            deployment_location: text(body.formLocation) || 'Austin, TX',
            schedule: text(body.formSchedule) || 'TBD',
            notes: text(body.formNotes, 2000) || null,
            status: 'new'
        }
    };
}

/* ---------- CORS ---------- */
/* Same-origin form posts never send a preflight, so the only traffic that
   needs CORS is a script on another origin. That is exactly the traffic we do
   not want, so the allow list is the production hosts, Vercel previews, and a
   local dev server. Anything else gets no ACAO header and the browser refuses
   to hand it the response. */
const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?fusedprotectiveservices\.com|https:\/\/[a-z0-9.-]+\.vercel\.app|http:\/\/localhost(:\d+)?)$/i;

function resolveCorsOrigin(origin) {
    return origin && ALLOWED_ORIGIN.test(origin) ? origin : null;
}

function applyCors(req, res) {
    /* Vary tells caches the answer depends on Origin, so a cached response
       for an allowed origin is never replayed to a disallowed one. */
    res.setHeader('Vary', 'Origin');
    const origin = resolveCorsOrigin(req.headers?.origin);
    if (!origin) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ---------- Supabase transport (shared by Stage 0 and Stage 1) ---------- */
function supabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return url && key ? { url, key } : null;
}

function supabaseFetch(path, { method = 'GET', body, prefer } = {}) {
    const { url, key } = supabaseConfig();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (prefer) headers.Prefer = prefer;
    return fetch(`${url}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

/* ---------- Stage 0: abuse controls ---------- */
/* Vercel functions share no memory between invocations, so the counters live
   in Postgres. Identities are hashed with a server salt: the ledger is enough
   to throttle without becoming a table of visitor IP addresses. */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPTS_PER_IP = 5;

let warnedUnsalted = false;
function hashIdentity(value) {
    let salt = process.env.INTAKE_HASH_SALT;
    if (!salt) {
        /* Warned once per instance: a fixed salt still throttles correctly,
           it just makes the hashes guessable by dictionary. */
        if (!warnedUnsalted) {
            console.warn('[API Intake] INTAKE_HASH_SALT is unset; hashing with a fixed salt. Set it in Vercel.');
            warnedUnsalted = true;
        }
        salt = 'fused-intake-unsalted';
    }
    return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function clientIp(req) {
    /* Vercel sets x-forwarded-for; the first value is the visitor, the rest
       are hops. */
    const xff = req.headers?.['x-forwarded-for'];
    const first = String(Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
    return first || req.socket?.remoteAddress || 'unknown';
}

/* Same person, same contact details, same ask within the window is a double
   submit (a nervous second click, a page refresh), not a second lead. */
function fingerprintOf(record) {
    const email = (record.email || '').toLowerCase();
    const digits = (record.phone || '').replace(/\D/g, '');
    const division = record.service_division || record.position_id || '';
    return hashIdentity(`${email}|${digits}|${division}`);
}

async function checkAbuse({ ipHash, fingerprint }) {
    if (!supabaseConfig()) return { verdict: 'allow' };
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
    const query = 'intake_attempts?select=ip_hash,fingerprint,ref_code' +
        `&created_at=gte.${encodeURIComponent(since)}` +
        `&or=(ip_hash.eq.${ipHash},fingerprint.eq.${fingerprint})` +
        '&order=created_at.desc&limit=50';
    try {
        const res = await supabaseFetch(query);
        if (!res.ok) {
            console.error('[API Intake] Abuse-control query failed; failing open:', res.status, await res.text());
            return { verdict: 'allow' };
        }
        const rows = await res.json();
        /* Prior attempts at the limit means this request would be one more
           than ATTEMPTS_PER_IP inside the window. */
        const fromIp = rows.filter((r) => r.ip_hash === ipHash).length;
        if (fromIp >= ATTEMPTS_PER_IP) return { verdict: 'rate_limited' };
        /* Only rows that carry a ref_code were delivered; a rejected attempt
           cannot be the "original" we point the visitor back to. */
        const original = rows.find((r) => r.fingerprint === fingerprint && r.ref_code);
        if (original) return { verdict: 'duplicate', refCode: original.ref_code };
        return { verdict: 'allow' };
    } catch (err) {
        console.error('[API Intake] Abuse-control store unreachable; failing open:', err?.message || err);
        return { verdict: 'allow' };
    }
}

async function recordAttempt({ ipHash, fingerprint, refCode }) {
    if (!supabaseConfig()) return;
    try {
        const res = await supabaseFetch('intake_attempts', {
            method: 'POST',
            prefer: 'return=minimal',
            body: { ip_hash: ipHash, fingerprint, ref_code: refCode }
        });
        if (!res.ok) console.error('[API Intake] Attempt ledger insert failed:', res.status, await res.text());
    } catch (err) {
        console.error('[API Intake] Attempt ledger unreachable:', err?.message || err);
    }
}

/* ---------- Stage 1: Supabase ---------- */
async function persist(table, record) {
    if (!supabaseConfig()) return { configured: false, ok: false, row: null };

    try {
        const res = await supabaseFetch(table, {
            method: 'POST',
            prefer: 'return=representation',
            body: record
        });
        if (!res.ok) {
            console.error('[API Intake] Supabase insert failed:', res.status, await res.text());
            return { configured: true, ok: false, row: null };
        }
        const rows = await res.json();
        return { configured: true, ok: true, row: Array.isArray(rows) ? rows[0] : rows };
    } catch (err) {
        console.error('[API Intake] Supabase unreachable:', err);
        return { configured: true, ok: false, row: null };
    }
}

/* ---------- Stage 2: Resend email ---------- */
function resendConfig() {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return {
        key,
        from: process.env.DISPATCH_ALERT_FROM || 'Fused Dispatch <onboarding@resend.dev>',
        dispatchTo: splitList(process.env.DISPATCH_ALERT_TO)
    };
}

async function sendResend(key, message, label) {
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        if (!res.ok) {
            console.error(`[API Intake] Resend ${label} failed:`, res.status, await res.text());
            return false;
        }
        return true;
    } catch (err) {
        console.error(`[API Intake] Resend unreachable (${label}):`, err);
        return false;
    }
}

function buildAlert({ isCandidate, record, priority, persisted }) {
    const r = record;
    const rows = isCandidate
        ? [
            ['Reference', r.ref_code],
            ['Position', r.position_id],
            ['License level', r.license_level],
            ['Name', r.full_name],
            ['Phone', r.phone],
            ['Email', r.email],
            ['TOPS #', r.tops_number || '—'],
            ['Service branch', r.service_branch],
            ['Background', r.bio]
        ]
        : [
            ['Reference', r.ref_code],
            ['Priority', priority.toUpperCase()],
            ['Division', r.service_division],
            ['Armed preference', r.armed_preference],
            ['Name', r.full_name],
            ['Company', r.company || '—'],
            ['Phone', r.phone],
            ['Email', r.email],
            ['Location', r.deployment_location],
            ['Schedule', r.schedule],
            ['Notes', r.notes || '—']
        ];

    const tag = priority === 'emergency' ? '🚨 EMERGENCY — ' : priority === 'priority' ? '⚠️ PRIORITY — ' : '';
    const subject = isCandidate
        ? `[FPS] New officer application ${r.ref_code} — ${r.position_id}`
        : `[FPS] ${tag}New quote request ${r.ref_code} — ${r.service_division}`;

    const plain = rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
        (persisted ? '' : '\n\nWARNING: database write failed — this email is the only record.');

    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
<h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
${persisted ? '' : '<p style="color:#b00020;font-weight:600">Database write failed. This email is the only record of this submission.</p>'}
<table style="border-collapse:collapse">${rows.map(([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
    ).join('')}</table>
<p style="color:#666;font-size:13px;margin-top:16px">Sent by the fusedprotectiveservices.com intake engine.</p>
</div>`;

    return { subject, plain, html };
}

async function alert(ctx) {
    const cfg = resendConfig();
    if (!cfg || cfg.dispatchTo.length === 0) return { configured: false, ok: false };

    const { subject, plain, html } = buildAlert(ctx);
    const ok = await sendResend(cfg.key, {
        from: cfg.from,
        to: cfg.dispatchTo,
        subject,
        text: plain,
        html,
        reply_to: ctx.record.email || undefined
    }, 'dispatch alert');
    return { configured: true, ok };
}

/* ---------- Stage 2b: submitter auto-reply ---------- */
/* Runs only after the delivery check has passed: a confirmation for a request
   nobody received would be a lie. Its own outcome is reported as
   delivery.clientNotified and never changes the status code. */
function buildConfirmation({ isCandidate, record, eta }) {
    const r = record;
    const phone = dispatchPhone();
    const contact = r.phone || r.email;
    const subject = isCandidate
        ? `${site.name} — application ${r.ref_code} received`
        : `${site.name} — request ${r.ref_code} received`;

    const lead = isCandidate
        ? `We have your officer application. Your candidate reference is ${r.ref_code}.`
        : `We have your security detail request. Your dispatch reference is ${r.ref_code}.`;
    const next = isCandidate
        ? `What happens next: command review will contact you at ${contact} within 48 business hours.`
        : `What happens next: a commanding officer will contact you at ${contact} within ${eta}.`;
    const call = isCandidate
        ? `Questions in the meantime? Call the command desk at ${phone}.`
        : `Need us sooner? Dispatch answers ${phone} around the clock.`;

    const plain = [
        `Hello ${r.full_name},`,
        '',
        lead,
        '',
        next,
        '',
        call,
        '',
        site.name,
        site.motto
    ].join('\n');

    const p = (s) => `<p style="margin:0 0 14px">${escapeHtml(s)}</p>`;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">
${p(`Hello ${r.full_name},`)}
${p(lead)}
${p(next)}
${p(call)}
<p style="margin:20px 0 0;font-weight:600">${escapeHtml(site.name)}</p>
<p style="margin:0;color:#666;font-size:13px">${escapeHtml(site.motto)}</p>
</div>`;

    return { subject, plain, html };
}

async function notifyClient(ctx) {
    const cfg = resendConfig();
    if (!cfg || !ctx.record.email) return { configured: false, ok: false };

    const { subject, plain, html } = buildConfirmation(ctx);
    const ok = await sendResend(cfg.key, {
        from: cfg.from,
        to: [ctx.record.email],
        subject,
        text: plain,
        html,
        /* Replies land with dispatch, not in the Resend sandbox sender. */
        reply_to: cfg.dispatchTo[0] || undefined
    }, 'client confirmation');
    return { configured: true, ok };
}

/* ---------- Stage 2c: emergency SMS (Twilio) ---------- */
/* One segment (160 chars) so it arrives whole on a pager-grade handset.
   Field caps add up to 153 with the longest reference code; the final slice
   is a belt for the braces. */
function buildSmsBody(record) {
    const name = text(record.full_name, 28);
    const phone = text(record.phone, 18);
    return [
        `FPS EMERGENCY ${record.ref_code}`,
        text(record.service_division, 36),
        `${name} ${phone}`.trim(),
        text(record.deployment_location, 40)
    ].filter(Boolean).join('\n').slice(0, 160);
}

async function smsAlert({ isCandidate, record, priority }) {
    /* Not applicable is reported the same way as not configured: the stage
       neither counts as configured nor as delivered. */
    if (isCandidate || priority !== 'emergency') return { configured: false, ok: false };

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const to = splitList(process.env.DISPATCH_ALERT_SMS_TO);
    if (!sid || !token || !from || to.length === 0) return { configured: false, ok: false };

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
    const body = buildSmsBody(record);

    /* Log lines carry only Twilio's status and message, never the request
       headers, so the auth token cannot reach the function logs. */
    const results = await Promise.all(to.map(async (number) => {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ From: from, To: number, Body: body }).toString()
            });
            if (!res.ok) {
                const detail = await res.json().catch(() => ({}));
                console.error('[API Intake] Twilio send failed:', res.status, detail.code, detail.message);
                return false;
            }
            return true;
        } catch (err) {
            console.error('[API Intake] Twilio unreachable:', err?.message || err);
            return false;
        }
    }));
    return { configured: true, ok: results.some(Boolean) };
}

/* ---------- Stage 3: webhook (HubSpot / Zapier / Slack) ---------- */
async function forward(event) {
    const url = process.env.DISPATCH_ALERT_WEBHOOK || process.env.HUBSPOT_WEBHOOK_URL;
    if (!url) return { configured: false, ok: false };
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        if (!res.ok) console.error('[API Intake] Webhook rejected:', res.status);
        return { configured: true, ok: res.ok };
    } catch (err) {
        console.error('[API Intake] Webhook unreachable:', err);
        return { configured: true, ok: false };
    }
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
    applyCors(req, res);
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        return res.status(400).json({ ok: false, error: 'Malformed JSON body' });
    }

    /* ---------- Honeypot ---------- */
    /* `website` is a field no visitor can see or tab into; only a form-filler
       populates it. This is the one place the handler says "received" without
       delivering anything: the requester is a bot, and a 200 gives it nothing
       to learn from or retry, whereas a 4xx teaches it which field to skip. */
    if (text(body.website)) {
        console.warn('[API Intake] Honeypot filled; submission dropped without delivery.');
        return res.status(200).json({ ok: true, message: 'Request received.' });
    }

    const { isCandidate, table, record } = normalise(body);
    if (!record.phone && !record.email) {
        return res.status(400).json({ ok: false, error: 'A phone number or email address is required.' });
    }

    /* ---------- Stage 0: abuse controls ---------- */
    const ipHash = hashIdentity(clientIp(req));
    const fingerprint = fingerprintOf(record);
    const guard = await checkAbuse({ ipHash, fingerprint });

    if (guard.verdict === 'rate_limited') {
        /* The attempt is still ledgered so the window keeps counting. */
        await recordAttempt({ ipHash, fingerprint, refCode: null });
        return res.status(429).json({
            ok: false,
            error: 'rate_limited',
            message: `We are receiving a lot of requests from your connection. Please call dispatch directly at ${dispatchPhone()} and we will take your details by phone.`
        });
    }

    if (guard.verdict === 'duplicate') {
        /* The original already persisted and alerted; a second copy would only
           page dispatch twice. The visitor gets the reference they already have. */
        await recordAttempt({ ipHash, fingerprint, refCode: null });
        return res.status(200).json({
            ok: true,
            duplicate: true,
            type: isCandidate ? 'candidate' : 'quote',
            refCode: guard.refCode,
            message: `We already have this request — reference ${guard.refCode} was sent to ${record.email || record.phone}.`
        });
    }

    const [stored] = await Promise.all([
        persist(table, record),
        recordAttempt({ ipHash, fingerprint, refCode: record.ref_code })
    ]);
    const priority = isCandidate
        ? 'standard'
        : (stored.row?.priority || triagePriority(record));

    const [sent, forwarded, texted] = await Promise.all([
        alert({ isCandidate, record, priority, persisted: stored.ok }),
        forward({
            event: isCandidate ? 'candidate_application' : 'client_quote_request',
            refCode: record.ref_code,
            priority,
            timestamp: new Date().toISOString(),
            record
        }),
        smsAlert({ isCandidate, record, priority })
    ]);

    const stages = { stored, sent, forwarded, texted };
    const anyConfigured = Object.values(stages).some((s) => s.configured);
    const anyDelivered = Object.values(stages).some((s) => s.ok);

    if (!anyConfigured) {
        console.error('[API Intake] No delivery stage is configured. Submission dropped:', record.ref_code);
    }
    if (!anyDelivered) {
        return res.status(503).json({
            ok: false,
            refCode: record.ref_code,
            error: 'not_delivered',
            message: 'We could not transmit your request. Please call our dispatch line directly.'
        });
    }

    const eta = priority === 'emergency' ? '45 minutes' : '2 hours';
    const confirmed = await notifyClient({ isCandidate, record, eta });

    return res.status(200).json({
        ok: true,
        type: isCandidate ? 'candidate' : 'quote',
        refCode: record.ref_code,
        priority,
        delivery: {
            persisted: stored.ok,
            alerted: sent.ok,
            forwarded: forwarded.ok,
            smsAlerted: texted.ok,
            clientNotified: confirmed.ok
        },
        message: isCandidate
            ? `Application received — candidate reference ${record.ref_code}. Command review will contact ${record.phone || record.email} within 48 business hours.`
            : `Request received — dispatch reference ${record.ref_code}. A commanding officer will contact ${record.phone || record.email} within ${eta}.`
    });
}
