/* ==========================================================================
   The portal's reporter (SPEC-003).

   The static side's half of this lives in tests/report.test.mjs at the
   repository root; the two are deliberately asymmetric — no SDK is allowed
   there and one is allowed here — so this file checks the things that are
   specific to the portal, and the one thing that must be identical: the key
   set, so a single log query answers "what broke" across both surfaces.

   Acceptance 9 is the one to read first. SENTRY_DSN absent is the normal
   state today, and nothing may throw in it.
   ========================================================================== */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    report, buildRecord, initSentry, sentryConfigured, alertKey, opsRecipients,
    memoryAlertGate, resetAlertGate, dedupeSeconds, SEVERITIES
} from '@/lib/observability';
import { reporting } from '@/lib/actions/util';
import { buildCsp } from '@/lib/supabase/proxy';

const saved = { ...process.env };

const CONFIGURED = {
    RESEND_API_KEY: 'k',
    DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
    OPS_ALERT_TO: 'ops@fusedprotectiveservices.com',
    VERCEL_ENV: 'production'
};

/** Everything console.error wrote, as the structured records it wrote them as. */
function captureLogs() {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(' '));
    });
    return {
        lines,
        records: () => lines.flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }),
        restore: () => spy.mockRestore()
    };
}

/** Stubs global fetch so the Resend transport never leaves the process. */
function stubFetch() {
    const calls: { url: string; body: unknown }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: { body?: string } = {}) => {
        calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
        return {
            ok: true, status: 200,
            json: async () => ({ id: 'email_1' }),
            text: async () => '{"id":"email_1"}'
        };
    }) as unknown as typeof fetch;
    return { calls, restore: () => { globalThis.fetch = original; } };
}

beforeEach(() => {
    resetAlertGate();
    process.env = {
        ...saved,
        SENTRY_DSN: undefined,
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        RESEND_API_KEY: undefined,
        DISPATCH_ALERT_FROM: undefined,
        DISPATCH_ALERT_TO: undefined,
        OPS_ALERT_TO: undefined,
        ALERT_DEDUPE_SECONDS: undefined,
        INTAKE_HASH_SALT: 'test-salt',
        VERCEL_ENV: 'production'
    } as NodeJS.ProcessEnv;
});
afterEach(() => { process.env = { ...saved }; });

describe('the structured record', () => {
    it('carries the same key set as the static side, so one log query covers both', async () => {
        const log = captureLogs();
        const result = await report(new TypeError('boom'), {
            severity: 'warn', source: 'app/test', context: { invoiceId: 'inv-1' }
        });
        log.restore();

        expect(log.lines).toHaveLength(1);
        const record = log.records()[0];
        expect(Object.keys(record).sort())
            .toEqual(['at', 'context', 'env', 'message', 'severity', 'source', 'stack'].sort());
        expect(record.severity).toBe('warn');
        expect(record.message).toBe('TypeError: boom');
        expect(record.env).toBe('production');
        expect(record.context).toEqual({ invoiceId: 'inv-1' });
        expect(result.logged).toBe(true);
    });

    it('has the same severity ladder and the same alert key as the static side', async () => {
        expect(SEVERITIES).toEqual(['debug', 'info', 'warn', 'error', 'fatal']);
        /* Identical inputs must hash identically or the two surfaces keep two
           windows and one incident sends two emails. The static side hashes
           with node:crypto and this side with Web Crypto — same SHA-256 over
           the same bytes — so the expected digest is pinned here rather than
           compared against a second call that could drift with it. */
        expect(await alertKey('api/intake', 'insert failed after 12 rows'))
            .toBe(await alertKey('api/intake', 'insert failed after 99 rows'));
        expect(await alertKey('api/intake', 'insert failed after 12 rows'))
            .not.toBe(await alertKey('api/intake', 'an unrelated failure'));
        expect(await alertKey('api/intake', 'x')).toMatch(/^[0-9a-f]{64}$/);
        expect(buildRecord(new Error('x'), { severity: 'nonsense' as never }).severity).toBe('error');
    });

    it('hashes identically to the static side, so one incident is one email', async () => {
        /* The two reporters share public.alert_gate. If their keys ever drift
           apart the window silently stops working across surfaces — the same
           Supabase outage seen from api/intake and from the portal would send
           two emails and each would under-count. scripts/sync-shared.mjs
           mirrors the static module here, so both can be called side by side. */
        const staticSide = await import('../shared/api/_lib/report.mjs');
        for (const [source, message] of [
            ['api/intake', 'Supabase insert into client_quotes failed with 503'],
            ['app/cron/tick', 'TypeError: cannot read properties of null'],
            ['api/intake', 'insert 3f2a9c1e-0000-4000-8000-0123456789ab failed at 2026-09-14T12:00:00Z']
        ]) {
            expect(await alertKey(source, message)).toBe(staticSide.alertKey(source, message));
        }
    });

    it('survives being handed something unserialisable', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => buildRecord(circular, { source: 'x' })).not.toThrow();
        expect(buildRecord(undefined).message).toBe('undefined');
    });
});

