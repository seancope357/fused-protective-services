/* ==========================================================================
   /api/intake behaviour under node --test. No network: fetch is stubbed.
   ========================================================================== */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/intake.mjs';
import { deployEnv, isProduction } from '../api/_lib/env.mjs';
import { makeReq, makeRes, stubFetch, withEnv } from './helpers/http.mjs';

const CLEAR = {
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    DISPATCH_ALERT_TO: undefined,
    DISPATCH_ALERT_FROM: undefined,
    TWILIO_ACCOUNT_SID: undefined,
    TWILIO_AUTH_TOKEN: undefined,
    TWILIO_FROM: undefined,
    DISPATCH_ALERT_SMS_TO: undefined,
    DISPATCH_ALERT_WEBHOOK: undefined,
    HUBSPOT_WEBHOOK_URL: undefined,
    /* Every test below that does not say otherwise is the production
       deployment, so "unchanged in production" is the default assertion. */
    VERCEL_ENV: 'production',
    VERCEL_URL: undefined,
    VERCEL_BRANCH_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    NODE_ENV: 'test'
};

const quote = (extra = {}) => ({
    type: 'quote',
    formName: 'Test Client',
    formPhone: '+15125550100',
    formEmail: `client-${Math.random().toString(36).slice(2)}@example.com`,
    formDivision: 'Commercial & Property Patrol',
    formArmedPreference: 'Armed Commissioned Officers (Level III / IV)',
    formLocation: 'Austin, TX',
    formSchedule: 'Friday 8pm-2am',
    ...extra
});

let env;
before(() => { env = withEnv(CLEAR); });
after(() => env.restore());

/* ---------- Which deployment is this? ----------
   The one that must not be got backwards. Production is production only when
   VERCEL_ENV says so; everywhere else — a laptop, node --test, serve.py — is
   development, because an environment that cannot prove it is production must
   not be allowed to email dispatch or text the owner. */

test('deployEnv: absent VERCEL_ENV is development, never production', () => {
    const e = withEnv({ VERCEL_ENV: undefined });
    try {
        assert.equal(deployEnv(), 'development');
        assert.equal(isProduction(), false);
    } finally { e.restore(); }
});

test('deployEnv: production only when VERCEL_ENV says production', () => {
    for (const [value, expected] of [
        ['production', 'production'],
        ['preview', 'preview'],
        ['development', 'development'],
        ['', 'development'],
        ['   ', 'development'],
        ['prod', 'development'],
        ['staging', 'development'],
        ['productionish', 'development']
    ]) {
        const e = withEnv({ VERCEL_ENV: value });
        try {
            assert.equal(deployEnv(), expected, `VERCEL_ENV=${JSON.stringify(value)}`);
            assert.equal(isProduction(), expected === 'production', `VERCEL_ENV=${JSON.stringify(value)}`);
        } finally { e.restore(); }
    }
});

test('deployEnv: surrounding whitespace and casing do not demote production', () => {
    for (const value of [' production ', 'PRODUCTION', 'Production']) {
        const e = withEnv({ VERCEL_ENV: value });
        try {
            assert.equal(deployEnv(), 'production', `VERCEL_ENV=${JSON.stringify(value)}`);
        } finally { e.restore(); }
    }
});

test('nothing configured → 503 not_delivered, no fetch at all', async () => {
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ body: quote() }), res);
    f.restore();
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'not_delivered');
    assert.equal(f.calls.length, 0);
});

test('CORS reflects only allowed origins', async () => {
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), res);
    f.restore();
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], undefined);

    const res2 = makeRes();
    await handler(makeReq({ method: 'OPTIONS' }), res2);
    assert.equal(res2.headers['access-control-allow-origin'], 'https://fusedprotectiveservices.com');
});

