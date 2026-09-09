// ==============================================================================
// Fused Protective Services — Vercel Serverless Intake Handler (/api/intake)
// Target: Node.js 18+ on Vercel Functions (Fluid Compute). Zero dependencies.
//
// Order of operations:
//   0. Gate      → same-origin CORS, honeypot, per-IP rate limit, duplicate window
//   1. Persist   → Supabase REST insert (the DB trigger decides priority)
//   2. Alert     → Resend email to dispatch; Twilio SMS when priority = emergency
//   3. Confirm   → Resend email to the visitor with their reference code
//   4. Forward   → optional JSON webhook
// Stages 1–4 are independent. The response reports each one, and the visitor
// gets a 503 only when nothing at all was delivered. A failed confirmation or
// SMS never hides a successful lead, and a successful lead never hides a failed
// confirmation: both are stated in `delivery`.
// ==============================================================================

import { randomBytes } from 'node:crypto';
import { cors, parseBody, clientIp, text } from './_lib/http.mjs';
import { insertRow, supabaseConfigured } from './_lib/supabase.mjs';
import { logSends } from './_lib/notify-log.mjs';
import { sendEmail, internalSender, publicSender } from './_lib/email.mjs';
import { sendSms, ownerSmsRecipients } from './_lib/sms.mjs';
import { gate, isHoneypotTripped } from './_lib/gate.mjs';
import { ownerAlert, ownerSms, clientConfirmation, responseWindow } from './_lib/intake-messages.mjs';

/* Reference codes: 6 chars from an alphabet without 0/O/1/I. The DB enforces
   UNIQUE(ref_code); 32^6 ≈ 1e9 codes makes a collision a non-event. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeRefCode(prefix) {
    let code = '';
    for (const byte of randomBytes(6)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    return `${prefix}-${code}`;
}

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
                vetting_stage: 'application_received',
                sms_consent: body.appSmsConsent === 'yes' || body.appSmsConsent === 'on',
                sms_consent_at: body.appSmsConsent === 'yes' || body.appSmsConsent === 'on' ? new Date().toISOString() : null
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
            status: 'new',
            sms_consent: body.formSmsConsent === 'yes' || body.formSmsConsent === 'on',
            sms_consent_at: body.formSmsConsent === 'yes' || body.formSmsConsent === 'on' ? new Date().toISOString() : null
        }
    };
}

/* ---------- Stage 1: Supabase ---------- */
async function persist(table, record) {
    if (!supabaseConfigured()) return { configured: false, ok: false, row: null };
    try {
        const result = await insertRow(table, record);
        if (!result.ok) console.error('[API Intake] Supabase insert failed:', result.status, result.data);
        return { configured: true, ok: result.ok, row: result.row };
    } catch (err) {
        console.error('[API Intake] Supabase unreachable:', err);
        return { configured: true, ok: false, row: null };
    }
}

