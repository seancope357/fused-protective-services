// ==============================================================================
// ERROR REPORTING — the static site and api/ (SPEC-003)
//
// Zero dependencies, by construction: the repository root has no package.json
// and never will, so this is `console.error` plus the Resend transport that is
// already here. `app/` is a separate workspace and uses a real SDK; see
// app/src/lib/observability.ts, which emits the same key set on purpose so one
// log query answers "what broke" across both surfaces.
//
// Three promises, in order of how much they matter:
//
//   1. It never throws. A reporter that takes down the handler it was
//      reporting from has made the outage worse. Every path below is wrapped;
//      on failure it logs and returns a reported state.
//   2. It never fakes a send. Every outcome carries the same
//      { configured, ok, skipped? } shape the transports use, so a suppressed
//      alert is distinguishable from a delivered one and from a failed one.
//   3. It never storms. Ten thousand identical failures cost one email per
//      window; the ones that were held back are counted into the next.
// ==============================================================================

import { createHash } from 'node:crypto';
import { deployEnv, isProduction, suppressedOutsideProduction } from './env.mjs';
import { sendEmail, publicSender, emailConfigured } from './email.mjs';
import { rpc, supabaseConfigured } from './supabase.mjs';

/* Ordered, lowest first. `error` is the alerting threshold: below it a report
   is a log line and nothing else, which is why browser errors land at `warn`
   and a WebGL fallback lands at `info`. */
export const SEVERITIES = ['debug', 'info', 'warn', 'error', 'fatal'];
const ALERT_FROM = SEVERITIES.indexOf('error');
const rank = (severity) => {
    const i = SEVERITIES.indexOf(String(severity ?? '').toLowerCase());
    return i === -1 ? ALERT_FROM : i;
};

/** One email per distinct error per window. Overridable for a noisy incident. */
export const dedupeSeconds = () => {
    const raw = Number(process.env.ALERT_DEDUPE_SECONDS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 900;
};

/* Ops alerts have their own address so a stack trace does not page whoever is
   on the dispatch line. One inbox is better than none until there is a second,
   so it falls back to DISPATCH_ALERT_TO rather than silently going nowhere. */
export const opsRecipients = () =>
    String(process.env.OPS_ALERT_TO || process.env.DISPATCH_ALERT_TO || '')
        .split(',').map((s) => s.trim()).filter(Boolean);

const salt = () => process.env.INTAKE_HASH_SALT || 'fused-intake';

/* What counts as "the same error": the source that raised it and the message,
   with the volatile parts of the message flattened first. Without that
   flattening a message carrying a reference code, a UUID or a row count is a
   brand new error every time, the dedupe window never closes, and the storm
   this exists to stop happens anyway. */
export function alertKey(source, message) {
    const normalised = String(message ?? '')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<ts>')
        .replace(/\d+/g, '<n>')
        .trim()
        .slice(0, 300);
    return createHash('sha256').update(`${salt()}|alert|${source}|${normalised}`).digest('hex');
}

/* ---------- the dedupe window ---------- */

/* Postgres is the shared view — every function instance sees the same window,
   which is the only way a dedupe survives Fluid Compute spreading a storm
   across a dozen instances. The in-process map below is the fallback for when
   the database cannot answer: weaker, but it still turns a burst into one
   email, and it never blocks the log line. */
const memory = new Map(); // key -> { sentAt, suppressed }

export function memoryAlertGate(key, windowSeconds, now) {
    const entry = memory.get(key);
    if (entry && entry.sentAt > now - windowSeconds * 1000) {
        entry.suppressed += 1;
        return { allowed: false, suppressed: entry.suppressed, source: 'memory' };
    }
    const carried = entry ? entry.suppressed : 0;
    memory.set(key, { sentAt: now, suppressed: 0 });
    return { allowed: true, suppressed: carried, source: 'memory' };
}

/** Test seam: the in-process window is module state and must not leak between tests. */
export const resetAlertGate = () => memory.clear();

async function alertGate(key, windowSeconds, now) {
    if (supabaseConfigured()) {
        try {
            const result = await rpc('alert_gate', { p_key_hash: key, p_window_seconds: windowSeconds });
            if (result.ok && result.data && typeof result.data === 'object') {
                return {
                    allowed: Boolean(result.data.allowed),
                    suppressed: Number(result.data.suppressed) || 0,
                    source: 'database'
                };
            }
            console.error('[report] alert_gate RPC failed, using the in-process window:', result.status, result.data);
        } catch (err) {
            console.error('[report] alert_gate unreachable, using the in-process window:', err);
        }
    }
    return memoryAlertGate(key, windowSeconds, now);
}

/* ---------- the record ---------- */

/* Stable key set. Vercel's log search is a text search over the line, so the
   keys are fixed and the line is one JSON object per call: search for
   `"source":"api/intake"` and every intake failure is there. */
export function buildRecord(err, { severity = 'error', source = 'unknown', context = null, now = Date.now() } = {}) {
    const error = err instanceof Error ? err : null;
    let message;
    if (error) {
        message = `${error.name}: ${error.message}`;
    } else if (err && typeof err === 'object') {
        message = typeof err.message === 'string' ? err.message : safeJson(err);
    } else {
        message = String(err);
    }
    return {
        severity: SEVERITIES[rank(severity)],
        source: String(source).slice(0, 120),
        message: message.slice(0, 1000),
        stack: error && error.stack ? String(error.stack).slice(0, 4000) : null,
        context: context ?? null,
        env: deployEnv(),
        at: new Date(now).toISOString()
    };
}

/* A circular object or a getter that throws must not become the failure. */
function safeJson(value) {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return '[unserialisable]';
    }
}