/* ---------- Acceptance 9 ---------- */

describe('without SENTRY_DSN', () => {
    it('initSentry is a no-op that says so and returns false', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(sentryConfigured()).toBe(false);
        expect(() => initSentry()).not.toThrow();
        expect(initSentry()).toBe(false);
        expect(warn.mock.calls.length).toBeGreaterThan(0);
        expect(JSON.parse(String(warn.mock.calls[0][0])).message).toMatch(/SENTRY_DSN is not set/);
        warn.mockRestore();
    });

    it('report still logs, and still emails, so the portal is not blind today', async () => {
        process.env = { ...process.env, ...CONFIGURED } as NodeJS.ProcessEnv;
        const log = captureLogs();
        const f = stubFetch();
        const result = await report(new Error('the webhook fell over'), {
            severity: 'error', source: 'app/api/stripe/webhook'
        });
        f.restore(); log.restore();

        expect(sentryConfigured()).toBe(false);
        expect(result.alert.ok).toBe(true);
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0].url).toBe('https://api.resend.com/emails');
    });
});

/* ---------- Honest degradation, same reason codes as the static side ---------- */

describe('degradation', () => {
    it('sends nothing outside production and says why (SPEC-002)', async () => {
        for (const environment of ['preview', 'development', undefined]) {
            resetAlertGate();
            process.env = { ...process.env, ...CONFIGURED, VERCEL_ENV: environment } as NodeJS.ProcessEnv;
            const log = captureLogs();
            const f = stubFetch();
            const result = await report(new Error('boom'), { severity: 'error', source: 's' });
            f.restore(); log.restore();

            expect(result.alert).toEqual({ configured: false, ok: false, skipped: 'non_production_env' });
            expect(f.calls).toHaveLength(0);
            expect(result.logged).toBe(true);
        }
    });

    it('reports no_verified_sender rather than pretending, and does not throw', async () => {
        process.env = { ...process.env, RESEND_API_KEY: 'k', OPS_ALERT_TO: 'ops@example.com' } as NodeJS.ProcessEnv;
        const log = captureLogs();
        const f = stubFetch();
        const result = await report(new Error('boom'), { severity: 'error', source: 's' });
        f.restore(); log.restore();
        expect(result.alert).toEqual({ configured: false, ok: false, skipped: 'no_verified_sender' });
        expect(f.calls).toHaveLength(0);
    });

    it('distinguishes nowhere-to-send from nothing-to-send-with', async () => {
        process.env = { ...process.env, ...CONFIGURED, OPS_ALERT_TO: undefined } as NodeJS.ProcessEnv;
        let log = captureLogs();
        expect((await report(new Error('b'), { severity: 'error', source: 's' })).alert.skipped).toBe('no_recipient');
        log.restore();

        process.env = { ...process.env, ...CONFIGURED, RESEND_API_KEY: undefined } as NodeJS.ProcessEnv;
        log = captureLogs();
        expect((await report(new Error('b'), { severity: 'error', source: 's' })).alert.skipped).toBe('not_configured');
        log.restore();
    });

    it('falls back from OPS_ALERT_TO to DISPATCH_ALERT_TO: one inbox beats none', () => {
        process.env = { ...process.env, DISPATCH_ALERT_TO: 'owner@example.com' } as NodeJS.ProcessEnv;
        expect(opsRecipients()).toEqual(['owner@example.com']);
        process.env = { ...process.env, OPS_ALERT_TO: 'ops@example.com' } as NodeJS.ProcessEnv;
        expect(opsRecipients()).toEqual(['ops@example.com']);
    });

    it('does not email below the alert threshold', async () => {
        process.env = { ...process.env, ...CONFIGURED } as NodeJS.ProcessEnv;
        const log = captureLogs();
        const f = stubFetch();
        const result = await report(new Error('noise'), { severity: 'info', source: 's' });
        f.restore(); log.restore();
        expect(result.alert.skipped).toBe('below_alert_threshold');
        expect(f.calls).toHaveLength(0);
    });
});

/* ---------- The window ---------- */

describe('the dedupe window', () => {
    it('sends once per window and carries the suppressed count into the next email', async () => {
        process.env = { ...process.env, ...CONFIGURED } as NodeJS.ProcessEnv;
        const log = captureLogs();
        const f = stubFetch();
        const at = Date.UTC(2026, 8, 14, 12, 0, 0);
        for (let i = 0; i < 50; i++) {
            await report(new Error('the same failure'), { severity: 'error', source: 'app/cron/tick', now: at + i });
        }
        await report(new Error('the same failure'), {
            severity: 'error', source: 'app/cron/tick', now: at + dedupeSeconds() * 1000 + 1
        });
        f.restore(); log.restore();

        expect(f.calls).toHaveLength(2);
        expect(String((f.calls[1].body as { text: string }).text)).toMatch(/49 further occurrences/);
    });

    it('counts in the in-process window when the database cannot answer', () => {
        const at = 1_000_000;
        expect(memoryAlertGate('k', 900, at)).toEqual({ allowed: true, suppressed: 0 });
        expect(memoryAlertGate('k', 900, at + 1)).toEqual({ allowed: false, suppressed: 1 });
        expect(memoryAlertGate('k', 900, at + 900_001)).toEqual({ allowed: true, suppressed: 1 });
    });
});

