/* ==========================================================================
   api/_lib/report.mjs under node --test. No network: fetch is stubbed.

   The property that matters most here is the one in acceptance 5 — a reporter
   that throws must never reach the handler it was reporting from. It is not
   asserted by reading the code; it is asserted by making the transport throw
   and by making console.error itself throw, and checking that the caller
   still gets an answer.
   ========================================================================== */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    report, buildRecord, alertKey, memoryAlertGate, resetAlertGate,
    opsRecipients, dedupeSeconds, SEVERITIES
} from '../api/_lib/report.mjs';
import { stubFetch, withEnv } from './helpers/http.mjs';

const CLEAR = {
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    DISPATCH_ALERT_TO: undefined,
    DISPATCH_ALERT_FROM: undefined,
    OPS_ALERT_TO: undefined,
    ALERT_DEDUPE_SECONDS: undefined,
    INTAKE_HASH_SALT: 'test-salt',
    VERCEL_ENV: 'production',
    NODE_ENV: 'test'
};

/* The alerting configuration in full: a verified sender, a key, an inbox. */
const CONFIGURED = {
    RESEND_API_KEY: 'k',
    DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
    OPS_ALERT_TO: 'ops@fusedprotectiveservices.com'
};

let env;
before(() => { env = withEnv(CLEAR); });
after(() => env.restore());
beforeEach(() => resetAlertGate());

/** Runs `fn` with console.error captured, and returns every line it wrote. */
async function capturingLogs(fn) {
    const lines = [];
    const original = console.error;
    console.error = (...args) => lines.push(args.map(String).join(' '));
    try {
        return { result: await fn(), lines };
    } finally {
        console.error = original;
    }
}

const emailsIn = (calls) =>
    calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.init.body));

/* ---------- Acceptance 1: one structured line, stable keys ---------- */

test('report emits exactly one structured JSON line with the stable key set', async () => {
    const f = stubFetch(() => null);
    const { result, lines } = await capturingLogs(() =>
        report(new TypeError('boom'), { severity: 'warn', source: 'api/test', context: { refCode: 'TX-FPS-ABC123' } })
    );
    f.restore();

    assert.equal(lines.length, 1, 'exactly one line');
    const record = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(record).sort(), ['at', 'context', 'env', 'message', 'severity', 'source', 'stack'].sort());
    assert.equal(record.severity, 'warn');
    assert.equal(record.source, 'api/test');
    assert.equal(record.message, 'TypeError: boom');
    assert.equal(record.env, 'production');
    assert.deepEqual(record.context, { refCode: 'TX-FPS-ABC123' });
    assert.match(record.stack, /TypeError: boom/);
    assert.match(record.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(result.logged, true);
});

test('a non-Error is still reported, with a null stack rather than a fabricated one', () => {
    const record = buildRecord({ message: 'plain object' }, { source: 'browser/error' });
    assert.equal(record.message, 'plain object');
    assert.equal(record.stack, null);

    /* A circular object must not become the failure it was reporting. */
    const circular = {};
    circular.self = circular;
    assert.doesNotThrow(() => buildRecord(circular, { source: 'x' }));
});

test('an unknown severity is treated as error, not silently dropped below the threshold', () => {
    assert.equal(buildRecord(new Error('x'), { severity: 'catastrophic' }).severity, 'error');
    assert.deepEqual(SEVERITIES, ['debug', 'info', 'warn', 'error', 'fatal']);
});

/* ---------- Acceptance 2: one email, then a counted silence ---------- */

test('at error severity in production it sends exactly one email', async () => {
    const e = withEnv(CONFIGURED);
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'email_1' } } : null));
    const { result } = await capturingLogs(() =>
        report(new Error('the database is on fire'), { severity: 'error', source: 'api/intake' })
    );
    f.restore(); e.restore();

    assert.equal(result.alert.ok, true);
    const [mail] = emailsIn(f.calls);
    assert.equal(emailsIn(f.calls).length, 1);
    assert.deepEqual(mail.to, ['ops@fusedprotectiveservices.com']);
    assert.match(mail.subject, /\[FPS error\] api\/intake/);
    assert.match(mail.text, /the database is on fire/);
    assert.match(mail.text, /Environment: production/);
    assert.doesNotMatch(mail.text, /suppressed/, 'the first alert has nothing to carry');
});