test('a preview deployment still accepts its own origin', async () => {
    /* SPEC-001 removes the `.vercel.app` alias from productionHosts, so a
       preview's origin is no longer in the static list. `allowedOrigins()`
       adds VERCEL_URL and VERCEL_BRANCH_URL at runtime instead; if that ever
       stops happening, a preview's own form silently fails CORS and nobody
       can test intake on it. */
    const e = withEnv({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'fused-abc123-fused.vercel.app',
        VERCEL_BRANCH_URL: 'fused-git-spec-002-fused.vercel.app'
    });
    const f = stubFetch(() => null);
    try {
        for (const host of ['fused-abc123-fused.vercel.app', 'fused-git-spec-002-fused.vercel.app']) {
            const res = makeRes();
            await handler(makeReq({ method: 'OPTIONS', headers: { origin: `https://${host}` } }), res);
            assert.equal(res.statusCode, 204);
            assert.equal(res.headers['access-control-allow-origin'], `https://${host}`, host);
        }
        const other = makeRes();
        await handler(makeReq({ method: 'OPTIONS', headers: { origin: 'https://fused-someone-elses.vercel.app' } }), other);
        assert.equal(other.headers['access-control-allow-origin'], undefined, 'another deployment is still not allowed');
    } finally { f.restore(); e.restore(); }
});

/* This behaviour now has TWO consumers, and the second one is not obvious.

   The first is abuse control: a form-filling bot gets a plausible 200 and is
   told nothing, so it has no signal to adapt to.

   The second is SPEC-004. The uptime monitor POSTs here with the honeypot
   field filled, as a synthetic liveness probe. That one request exercises DNS,
   TLS, Vercel routing, the function cold start, CORS and the abuse gate — the
   entire path a real lead takes — WITHOUT writing a row, emailing anyone,
   texting the owner or polluting the leads inbox. There is no other way to
   prove that chain end to end from outside without creating fake business.

   So the 200-with-no-side-effects is load-bearing infrastructure, not just
   anti-spam politeness. If a future change makes a tripped honeypot answer 400,
   or persist a row "for analysis", the monitor starts paging at 3am about a
   healthy site, or the leads inbox fills with synthetic traffic. Change this
   and you must change docs/RUNBOOK.md §8c with it. */
test('honeypot filled → plausible 200 and nothing sent anywhere (also the SPEC-004 liveness probe)', async () => {
    const e = withEnv({
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        RESEND_API_KEY: 'k',
        DISPATCH_ALERT_TO: 'owner@example.com',
        DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_FROM: '+15120000000',
        DISPATCH_ALERT_SMS_TO: '+15121111111'
    });
    const f = stubFetch(() => ({ status: 200, json: { id: 'x' } }));
    const res = makeRes();
    await handler(makeReq({ body: quote({ website: 'http://spam.example' }) }), res);
    f.restore(); e.restore();

    /* 200 so the monitor reads healthy, and so a bot learns nothing. */
    assert.equal(res.statusCode, 200);
    /* Fully configured above ON PURPOSE: the earlier version of this test left
       Supabase and Twilio unset, so "nothing was sent" was partly because
       nothing COULD be sent. With every integration configured, zero outbound
       calls is a real assertion about the gate rather than about the fixture. */
    assert.equal(f.calls.length, 0,
        `a tripped honeypot made outbound calls: ${f.calls.map((c) => c.url).join(', ')}`);
});

