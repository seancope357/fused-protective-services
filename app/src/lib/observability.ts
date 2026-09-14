import 'server-only';
/* ==========================================================================
   ERROR REPORTING — the portal (SPEC-003)

   The mirror of api/_lib/report.mjs, and deliberately asymmetric with it.
   The repository root has no package.json and never will, so the static side
   is console.error plus the Resend transport. `app/` already carries
   dependencies and is where money moves, so it gets a real SDK: stack traces,
   release tagging and grouping are worth one dependency where payments live.

   The two emit the same key set on purpose — severity, source, message,
   stack, context, env, at — so one log query answers "what broke" across both
   surfaces without knowing which one it is asking about.

   THE PROMISES ARE THE SAME THREE.

   1. It never throws. Every path is wrapped. A reporter that takes down the
      handler it was reporting from has made the outage worse, and a webhook
      that dies inside its own error handler loses the payment event twice.
   2. It never fakes a send. Outcomes carry the { configured, ok, skipped }
      shape the transports use.
   3. It never storms. The same public.alert_gate window the static side uses,
      so a failure reported from both surfaces is still one email.

   WHAT SENTRY IS AND IS NOT CONFIGURED TO DO.
   Errors only. `tracesSampleRate: 0`, no session replay, no profiling, no
   performance data, `sendDefaultPii: false`. The privacy policy says we do
   not gather that, so the code says it too — and none of it is a setting a
   future edit should quietly flip.

   SERVER AND EDGE ONLY. There is no browser SDK here, on purpose: see
   src/instrumentation.ts for why, and for what to add if that changes.
   ========================================================================== */

import * as Sentry from '@sentry/nextjs';
import { deployEnv, isProduction, NON_PRODUCTION_REASON } from '@/lib/env';
import { sendEmail, publicSender, emailConfigured } from '@/lib/transports';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const SEVERITIES = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type Severity = (typeof SEVERITIES)[number];

const ALERT_FROM = SEVERITIES.indexOf('error');
const rank = (severity: string): number => {
    const i = (SEVERITIES as readonly string[]).indexOf(String(severity).toLowerCase());
    return i === -1 ? ALERT_FROM : i;
};

export type ErrorRecord = {
    severity: Severity;
    source: string;
    message: string;
    stack: string | null;
    context: Record<string, unknown> | null;
    env: string;
    at: string;
};

export type AlertOutcome = {
    configured: boolean;
    ok: boolean;
    skipped?: string;
    suppressed?: number;
    error?: string;
};

export type ReportResult = { logged: boolean; record?: ErrorRecord; alert: AlertOutcome };

export type ReportOptions = {
    severity?: Severity;
    source?: string;
    context?: Record<string, unknown> | null;
    /** Overrides the severity rule: force an email on, or off. */
    alert?: boolean;
    /** Injected only by tests, so the dedupe window can be crossed. */
    now?: number;
};

/* ---------- configuration ---------- */

export const sentryConfigured = (): boolean => Boolean(process.env.SENTRY_DSN);

/** One email per distinct error per window. Overridable for a noisy incident. */
export const dedupeSeconds = (): number => {
    const raw = Number(process.env.ALERT_DEDUPE_SECONDS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 900;
};

/* Same fallback the static side uses: a stack trace should not page whoever is
   on the dispatch line, but one inbox is better than none. */
export const opsRecipients = (): string[] =>
    String(process.env.OPS_ALERT_TO || process.env.DISPATCH_ALERT_TO || '')
        .split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Called once per runtime from src/instrumentation.ts.
 *
 * Without SENTRY_DSN this is a no-op that says so and returns — which is the
 * normal state today. It must not throw in that state, and it must not throw
 * in any other: a portal that will not boot because its error reporter would
 * not start is a worse portal than one with no error reporter.
 */
export function initSentry(): boolean {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.warn(JSON.stringify({
            severity: 'info',
            source: 'app/observability',
            message: 'SENTRY_DSN is not set; error reporting is log-only.',
            stack: null,
            context: null,
            env: deployEnv(),
            at: new Date().toISOString()
        }));
        return false;
    }
    try {
        Sentry.init({
            dsn,
            environment: deployEnv(),
            release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
            /* Errors only. Every one of these is a privacy commitment, not a
               cost control: the privacy policy says we do not collect
               performance traces, session recordings or personal data, so
               none of it is switched on and none of it should be. */
            tracesSampleRate: 0,
            profilesSampleRate: 0,
            sendDefaultPii: false,
            integrations: (defaults) =>
                /* Request bodies and headers are where a client's name, phone
                   number and site address live. A stack trace is what we came
                   for; the request that produced it is not. */
                defaults.filter((i) => i.name !== 'RequestData'),
            beforeSend(event) {
                delete event.request;
                delete event.user;
                return event;
            }
        });
        return true;
    } catch (err) {
        console.error('[observability] Sentry failed to initialise; continuing without it:', err);
        return false;
    }
}

/* ---------- the record ---------- */

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return '[unserialisable]';
    }
}

export function buildRecord(err: unknown, options: ReportOptions = {}): ErrorRecord {
    const { severity = 'error', source = 'unknown', context = null, now = Date.now() } = options;
    const error = err instanceof Error ? err : null;
    let message: string;
    if (error) {
        message = `${error.name}: ${error.message}`;
    } else if (err && typeof err === 'object') {
        const maybe = (err as { message?: unknown }).message;
        message = typeof maybe === 'string' ? maybe : safeJson(err);
    } else {
        message = String(err);
    }
    return {
        severity: SEVERITIES[rank(severity)],
        source: String(source).slice(0, 120),
        message: message.slice(0, 1000),
        stack: error?.stack ? String(error.stack).slice(0, 4000) : null,
        context,
        env: deployEnv(),
        at: new Date(now).toISOString()
    };
}