test('a second identical error inside the window sends nothing and is counted', async () => {
    const e = withEnv(CONFIGURED);
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const at = Date.UTC(2026, 8, 14, 12, 0, 0);
    const { result: second } = await capturingLogs(async () => {
        await report(new Error('same failure'), { severity: 'error', source: 'api/intake', now: at });
        return report(new Error('same failure'), { severity: 'error', source: 'api/intake', now: at + 1000 });
    });
    f.restore(); e.restore();

    assert.equal(emailsIn(f.calls).length, 1, 'the second is suppressed');
    assert.equal(second.alert.ok, false);
    assert.equal(second.alert.skipped, 'rate_limited');
    assert.equal(second.alert.suppressed, 1);
    assert.equal(second.logged, true, 'suppressing the email never suppresses the log line');
});

test('ten thousand failures cost two emails, and the second says how many it covers', async () => {
    const e = withEnv(CONFIGURED);
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const start = Date.UTC(2026, 8, 14, 12, 0, 0);

    await capturingLogs(async () => {
        for (let i = 0; i < 10_000; i++) {
            /* Each message carries a different row count, so this also proves
               the alert key flattens the volatile parts: without that every
               occurrence is a new error and the window never closes. */
            await report(new Error(`Supabase insert failed after ${i} rows`), {
                severity: 'error', source: 'api/intake', now: start + i
            });
        }
        /* The window has closed. The next occurrence sends, carrying the rest. */
        await report(new Error('Supabase insert failed after 10000 rows'), {
            severity: 'error', source: 'api/intake', now: start + dedupeSeconds() * 1000 + 1
        });
    });
    f.restore(); e.restore();

    const mails = emailsIn(f.calls);
    assert.equal(mails.length, 2, 'ten thousand failures, two emails');
    assert.doesNotMatch(mails[0].text, /suppressed/);
    assert.match(mails[1].text, /9,?999 further occurrences of this error were suppressed/);
});

test('a different source is a different error and is not deduplicated against', async () => {
    const e = withEnv(CONFIGURED);
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const at = Date.UTC(2026, 8, 14, 12, 0, 0);
    await capturingLogs(async () => {
        await report(new Error('timeout'), { severity: 'error', source: 'api/intake', now: at });
        await report(new Error('timeout'), { severity: 'error', source: 'api/client-error', now: at });
    });
    f.restore(); e.restore();
    assert.equal(emailsIn(f.calls).length, 2);
});

test('the alert key flattens ids and timestamps so one incident is one key', () => {
    const a = alertKey('api/intake', 'insert 3f2a9c1e-0000-4000-8000-0123456789ab failed at 2026-09-14T12:00:00Z');
    const b = alertKey('api/intake', 'insert 9c1e3f2a-1111-4000-8000-ba9876543210 failed at 2026-09-14T13:05:11Z');
    assert.equal(a, b);
    assert.notEqual(a, alertKey('api/intake', 'a completely different failure'));
});

test('the in-process window carries the suppressed count across the boundary', () => {
    const at = 1_000_000;
    assert.deepEqual(memoryAlertGate('k', 900, at), { allowed: true, suppressed: 0, source: 'memory' });
    assert.equal(memoryAlertGate('k', 900, at + 1).suppressed, 1);
    assert.equal(memoryAlertGate('k', 900, at + 2).allowed, false);
    assert.equal(memoryAlertGate('k', 900, at + 3).suppressed, 3);
    const next = memoryAlertGate('k', 900, at + 900_001);
    assert.equal(next.allowed, true, 'the window has closed');
    assert.equal(next.suppressed, 3, 'and the next alert carries everything held back');
    assert.equal(memoryAlertGate('k', 900, at + 900_002).suppressed, 1, 'the counter restarts after it is carried');
});

/* ---------- Acceptance 3 and 4: honest degradation ---------- */