/* ---------- Acceptance 5, on this surface too ---------- */

describe('the reporter cannot take down its caller', () => {
    it('a transport that throws never reaches the handler', async () => {
        process.env = { ...process.env, ...CONFIGURED } as NodeJS.ProcessEnv;
        const original = globalThis.fetch;
        globalThis.fetch = (async () => { throw new Error('the transport exploded'); }) as unknown as typeof fetch;
        const log = captureLogs();
        let handlerReturned: string | null = null;
        try {
            const handler = async () => {
                await report(new Error('original failure'), { severity: 'error', source: 'app/api/stripe/webhook' });
                return 'the handler finished';
            };
            handlerReturned = await handler();
        } finally {
            globalThis.fetch = original;
            log.restore();
        }
        expect(handlerReturned).toBe('the handler finished');
    });

    it('report never rejects, whatever it is handed', async () => {
        process.env = { ...process.env, ...CONFIGURED } as NodeJS.ProcessEnv;
        const log = captureLogs();
        const f = stubFetch();
        const results = await Promise.all([
            report(undefined, { severity: 'error', source: 's' }),
            report(null, { severity: 'error', source: 's' }),
            report('a bare string', { severity: 'error', source: 's' }),
            report({ get message(): string { throw new Error('getter'); } }, { severity: 'error', source: 's' })
        ]);
        f.restore(); log.restore();
        expect(results).toHaveLength(4);
        for (const r of results) expect(typeof r.alert).toBe('object');
    });
});

/* ---------- The server-action wrapper ---------- */

describe('reporting(): the server-action wrapper', () => {
    it('reports the failure and rethrows it, so the error boundary still renders', async () => {
        const log = captureLogs();
        const boom = new Error('the action fell over');
        const wrapped = reporting('updateLeadStatus', async () => { throw boom; });
        await expect(wrapped()).rejects.toThrow('the action fell over');
        log.restore();

        const record = log.records().find((r) => r.source === 'action/updateLeadStatus');
        expect(record).toBeTruthy();
        expect(record.severity).toBe('error');
        expect(record.message).toBe('Error: the action fell over');
    });

    it('never reports a redirect, and lets it through untouched', async () => {
        /* Every successful action in this codebase ends in done(), which
           redirects, and redirect() signals itself by throwing. A wrapper that
           got this wrong would report every success as a failure and — far
           worse — swallow the navigation. */
        const { redirect } = await import('next/navigation');
        const log = captureLogs();
        const wrapped = reporting('convertLeadToQuote', async () => { redirect('/portal/quotes/new'); });
        await expect(wrapped()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
        log.restore();

        expect(log.records().filter((r) => String(r.source).startsWith('action/'))).toHaveLength(0);
    });

    it('returns whatever the action returned when nothing goes wrong', async () => {
        const wrapped = reporting('ok', async (a: number, b: number) => a + b);
        await expect(wrapped(2, 3)).resolves.toBe(5);
    });

    it('reports the action, not the form: no field value is ever in the record', async () => {
        const log = captureLogs();
        const fd = new FormData();
        fd.set('email', 'client@example.com');
        fd.set('phone', '+15125550100');
        const wrapped = reporting('saveSite', async (_form: FormData) => { throw new Error('insert failed'); });
        await expect(wrapped(fd)).rejects.toThrow();
        log.restore();

        const everything = log.lines.join('\n');
        expect(everything).not.toMatch(/client@example\.com/);
        expect(everything).not.toMatch(/5125550100/);
        expect(log.records().find((r) => r.source === 'action/saveSite').context).toEqual({ arity: 1 });
    });
});

/* ---------- The security-policy question, answered in a test ---------- */

describe('the portal CSP and the Sentry SDK', () => {
    it('stays as tight as it was: no ingest origin in connect-src', () => {
        /* SPEC-003 §4 asks for a Sentry SDK. This deployment runs it in the
           server and edge runtimes only (src/instrumentation.ts explains why),
           and a server-side SDK posts from the server process, which no
           content security policy governs. So the policy did not need
           widening and was not widened — asserted here rather than left to be
           re-derived, because the day somebody adds a browser SDK this test
           is what tells them a security review is due. */
        process.env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co' } as NodeJS.ProcessEnv;
        const csp = buildCsp('abc123');
        const connect = csp.split('; ').find((d) => d.startsWith('connect-src'));
        expect(connect).toBe("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
        expect(csp).not.toMatch(/sentry/i);
        expect(csp).not.toMatch(/ingest/i);
        expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    });
});