const alertBody = (record, suppressed) => {
    const lines = [
        `${record.severity.toUpperCase()} in ${record.source}`,
        `Environment: ${record.env}`,
        `At: ${record.at}`,
        '',
        record.message,
        ''
    ];
    if (suppressed > 0) {
        lines.push(
            `${suppressed} further occurrence${suppressed === 1 ? '' : 's'} of this error ` +
            `${suppressed === 1 ? 'was' : 'were'} suppressed since the last alert. ` +
            'This message covers all of them.',
            ''
        );
    }
    if (record.context) lines.push('Context:', safeJson(record.context), '');
    if (record.stack) lines.push('Stack:', record.stack);
    return lines.join('\n');
};

/**
 * Logs one structured line, and at `error` or above emails ops — once per
 * distinct error per window, in production, when there is a verified sender
 * and somewhere to send it.
 *
 * Never throws and never rejects: a caller may await it or not, and either way
 * the handler that called it survives whatever happens in here.
 *
 * `now` is injected only by tests, so the dedupe window can be crossed without
 * waiting fifteen minutes for it.
 *
 * @param {unknown} err
 * @param {{ severity?: string, source?: string, context?: object|null, now?: number }} [options]
 * @returns {Promise<{ logged: boolean, record?: object,
 *   alert: { configured: boolean, ok: boolean, skipped?: string, suppressed?: number, error?: string } }>}
 */
export async function report(err, options = {}) {
    let record;
    try {
        record = buildRecord(err, options);
        console.error(JSON.stringify(record));
    } catch (loggingFailure) {
        /* The last line of defence. If even building the record threw, say so
           in the plainest way available and get out of the caller's way. */
        try { console.error('[report] failed to build a report:', loggingFailure); } catch { /* nothing left to try */ }
        return { logged: false, alert: { configured: false, ok: false, skipped: 'reporter_failed' } };
    }

    try {
        return { logged: true, record, alert: await alert(record, options) };
    } catch (alertFailure) {
        try { console.error('[report] alerting failed:', alertFailure); } catch { /* nothing left to try */ }
        return { logged: true, record, alert: { configured: false, ok: false, skipped: 'reporter_failed' } };
    }
}

async function alert(record, { now = Date.now() } = {}) {
    if (rank(record.severity) < ALERT_FROM) {
        return { configured: false, ok: false, skipped: 'below_alert_threshold' };
    }
    /* SPEC-002: a preview must not page anyone. Same shape and same reason
       code as every other deliberately-suppressed side effect here. */
    if (!isProduction()) return suppressedOutsideProduction();

    /* Checked before the gate, so a report that cannot possibly send does not
       consume the window, and a deployment with nothing configured makes no
       network call at all. */
    const from = publicSender();
    if (!from) return { configured: false, ok: false, skipped: 'no_verified_sender' };
    const to = opsRecipients();
    if (!to.length) return { configured: false, ok: false, skipped: 'no_recipient' };
    if (!emailConfigured()) return { configured: false, ok: false, skipped: 'not_configured' };

    const key = alertKey(record.source, record.message);
    const gate = await alertGate(key, dedupeSeconds(), now);
    if (!gate.allowed) {
        return { configured: true, ok: false, skipped: 'rate_limited', suppressed: gate.suppressed };
    }

    const result = await sendEmail({
        from,
        to,
        subject: `[FPS ${record.severity}] ${record.source}: ${record.message.slice(0, 120)}`,
        text: alertBody(record, gate.suppressed)
    });
    return { ...result, suppressed: gate.suppressed };
}

export default report;
