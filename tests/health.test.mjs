/* ==========================================================================
   api/health.mjs under node --test. No network: fetch is stubbed.

   SPEC-004 acceptance 1–3. The property this file exists to defend is not
   "the endpoint returns 200" — it is that the RESPONSE IS SAFE TO PUBLISH.

   An external monitor polls this from outside our network every few minutes.
   Whatever it returns is effectively public: indexed, scraped, pasted into a
   status page, screenshotted into a ticket. So the central test seeds every
   secret with a recognisable sentinel value and asserts that NO sentinel and
   no fragment of one appears anywhere in the serialised response.

   That is deliberately stricter than checking a list of known-bad keys. A
   future edit that helpfully adds `supabase_url` for debugging, or masks a key
   as `re_****abcd`, or includes a Postgres error string that happens to carry
   the project ref, passes a key-name check and fails this one.
   ========================================================================== */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/health.mjs';
import { makeReq, makeRes, stubFetch, withEnv } from './helpers/http.mjs';

/* Every value here is a secret in production. Each is distinctive enough that
   a substring search cannot produce a false positive. */
const SECRETS = {
    SUPABASE_URL: 'https://zzsentinelprojectref.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service-role-key-8f3a2b',
    RESEND_API_KEY: 're_sentinelresendkey_9c1d',
    TWILIO_ACCOUNT_SID: 'ACsentineltwiliosid4e7b',
    TWILIO_AUTH_TOKEN: 'sentineltwilioauthtoken2a6f',
    TWILIO_FROM: '+15125550143',
    DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
    DISPATCH_ALERT_TO: 'sentinel-ops@fusedprotectiveservices.com',
    DISPATCH_ALERT_WEBHOOK: 'https://sentinel-webhook.example.com/hook/9f2',
    OPS_ALERT_TO: 'sentinel-engineer@fusedprotectiveservices.com',
    INTAKE_HASH_SALT: 'sentinel-salt',
    VERCEL_ENV: 'production'
};

let env;
before(() => { env = withEnv(SECRETS); });
after(() => env.restore());

/** Calls the handler with Supabase answering `status`, or throwing. */
async function call({ status = 200, throws = false, method = 'GET' } = {}) {
    const stub = stubFetch(() => {
        if (throws) throw new Error('ECONNREFUSED 10.0.0.1:5432 role "postgres" database "fused"');
        return { status, json: {} };
    });
    const req = makeReq({ method });
    const res = makeRes();
    try {
        await handler(req, res);
    } finally {
        stub.restore();
    }
    return res;
}

test('healthy: 200, the documented shape, and no-store', async () => {
    const res = await call({ status: 200 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.env, 'production');
    assert.equal(res.body.checks.supabase, 'ok');
    assert.equal(typeof res.body.at, 'string');
    assert.deepEqual(Object.keys(res.body).sort(), ['at', 'checks', 'configured', 'env', 'ok']);
});

test('THE ONE THAT MATTERS: no secret, or any fragment of one, reaches the body', async () => {
    /* Both a healthy and an unhealthy response — the failure path is where a
       dependency's own error message is most likely to be helpfully included. */
    for (const opts of [{ status: 200 }, { status: 500 }, { throws: true }]) {
        const res = await call(opts);
        const serialised = JSON.stringify({ body: res.body, headers: res.headers });

        for (const [name, value] of Object.entries(SECRETS)) {
            if (name === 'VERCEL_ENV') continue;   // 'production' is meant to be there
            assert.ok(
                !serialised.includes(value),
                `${name} appeared in the health response: ${serialised}`
            );
        }
        /* The project ref is the database's own subdomain: naming it hands over
           the host to attack. Checked separately because a URL can be split. */
        assert.ok(!serialised.includes('zzsentinelprojectref'),
            `the Supabase project ref leaked: ${serialised}`);
        assert.ok(!/supabase\.co/.test(serialised), `a Supabase URL leaked: ${serialised}`);
        /* A dependency's error text can carry a host, a role or a table name. */
        assert.ok(!/ECONNREFUSED|10\.0\.0\.1|role "postgres"/.test(serialised),
            `a dependency error string leaked: ${serialised}`);
    }
});

test('configured reports booleans only — never a value, a prefix or a length', async () => {
    const res = await call({ status: 200 });
    for (const [key, value] of Object.entries(res.body.configured)) {
        assert.equal(typeof value, 'boolean', `configured.${key} is ${typeof value}, must be boolean`);
    }
    /* With every key seeded above, each integration reads as configured. */
    assert.equal(res.body.configured.resend, true);
    assert.equal(res.body.configured.twilio, true);
    assert.equal(res.body.configured.webhook, true);
    assert.equal(res.body.configured.ops_alerts, true);
});

test('a half-configured integration reads false, not true', async () => {
    /* A key without a verified sender cannot send to anyone. Reporting `true`
       there would say the launch blocker is cleared when it is not. */
    const partial = withEnv({ DISPATCH_ALERT_FROM: undefined, TWILIO_AUTH_TOKEN: undefined });
    try {
        const res = await call({ status: 200 });
        assert.equal(res.body.configured.resend, false);
        assert.equal(res.body.configured.twilio, false);
    } finally {
        partial.restore();
    }
});

test('Supabase unreachable → 503 and checks.supabase says so', async () => {
    for (const opts of [{ status: 500 }, { throws: true }]) {
        const res = await call(opts);
        assert.equal(res.statusCode, 503, JSON.stringify(res.body));
        assert.equal(res.body.ok, false);
        assert.equal(res.body.checks.supabase, 'unreachable');
    }
});

test('Supabase unconfigured → 503, named distinctly from unreachable', async () => {
    /* A deployment that cannot store a lead is not healthy whatever the reason,
       but "you have not set the key" and "the database is down" send different
       people to different places. */
    const cleared = withEnv({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined });
    try {
        const res = await call({ status: 200 });
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.checks.supabase, 'not_configured');
    } finally {
        cleared.restore();
    }
});

test('the probe is bounded, so a hung database still gets a verdict', async () => {
    /* Without a bound the monitor times out instead of receiving a 503, and
       "no response" and "database unreachable" are different incidents that
       would otherwise look identical on a status page. */
    const original = globalThis.fetch;
    globalThis.fetch = (_url, init = {}) => new Promise((_resolve, reject) => {
        /* Never settles on its own; only the handler's AbortSignal ends it. */
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
    /* AbortSignal.timeout's internal timer is UNREF'D, so it does not hold the
       event loop open. With a fetch that never settles and nothing else
       pending, node drains the loop and this test hangs instead of failing.
       One ref'd timer keeps the loop alive long enough for the abort to fire —
       the behaviour under test is real, the keep-alive is scaffolding. */
    const keepAlive = setInterval(() => {}, 50);
    try {
        const started = Date.now();
        const req = makeReq({ method: 'GET' });
        const res = makeRes();
        await handler(req, res);
        const elapsed = Date.now() - started;
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.checks.supabase, 'unreachable');
        assert.ok(elapsed < 10000, `the probe ran ${elapsed}ms with no upper bound`);
    } finally {
        clearInterval(keepAlive);
        globalThis.fetch = original;
    }
});

test('a non-GET method is refused', async () => {
    const res = await call({ method: 'POST' });
    assert.equal(res.statusCode, 405);
});