test('outside production it sends nothing and logs the skip (SPEC-002)', async () => {
    for (const environment of ['preview', 'development', undefined]) {
        resetAlertGate();
        const e = withEnv({ ...CONFIGURED, VERCEL_ENV: environment });
        const f = stubFetch(() => null);
        const { result } = await capturingLogs(() =>
            report(new Error('boom'), { severity: 'error', source: 'api/intake' })
        );
        f.restore(); e.restore();

        assert.deepEqual(result.alert, { configured: false, ok: false, skipped: 'non_production_env' },
            `VERCEL_ENV=${environment}`);
        assert.equal(f.calls.length, 0, `no network at all on ${environment}`);
        assert.equal(result.logged, true, 'the log line is not an environment-dependent behaviour');
    }
});

test('with no verified sender it logs no_verified_sender, does not throw, and makes no call', async () => {
    for (const from of [undefined, 'Fused Dispatch <onboarding@resend.dev>']) {
        resetAlertGate();
        const e = withEnv({ RESEND_API_KEY: 'k', OPS_ALERT_TO: 'ops@example.com', DISPATCH_ALERT_FROM: from });
        const f = stubFetch(() => null);
        const { result } = await capturingLogs(() =>
            report(new Error('boom'), { severity: 'error', source: 'api/intake' })
        );
        f.restore(); e.restore();

        assert.deepEqual(result.alert, { configured: false, ok: false, skipped: 'no_verified_sender' },
            `DISPATCH_ALERT_FROM=${from}`);
        assert.equal(f.calls.length, 0);
    }
});

test('with a sender but nowhere to send it, the skip says no_recipient rather than lying', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_FROM: CONFIGURED.DISPATCH_ALERT_FROM });
    const f = stubFetch(() => null);
    const { result } = await capturingLogs(() => report(new Error('boom'), { severity: 'error', source: 's' }));
    f.restore(); e.restore();
    assert.deepEqual(result.alert, { configured: false, ok: false, skipped: 'no_recipient' });
});

test('with no Resend key the skip is not_configured, and nothing claims to have sent', async () => {
    const e = withEnv({ DISPATCH_ALERT_FROM: CONFIGURED.DISPATCH_ALERT_FROM, OPS_ALERT_TO: 'ops@example.com' });
    const f = stubFetch(() => null);
    const { result } = await capturingLogs(() => report(new Error('boom'), { severity: 'error', source: 's' }));
    f.restore(); e.restore();
    assert.deepEqual(result.alert, { configured: false, ok: false, skipped: 'not_configured' });
    assert.equal(f.calls.length, 0);
});

test('OPS_ALERT_TO falls back to DISPATCH_ALERT_TO, and one inbox is better than none', () => {
    const e = withEnv({ DISPATCH_ALERT_TO: 'owner@example.com, second@example.com' });
    try {
        assert.deepEqual(opsRecipients(), ['owner@example.com', 'second@example.com']);
    } finally { e.restore(); }

    const e2 = withEnv({ DISPATCH_ALERT_TO: 'owner@example.com', OPS_ALERT_TO: 'ops@example.com' });
    try {
        assert.deepEqual(opsRecipients(), ['ops@example.com'], 'a stack trace does not page the dispatch line');
    } finally { e2.restore(); }
});

test('below the alert threshold nothing is emailed, however configured the deployment is', async () => {
    for (const severity of ['debug', 'info', 'warn']) {
        resetAlertGate();
        const e = withEnv(CONFIGURED);
        const f = stubFetch(() => null);
        const { result } = await capturingLogs(() => report(new Error('noise'), { severity, source: 'browser/error' }));
        f.restore(); e.restore();
        assert.equal(result.alert.skipped, 'below_alert_threshold', severity);
        assert.equal(f.calls.length, 0, severity);
    }
});

/* ---------- Acceptance 5: the reporter cannot take down the handler ---------- */

test('a transport that throws is swallowed: the caller gets an answer, not an exception', async () => {
    const e = withEnv(CONFIGURED);
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('the transport exploded'); };
    let result;
    try {
        const captured = await capturingLogs(() =>
            report(new Error('original failure'), { severity: 'error', source: 'api/intake' })
        );
        result = captured.result;
    } finally { globalThis.fetch = original; e.restore(); }

    /* sendEmail catches its own transport failure, so this is a reported
       stage outcome and not a rejection — which is the whole contract. */
    assert.equal(result.logged, true);
    assert.equal(result.alert.ok, false);
    assert.equal(result.record.message, 'Error: original failure');
});

