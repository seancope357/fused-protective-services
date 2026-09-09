// ==============================================================================
// Twilio transport. Basic-auth REST call, no SDK.
//
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN      credentials
//   TWILIO_MESSAGING_SERVICE_SID               preferred: the A2P 10DLC
//                                              registered messaging service
//   TWILIO_FROM                                fallback: a single E.164 number
//   DISPATCH_ALERT_SMS_TO                      comma-separated E.164 recipients
//                                              for owner alerts
// ==============================================================================

export const smsConfigured = () =>
    Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM)
    );

export const ownerSmsRecipients = () =>
    (process.env.DISPATCH_ALERT_SMS_TO || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Sends one SMS. Resolves to { configured, ok, sid?, error? } and never throws.
 */
export async function sendSms({ to, body }) {
    if (!smsConfigured() || !to) return { configured: false, ok: false };

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const params = new URLSearchParams({ To: to, Body: body.slice(0, 1500) });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
    } else {
        params.set('From', process.env.TWILIO_FROM);
    }

    try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('[sms] Twilio rejected the message:', res.status, data.message || data);
            return { configured: true, ok: false, error: `twilio_${data.code || res.status}` };
        }
        return { configured: true, ok: true, sid: data.sid };
    } catch (err) {
        console.error('[sms] Twilio unreachable:', err);
        return { configured: true, ok: false, error: 'unreachable' };
    }
}