test('full chain: persist, owner email, emergency SMS, client confirmation', async () => {
    const e = withEnv({
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        RESEND_API_KEY: 'k',
        DISPATCH_ALERT_TO: 'owner@example.com',
        DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_FROM: '+15120000000',
        DISPATCH_ALERT_SMS_TO: '+15121111111'
    });
    const f = stubFetch((url, init) => {
        if (url.endsWith('/rest/v1/rpc/intake_gate')) return { json: { allowed: true, retry_after: null, duplicate_of: null } };
        if (url.endsWith('/rest/v1/client_quotes')) {
            const record = JSON.parse(init.body);
            return { status: 201, json: [{ ...record, priority: 'emergency' }] };
        }
        if (url === 'https://api.resend.com/emails') return { json: { id: 'email_1' } };
        if (url.includes('api.twilio.com')) return { status: 201, json: { sid: 'SM1' } };
        return null;
    });
    const res = makeRes();
    await handler(makeReq({ body: quote({ formDivision: 'Emergency Tactical Dispatch' }) }), res);
    f.restore(); e.restore();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.priority, 'emergency');
    assert.deepEqual(res.body.delivery, {
        persisted: true, alerted: true, smsAlerted: true, confirmed: true, forwarded: false
    });
    assert.equal(res.body.environment, undefined, 'production responses carry no environment marker');
    assert.match(res.body.message, /confirmation email is on its way/);

    const inserted = JSON.parse(f.calls.find((c) => c.url.endsWith('/rest/v1/client_quotes')).init.body);
    assert.equal(inserted.source_env, 'production');

    const emails = f.calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.init.body));
    assert.equal(emails.length, 2);
    const ownerMail = emails.find((m) => m.to.includes('owner@example.com'));
    const clientMail = emails.find((m) => !m.to.includes('owner@example.com'));
    assert.match(ownerMail.subject, /EMERGENCY/);
    assert.match(clientMail.subject, new RegExp(res.body.refCode));
    assert.match(clientMail.text, /\(512\) 555-0199/, 'client confirmation carries the dispatch line from site.mjs');

    const sms = f.calls.find((c) => c.url.includes('api.twilio.com'));
    const params = new URLSearchParams(sms.init.body);
    assert.equal(params.get('To'), '+15121111111');
    assert.match(params.get('Body'), /EMERGENCY/);
});

test('client confirmation is skipped, and reported, when no verified sender exists', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_TO: 'owner@example.com' });
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const res = makeRes();
    await handler(makeReq({ body: quote() }), res);
    f.restore(); e.restore();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.delivery.alerted, true);
    assert.equal(res.body.delivery.confirmed, false);
    assert.equal(f.calls.length, 1, 'only the owner alert went out');
});

test('duplicate within the window answers with the original reference and sends nothing', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_TO: 'owner@example.com' });
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const body = quote();
    const first = makeRes();
    await handler(makeReq({ body }), first);
    const second = makeRes();
    await handler(makeReq({ body }), second);
    f.restore(); e.restore();
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(second.body.refCode, first.body.refCode);
    assert.equal(f.calls.length, 1);
});

test('per-IP rate limit → 429 with Retry-After', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_TO: 'owner@example.com' });
    const f = stubFetch((url) => (url === 'https://api.resend.com/emails' ? { json: { id: 'x' } } : null));
    const headers = { 'x-forwarded-for': '198.51.100.9' };
    let last;
    for (let i = 0; i < 6; i++) {
        last = makeRes();
        await handler(makeReq({ body: quote(), headers }), last);
    }
    f.restore(); e.restore();
    assert.equal(last.statusCode, 429);
    assert.equal(last.body.error, 'rate_limited');
    assert.ok(Number(last.headers['retry-after']) > 0);
});

/* ---------- SPEC-002: a preview writes, labelled, and sends nothing ---------- */

const FULLY_CONFIGURED = {
    SUPABASE_URL: 'https://db.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    RESEND_API_KEY: 'k',
    DISPATCH_ALERT_TO: 'owner@example.com',
    DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
    TWILIO_ACCOUNT_SID: 'AC123',
    TWILIO_AUTH_TOKEN: 'tok',
    TWILIO_FROM: '+15120000000',
    DISPATCH_ALERT_SMS_TO: '+15121111111',
    DISPATCH_ALERT_WEBHOOK: 'https://hooks.example/intake'
};

/** Routes every Supabase call a fully-configured intake makes, and nothing else. */
const supabaseOnly = (table) => (url, init) => {
    if (url.endsWith('/rest/v1/rpc/intake_gate')) return { json: { allowed: true, retry_after: null, duplicate_of: null } };
    if (url.endsWith(`/rest/v1/${table}`)) return { status: 201, json: [JSON.parse(init.body)] };
    if (url.endsWith('/rest/v1/notifications')) return { status: 201, json: [{}] };
    return null;
};

