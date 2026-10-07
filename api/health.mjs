// ==============================================================================
// GET /api/health — the marketing site's liveness and configuration check.
//
// SPEC-004. Written on the assumption that this response is public, indexed,
// scraped and screenshotted, because it is: an external monitor polls it every
// few minutes from outside our network, and anything it returns is effectively
// published.
//
// So the rules here are about what must NOT appear, and they are stricter than
// they look:
//
//   * `configured` is booleans only. Not a key, not a prefix, not a length, not
//     a masked value. "RESEND_API_KEY starts with re_" is a fact about our key.
//   * No URL, no Supabase project ref. The project ref is the subdomain of the
//     database and naming it hands an attacker the host to attack.
//   * No stack traces and no error strings from a dependency. A Postgres error
//     can carry a table name, a column, sometimes a value.
//   * No counts of anything. "leads: 412" is a business metric, and a monitor
//     that scrapes it weekly has built a competitor's revenue model for free.
//
// A useful test of any addition: if it appeared in a screenshot on a forum,
// would it tell a stranger something we would not put on the home page? Then
// it does not belong here.
//
// The endpoint answers 200 when everything it needs is reachable and 503 when
// it is not, because that difference is the entire signal the monitor consumes.
// A missing integration key is NOT a 503: an unconfigured Twilio is a known
// state of this deployment today, not an outage, and paging someone hourly
// about it would train them to ignore the page.
// ==============================================================================

import { cors } from './_lib/http.mjs';
import { deployEnv } from './_lib/env.mjs';
import { reachable } from './_lib/supabase.mjs';

/* Kept under the monitor's own timeout so we answer with a verdict rather than
   letting the monitor time out. "Unreachable" and "no response" look identical
   on a status page and mean very different things. */
const PROBE_TIMEOUT_MS = 2500;

/** Booleans only — see the header. Presence, never any part of a value. */
function configured() {
    const has = (name) => Boolean(String(process.env[name] ?? '').trim());
    return {
        /* Email can send at all only with a key AND a verified sender; either
           one missing means client-facing mail does not go out, so report the
           pair rather than implying we are further along than we are. */
        resend: has('RESEND_API_KEY') && has('DISPATCH_ALERT_FROM'),
        twilio: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN')
            && (has('TWILIO_FROM') || has('TWILIO_MESSAGING_SERVICE_SID')),
        webhook: has('DISPATCH_ALERT_WEBHOOK') || has('HUBSPOT_WEBHOOK_URL'),
        ops_alerts: has('OPS_ALERT_TO') || has('DISPATCH_ALERT_TO')
    };
}

export default async function handler(req, res) {
    if (!cors(req, res, { methods: 'GET, OPTIONS' })) return;
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    const supabase = await reachable({ timeoutMs: PROBE_TIMEOUT_MS });

    /* Persistence is the only hard dependency of this surface: without it an
       intake submission cannot be stored. Email and SMS degrade honestly on
       their own and are reported, not failed on. `not_configured` is a 503 too
       — a deployment that cannot store a lead is not healthy, whatever the
       reason — but it is named distinctly so the fix is obvious. */
    const ok = supabase === 'ok';

    /* cors() already set Cache-Control: no-store. Stated again because a cached
       health check is a lie with a timestamp on it, and the next person to edit
       cors() needs to know something depends on that header. */
    res.setHeader('Cache-Control', 'no-store');

    return res.status(ok ? 200 : 503).json({
        ok,
        env: deployEnv(),
        checks: { supabase },
        configured: configured(),
        at: new Date().toISOString()
    });
}