test('a handler that awaits report() survives the reporter failing at every layer', async () => {
    const e = withEnv(CONFIGURED);
    const originalFetch = globalThis.fetch;
    const originalStringify = JSON.stringify;
    const originalError = console.error;

    /* Everything the reporter could possibly lean on, broken at once:
       the transport throws, serialising the record throws, and even the log
       sink throws. A handler wrapping this must still reach its own return. */
    globalThis.fetch = async () => { throw new Error('transport'); };
    JSON.stringify = () => { throw new Error('serialiser'); };
    console.error = () => { throw new Error('log sink'); };

    let handlerReturned = null;
    try {
        /* Exactly the shape api/intake.mjs uses. */
        const handler = async () => {
            await report(new Error('boom'), { severity: 'error', source: 'api/intake' });
            return 'the handler finished';
        };
        handlerReturned = await handler();
    } finally {
        globalThis.fetch = originalFetch;
        JSON.stringify = originalStringify;
        console.error = originalError;
        e.restore();
    }

    assert.equal(handlerReturned, 'the handler finished');
});

test('report() never rejects, whatever it is handed', async () => {
    const e = withEnv(CONFIGURED);
    const f = stubFetch(() => null);
    const nasty = { get message() { throw new Error('getter'); } };
    let results;
    try {
        results = (await capturingLogs(() => Promise.all([
            report(undefined, { severity: 'error', source: 's' }),
            report(null, { severity: 'error', source: 's' }),
            report(nasty, { severity: 'error', source: 's' }),
            report(new Error('ok'), { severity: 'error', source: 's', context: { fine: true } })
        ]))).result;
    } finally { f.restore(); e.restore(); }
    assert.equal(results.length, 4);
    for (const r of results) assert.ok(typeof r.alert === 'object', 'every call answers with a stage outcome');
});

/* ---------- The shared window in Postgres ---------- */

test('when Supabase is configured the window is the database, not this instance', async () => {
    const e = withEnv({ ...CONFIGURED, SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service' });
    const f = stubFetch((url) => {
        if (url.endsWith('/rest/v1/rpc/alert_gate')) return { json: { allowed: true, suppressed: 4 } };
        if (url === 'https://api.resend.com/emails') return { json: { id: 'x' } };
        return null;
    });
    const { result } = await capturingLogs(() => report(new Error('boom'), { severity: 'error', source: 'api/intake' }));
    f.restore(); e.restore();

    const rpc = f.calls.find((c) => c.url.endsWith('/rest/v1/rpc/alert_gate'));
    assert.ok(rpc, 'the shared gate was consulted');
    const args = JSON.parse(rpc.init.body);
    assert.equal(args.p_window_seconds, 900);
    assert.match(args.p_key_hash, /^[0-9a-f]{64}$/, 'only a hash leaves the function');
    assert.equal(result.alert.ok, true);
    assert.match(emailsIn(f.calls)[0].text, /4 further occurrences/);
});

test('a database that cannot answer falls back to the in-process window rather than storming', async () => {
    const e = withEnv({ ...CONFIGURED, SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service' });
    const f = stubFetch((url) => {
        if (url.endsWith('/rest/v1/rpc/alert_gate')) return { status: 500, json: { message: 'no such function' } };
        if (url === 'https://api.resend.com/emails') return { json: { id: 'x' } };
        return null;
    });
    const at = Date.UTC(2026, 8, 14, 12, 0, 0);
    await capturingLogs(async () => {
        await report(new Error('boom'), { severity: 'error', source: 'api/intake', now: at });
        await report(new Error('boom'), { severity: 'error', source: 'api/intake', now: at + 1 });
    });
    f.restore(); e.restore();
    assert.equal(emailsIn(f.calls).length, 1, 'the weaker window is still a window');
});

test('ALERT_DEDUPE_SECONDS is honoured, and a nonsense value falls back to fifteen minutes', () => {
    for (const [raw, expected] of [[undefined, 900], ['60', 60], ['0', 900], ['-5', 900], ['abc', 900]]) {
        const e = withEnv({ ALERT_DEDUPE_SECONDS: raw });
        try {
            assert.equal(dedupeSeconds(), expected, `ALERT_DEDUPE_SECONDS=${raw}`);
        } finally { e.restore(); }
    }
});
