// ==============================================================================
// Resend transport. One function, one HTTP call, no SDK.
//
// Sender policy:
//   DISPATCH_ALERT_FROM  a verified @fusedprotectiveservices.com sender. Needed
//                        for anything that goes to a member of the public.
//   (unset)              owner alerts fall back to Resend's onboarding sender,
//                        which delivers only to the Resend account owner. That
//                        is fine for an internal alert during setup and useless
//                        for a client confirmation, so `publicSender()` returns
//                        null until the real sender is configured.
// ==============================================================================

const ONBOARDING_SENDER = 'Fused Dispatch <onboarding@resend.dev>';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export const internalSender = () => process.env.DISPATCH_ALERT_FROM || ONBOARDING_SENDER;

export const publicSender = () => {
    const from = process.env.DISPATCH_ALERT_FROM;
    return from && !/resend\.dev/i.test(from) ? from : null;
};

/**
 * Sends one email. Resolves to { configured, ok, id?, error? } and never throws,
 * so a transport failure is a reported stage outcome rather than a crash.
 */
export async function sendEmail({ from, to, subject, text, html, replyTo }) {
    const key = process.env.RESEND_API_KEY;
    const recipients = (Array.isArray(to) ? to : [to]).map((s) => String(s).trim()).filter(Boolean);
    if (!key || !from || recipients.length === 0) return { configured: false, ok: false };

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: recipients, subject, text, html, reply_to: replyTo || undefined })
        });
        if (!res.ok) {
            const detail = await res.text();
            console.error('[email] Resend rejected the message:', res.status, detail);
            return { configured: true, ok: false, error: `resend_${res.status}` };
        }
        const data = await res.json().catch(() => ({}));
        return { configured: true, ok: true, id: data.id };
    } catch (err) {
        console.error('[email] Resend unreachable:', err);
        return { configured: true, ok: false, error: 'unreachable' };
    }
}
