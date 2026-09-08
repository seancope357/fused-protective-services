// ==============================================================================
// Fused Protective Services — Vercel Serverless Intake Handler (/api/intake)
// Target: Node.js 18+ on Vercel Functions (Fluid Compute)
// Description: Zero-dependency intake router for Quotes and Candidate Applications.
//
// Delivery chain, in order. Each stage is independent; a failure in one does not
// stop the next. The response reports which stages succeeded so nothing fails
// silently.
//   1. Persist   → Supabase REST (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   2. Alert     → Resend email to dispatch (RESEND_API_KEY + DISPATCH_ALERT_TO)
//   3. Forward   → Optional JSON webhook (DISPATCH_ALERT_WEBHOOK | HUBSPOT_WEBHOOK_URL)
// If every configured stage fails, the visitor gets a 503 and is told to call.
// ==============================================================================

import { randomBytes } from 'node:crypto';

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

/* ---------- Stage 1: Supabase ---------- */
async function persist(table, record) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { configured: false, ok: false, row: null };

    try {
        const res = await fetch(`${url}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
            },
            body: JSON.stringify(record)
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
    const key = process.env.RESEND_API_KEY;
    const to = (process.env.DISPATCH_ALERT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!key || to.length === 0) return { configured: false, ok: false };

    const from = process.env.DISPATCH_ALERT_FROM || 'Fused Dispatch <onboarding@resend.dev>';
    const { subject, plain, html } = buildAlert(ctx);
    const replyTo = ctx.record.email || undefined;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, subject, text: plain, html, reply_to: replyTo })
        });
        if (!res.ok) {
            console.error('[API Intake] Resend send failed:', res.status, await res.text());
            return { configured: true, ok: false };
        }
        return { configured: true, ok: true };
    } catch (err) {
        console.error('[API Intake] Resend unreachable:', err);
        return { configured: true, ok: false };
    }
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        return res.status(400).json({ ok: false, error: 'Malformed JSON body' });
    }

    const { isCandidate, table, record } = normalise(body);
    if (!record.phone && !record.email) {
        return res.status(400).json({ ok: false, error: 'A phone number or email address is required.' });
    }

    const stored = await persist(table, record);
    const priority = isCandidate
        ? 'standard'
        : (stored.row?.priority || triagePriority(record));

    const [sent, forwarded] = await Promise.all([
        alert({ isCandidate, record, priority, persisted: stored.ok }),
        forward({
            event: isCandidate ? 'candidate_application' : 'client_quote_request',
            refCode: record.ref_code,
            priority,
            timestamp: new Date().toISOString(),
            record
        })
    ]);

    const stages = { stored, sent, forwarded };
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
    return res.status(200).json({
        ok: true,
        type: isCandidate ? 'candidate' : 'quote',
        refCode: record.ref_code,
        priority,
        delivery: { persisted: stored.ok, alerted: sent.ok, forwarded: forwarded.ok },
        message: isCandidate
            ? `Application received — candidate reference ${record.ref_code}. Command review will contact ${record.phone || record.email} within 48 business hours.`
            : `Request received — dispatch reference ${record.ref_code}. A commanding officer will contact ${record.phone || record.email} within ${eta}.`
    });
}
