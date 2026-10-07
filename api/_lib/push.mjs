// ==============================================================================
// Telegram Bot API transport, for OWNER alerts only. Basic fetch, no SDK.
//
//   TELEGRAM_BOT_TOKEN        from @BotFather
//   TELEGRAM_ALERT_CHAT_IDS   comma-separated chat ids that receive owner
//                             alerts (Cameron's phone, Sean's phone, or a
//                             small group chat)
//
// Why this exists: A2P 10DLC registration needs an EIN and takes business
// days, and it was the longest pole on the launch path (GO_LIVE B3). Every
// SMS it was blocking on the owner path is the business paging ITSELF -- no
// carrier registration, no consumer consent, no STOP list required. Telegram
// is free and delivers to a phone immediately.
//
// This transport is deliberately NOT used for client-facing messages. A
// client has no chat id, and texting a consumer is precisely what 10DLC
// governs; `sms.mjs` stays in place for that and stays unconfigured until a
// real carrier route exists.
//
// No `parse_mode` is set, so the message is plain text. That is a safety
// property, not an oversight: lead names and client notes flow into these
// bodies, and Markdown/HTML parse modes would let an apostrophe or an
// underscore in a real name break the send -- or inject formatting.
// ==============================================================================

const API = 'https://api.telegram.org';

export const pushConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export const ownerPushRecipients = () =>
    (process.env.TELEGRAM_ALERT_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Sends one Telegram message. Resolves to { configured, ok, id?, error? } and
 * never throws -- the same contract as sendEmail and sendSms, so the
 * notification engine and the intake function treat all transports alike.
 * @param {{ to: string, body: string }} message
 * @returns {Promise<{ configured: boolean, ok: boolean, id?: string, error?: string }>}
 */
export async function sendPush({ to, body }) {
    if (!pushConfigured() || !to) return { configured: false, ok: false };

    const token = process.env.TELEGRAM_BOT_TOKEN;
    try {
        const res = await fetch(`${API}/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: to,
                text: body.slice(0, 4096),
                disable_web_page_preview: true
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok !== true) {
            /* The token is a credential and must never reach a log line, so the
               error carries Telegram's own code and description only. */
            console.error('[push] Telegram rejected the message:', res.status, data.description || '');
            return { configured: true, ok: false, error: `telegram_${data.error_code || res.status}` };
        }
        return { configured: true, ok: true, id: String(data.result?.message_id ?? '') };
    } catch (err) {
        console.error('[push] Telegram unreachable:', err);
        return { configured: true, ok: false, error: 'unreachable' };
    }
}