/* ---------- Stage 2: owner alert (email, plus SMS on emergency) ---------- */
async function alertOwner(ctx) {
    const to = (process.env.DISPATCH_ALERT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
    const { subject, text: plain, html } = ownerAlert(ctx);
    const email = await sendEmail({
        from: internalSender(),
        to,
        subject,
        text: plain,
        html,
        replyTo: ctx.record.email || undefined
    });

    let sms = { configured: false, ok: false };
    if (!ctx.isCandidate && ctx.priority === 'emergency') {
        const recipients = ownerSmsRecipients();
        if (recipients.length) {
            const body = ownerSms(ctx);
            const results = await Promise.all(recipients.map((to) => sendSms({ to, body })));
            sms = {
                configured: results.some((r) => r.configured),
                ok: results.some((r) => r.ok)
            };
        }
    }
    return { email, sms };
}

/* ---------- Stage 3: visitor confirmation ---------- */
async function confirmVisitor(ctx) {
    const from = publicSender();
    if (!from || !ctx.record.email) return { configured: Boolean(from), ok: false, skipped: !ctx.record.email };
    const { subject, text: plain, html } = clientConfirmation(ctx);
    return sendEmail({ from, to: ctx.record.email, subject, text: plain, html });
}

/* ---------- Stage 4: webhook ---------- */
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

const receivedMessage = ({ isCandidate, record, priority, confirmed }) => {
    const contact = record.phone || record.email;
    const base = isCandidate
        ? `Application received — candidate reference ${record.ref_code}. Command review will contact ${contact} within 48 business hours.`
        : `Request received — dispatch reference ${record.ref_code}. A commanding officer will contact ${contact} within ${responseWindow(priority)}.`;
    return confirmed ? `${base} A confirmation email is on its way to ${record.email}.` : base;
};

/* ---------- Handler ---------- */
export default async function handler(req, res) {
    if (!cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    let body;
    try {
        body = parseBody(req);
    } catch {
        return res.status(400).json({ ok: false, error: 'Malformed JSON body' });
    }

    const { isCandidate, table, record } = normalise(body);
    if (!record.phone && !record.email) {
        return res.status(400).json({ ok: false, error: 'A phone number or email address is required.' });
    }

    /* Honeypot. Automated form fillers complete every field, including the one
       no human can see. Deliberately answered with a plausible 200 and no
       delivery: telling a bot it was caught only trains it. This is the one
       place a non-delivery is not reported, and it is never reached by a
       browser form filled in by a person. */
    if (isHoneypotTripped(body)) {
        console.warn('[API Intake] Honeypot tripped; submission discarded.');
        return res.status(200).json({ ok: true, refCode: record.ref_code, message: 'Request received.' });
    }

    const verdict = await gate({ ip: clientIp(req), record });
    if (!verdict.allowed) {
        res.setHeader('Retry-After', String(verdict.retryAfter || 60));
        return res.status(429).json({
            ok: false,
            error: 'rate_limited',
            message: 'Too many submissions from this connection. Please wait a few minutes, or call dispatch directly.'
        });
    }
    if (verdict.duplicateOf) {
        /* Already received and already alerted: repeat the original reference
           rather than minting a second lead for the same request. */
        return res.status(200).json({
            ok: true,
            type: isCandidate ? 'candidate' : 'quote',
            refCode: verdict.duplicateOf,
            duplicate: true,
            message: `We already have this request on file — your reference is ${verdict.duplicateOf}. No need to resubmit.`
        });
    }

    const stored = await persist(table, record);
    const priority = isCandidate ? 'standard' : (stored.row?.priority || triagePriority(record));
    const ctx = { isCandidate, record, priority, persisted: stored.ok };

    const [owner, confirmed, forwarded] = await Promise.all([
        alertOwner(ctx),
        confirmVisitor(ctx),
        forward({
            event: isCandidate ? 'candidate_application' : 'client_quote_request',
            refCode: record.ref_code,
            priority,
            timestamp: new Date().toISOString(),
            record
        })
    ]);

    /* Every send becomes a row in the notification log (best effort; the
       lead's fate does not depend on the log). */
    await logSends({ isCandidate, record, priority, storedRow: stored.row, owner, confirmed });

    /* A lead counts as delivered when it reached storage or the owner. The
       visitor's own confirmation is reported but is not a delivery path. */
    const deliveryStages = [stored, owner.email, owner.sms, forwarded];
    const anyConfigured = deliveryStages.some((s) => s.configured);
    const anyDelivered = deliveryStages.some((s) => s.ok);

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

    return res.status(200).json({
        ok: true,
        type: isCandidate ? 'candidate' : 'quote',
        refCode: record.ref_code,
        priority,
        delivery: {
            persisted: stored.ok,
            alerted: owner.email.ok,
            smsAlerted: owner.sms.ok,
            confirmed: confirmed.ok,
            forwarded: forwarded.ok
        },
        message: receivedMessage({ ...ctx, confirmed: confirmed.ok })
    });
}
