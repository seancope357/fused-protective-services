/* ==========================================================================
   /api/intake behaviour under node --test. No network: fetch is stubbed.
   ========================================================================== */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/intake.js';
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

test('honeypot filled → plausible 200 and nothing sent anywhere', async () => {
    const e = withEnv({ RESEND_API_KEY: 'k', DISPATCH_ALERT_TO: 'owner@example.com' });
    const f = stubFetch(() => ({ status: 200, json: { id: 'x' } }));
    const res = makeRes();
    await handler(makeReq({ body: quote({ website: 'http://spam.example' }) }), res);
    f.restore(); e.restore();
    assert.equal(res.statusCode, 200);
    assert.equal(f.calls.length, 0);
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
    assert.match(res.body.message, /confirmation email is on its way/);

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
