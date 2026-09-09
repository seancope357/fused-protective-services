// ==============================================================================
// Writes the intake function's sends to public.notifications so the portal's
// message log is complete: "did the client get a confirmation?" is answerable
// for leads too, not only for messages the portal itself sent.
// ==============================================================================

import { insertRow, supabaseConfigured } from './supabase.mjs';
import { ownerSmsRecipients } from './sms.mjs';

const status = (r) => (r.ok ? 'sent' : r.configured ? 'failed' : 'skipped');

/**
 * @param {{ isCandidate: boolean, record: any, priority: string, storedRow: any,
 *           owner: { email: any, sms: any }, confirmed: any }} ctx
 */
export async function logSends({ isCandidate, record, priority, storedRow, owner, confirmed }) {
    if (!supabaseConfigured()) return;
    const entityType = isCandidate ? 'candidate_application' : 'client_quote';
    const entityId = storedRow?.id ?? null;
    const rows = [];
    const ownerTo = (process.env.DISPATCH_ALERT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const to of ownerTo.length ? ownerTo : ['(none)']) {
        rows.push({ trigger: 'lead_submitted', channel: 'email', recipient: to, recipient_role: 'owner', status: status(owner.email), error: owner.email.ok ? null : owner.email.error ?? (owner.email.configured ? 'send_failed' : 'not_configured') });
    }
    if (!isCandidate && priority === 'emergency') {
        for (const to of ownerSmsRecipients().length ? ownerSmsRecipients() : ['(none)']) {
            rows.push({ trigger: 'lead_submitted', channel: 'sms', recipient: to, recipient_role: 'owner', status: status(owner.sms), error: owner.sms.ok ? null : (owner.sms.configured ? 'send_failed' : 'not_configured') });
        }
    }
    rows.push({ trigger: 'lead_confirmation', channel: 'email', recipient: record.email || '(none)', recipient_role: 'visitor', status: status(confirmed), error: confirmed.ok ? null : confirmed.skipped ? 'no_email' : confirmed.error ?? (confirmed.configured ? 'send_failed' : 'no_verified_sender') });

    await Promise.all(rows.map((r) => insertRow('notifications', {
        ...r,
        entity_type: entityType,
        entity_id: entityId,
        subject: `${record.ref_code}`,
        provider: r.channel === 'email' ? 'resend' : 'twilio'
    }).catch((err) => console.error('[API Intake] notification log failed:', err))));
}