/* ---------- the shared dedupe window ---------- */

const salt = () => process.env.INTAKE_HASH_SALT || 'fused-intake';

/**
 * Matches api/_lib/report.mjs exactly, so both surfaces share one window and
 * one incident costs one email rather than two.
 *
 * Web Crypto rather than node:crypto, and therefore async: this module is
 * reached from src/instrumentation.ts, which Next bundles for the Edge runtime
 * as well as Node, and `node:crypto` is not available there. It is the same
 * SHA-256 over the same input, so the two surfaces still agree byte for byte.
 */
export async function alertKey(source: string, message: string): Promise<string> {
    const normalised = String(message ?? '')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<ts>')
        .replace(/\d+/g, '<n>')
        .trim()
        .slice(0, 300);
    const bytes = new TextEncoder().encode(`${salt()}|alert|${source}|${normalised}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const memory = new Map<string, { sentAt: number; suppressed: number }>();

export function memoryAlertGate(key: string, windowSeconds: number, now: number) {
    const entry = memory.get(key);
    if (entry && entry.sentAt > now - windowSeconds * 1000) {
        entry.suppressed += 1;
        return { allowed: false, suppressed: entry.suppressed };
    }
    const carried = entry ? entry.suppressed : 0;
    memory.set(key, { sentAt: now, suppressed: 0 });
    return { allowed: true, suppressed: carried };
}

/** Test seam: module state must not leak between tests. */
export const resetAlertGate = (): void => memory.clear();

async function alertGate(key: string, windowSeconds: number, now: number) {
    try {
        const { data, error } = await supabaseAdmin().rpc('alert_gate', {
            p_key_hash: key,
            p_window_seconds: windowSeconds
        });
        if (!error && data && typeof data === 'object') {
            const v = data as { allowed?: boolean; suppressed?: number };
            return { allowed: Boolean(v.allowed), suppressed: Number(v.suppressed) || 0 };
        }
        console.error('[observability] alert_gate unavailable, using the in-process window:', error?.message);
    } catch (err) {
        console.error('[observability] alert_gate unreachable, using the in-process window:', err);
    }
    return memoryAlertGate(key, windowSeconds, now);
}

/* ---------- reporting ---------- */

const alertBody = (record: ErrorRecord, suppressed: number): string => {
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

async function alert(record: ErrorRecord, options: ReportOptions): Promise<AlertOutcome> {
    const wanted = options.alert ?? rank(record.severity) >= ALERT_FROM;
    if (!wanted) return { configured: false, ok: false, skipped: 'below_alert_threshold' };
    /* SPEC-002: a preview must not page anyone. */
    if (!isProduction()) return { configured: false, ok: false, skipped: NON_PRODUCTION_REASON };

    /* Checked before the gate so a report that cannot send does not consume
       the window, and an unconfigured deployment makes no call at all. */
    const from = publicSender();
    if (!from) return { configured: false, ok: false, skipped: 'no_verified_sender' };
    const to = opsRecipients();
    if (!to.length) return { configured: false, ok: false, skipped: 'no_recipient' };
    if (!emailConfigured()) return { configured: false, ok: false, skipped: 'not_configured' };

    const key = await alertKey(record.source, record.message);
    const gate = await alertGate(key, dedupeSeconds(), options.now ?? Date.now());
    if (!gate.allowed) return { configured: true, ok: false, skipped: 'rate_limited', suppressed: gate.suppressed };

    const result = await sendEmail({
        from,
        to: to.join(', '),
        subject: `[FPS ${record.severity}] ${record.source}: ${record.message.slice(0, 120)}`,
        text: alertBody(record, gate.suppressed),
        html: ''
    });
    return { ...result, suppressed: gate.suppressed };
}

/**
 * Logs one structured line, hands the error to Sentry when there is a DSN,
 * and at `error` or above emails ops — once per distinct error per window, in
 * production, when there is a verified sender and somewhere to send it.
 *
 * Never throws and never rejects. A caller may await it or not.
 */
export async function report(err: unknown, options: ReportOptions = {}): Promise<ReportResult> {
    let record: ErrorRecord;
    try {
        record = buildRecord(err, options);
        console.error(JSON.stringify(record));
    } catch (loggingFailure) {
        try { console.error('[observability] failed to build a report:', loggingFailure); } catch { /* nothing left */ }
        return { logged: false, alert: { configured: false, ok: false, skipped: 'reporter_failed' } };
    }

    try {
        if (sentryConfigured()) {
            Sentry.captureException(err instanceof Error ? err : new Error(record.message), {
                level: record.severity === 'warn' ? 'warning' : record.severity,
                tags: { source: record.source, deploy_env: record.env },
                extra: record.context ?? undefined
            });
        }
    } catch (sentryFailure) {
        try { console.error('[observability] Sentry capture failed:', sentryFailure); } catch { /* nothing left */ }
    }

    try {
        return { logged: true, record, alert: await alert(record, options) };
    } catch (alertFailure) {
        try { console.error('[observability] alerting failed:', alertFailure); } catch { /* nothing left */ }
        return { logged: true, record, alert: { configured: false, ok: false, skipped: 'reporter_failed' } };
    }
}

export default report;