test('preview: the row persists labelled, and every send is suppressed and reported', async () => {
    const e = withEnv({ ...FULLY_CONFIGURED, VERCEL_ENV: 'preview' });
    const f = stubFetch(supabaseOnly('client_quotes'));
    const res = makeRes();
    await handler(makeReq({ body: quote({ formDivision: 'Emergency Tactical Dispatch' }) }), res);
    f.restore(); e.restore();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.environment, 'preview');
    assert.deepEqual(res.body.delivery, {
        persisted: true,
        alerted: false,
        smsAlerted: false,
        confirmed: false,
        forwarded: false,
        skipped: {
            alerted: 'non_production_env',
            smsAlerted: 'non_production_env',
            confirmed: 'non_production_env',
            forwarded: 'non_production_env'
        }
    });

    const inserted = JSON.parse(f.calls.find((c) => c.url.endsWith('/rest/v1/client_quotes')).init.body);
    assert.equal(inserted.source_env, 'preview');

    /* The whole point: no email, no SMS, no webhook, from anywhere. */
    for (const host of ['api.resend.com', 'api.twilio.com', 'hooks.example']) {
        assert.equal(f.calls.filter((c) => c.url.includes(host)).length, 0, host);
    }
    for (const call of f.calls) assert.ok(call.url.startsWith('https://db.example/'), `unexpected call to ${call.url}`);
});

test('preview: a candidate application is labelled too', async () => {
    const e = withEnv({ ...FULLY_CONFIGURED, VERCEL_ENV: 'preview' });
    const f = stubFetch(supabaseOnly('candidate_applications'));
    const res = makeRes();
    await handler(makeReq({
        body: {
            type: 'candidate',
            appPosition: 'level-3-officer',
            appFullName: 'Test Candidate',
            appPhone: '+15125550123',
            appEmail: `cand-${Math.random().toString(36).slice(2)}@example.com`,
            appBio: 'Six years on a door.'
        }
    }), res);
    f.restore(); e.restore();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.type, 'candidate');
    const inserted = JSON.parse(f.calls.find((c) => c.url.endsWith('/rest/v1/candidate_applications')).init.body);
    assert.equal(inserted.source_env, 'preview');
    assert.equal(f.calls.filter((c) => c.url.includes('api.resend.com')).length, 0);
});

test('preview: the notification log records non_production_env, not a missing key', async () => {
    const e = withEnv({ ...FULLY_CONFIGURED, VERCEL_ENV: 'preview' });
    const f = stubFetch(supabaseOnly('client_quotes'));
    const res = makeRes();
    await handler(makeReq({ body: quote({ formDivision: 'Emergency Tactical Dispatch' }) }), res);
    f.restore(); e.restore();

    assert.equal(res.statusCode, 200);
    const logged = f.calls
        .filter((c) => c.url.endsWith('/rest/v1/notifications'))
        .map((c) => JSON.parse(c.init.body));
    assert.ok(logged.length >= 2, 'owner alert and visitor confirmation are both logged');
    for (const row of logged) {
        assert.equal(row.status, 'skipped', `${row.trigger}/${row.channel}`);
        assert.equal(row.error, 'non_production_env', `${row.trigger}/${row.channel}`);
    }
});

test('local development is not production either', async () => {
    const e = withEnv({ ...FULLY_CONFIGURED, VERCEL_ENV: undefined });
    const f = stubFetch(supabaseOnly('client_quotes'));
    const res = makeRes();
    await handler(makeReq({ body: quote() }), res);
    f.restore(); e.restore();

    assert.equal(res.body.environment, 'development');
    const inserted = JSON.parse(f.calls.find((c) => c.url.endsWith('/rest/v1/client_quotes')).init.body);
    assert.equal(inserted.source_env, 'development');
    assert.equal(f.calls.filter((c) => c.url.includes('api.resend.com')).length, 0);
});

test('preview with no database configured is an honest 503, not a silent success', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_TO: 'owner@example.com', VERCEL_ENV: 'preview' });
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ body: quote() }), res);
    f.restore(); e.restore();

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'not_delivered');
    assert.equal(f.calls.length, 0);
});
