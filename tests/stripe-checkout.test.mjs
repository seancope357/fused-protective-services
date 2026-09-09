/* ==========================================================================
   /api/stripe-checkout: the amount comes from the stored invoice, never the
   request, and missing configuration fails loudly.
   ========================================================================== */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler, { toCents } from '../api/stripe-checkout.mjs';
import { makeReq, makeRes, stubFetch, withEnv } from './helpers/http.mjs';

const INVOICE_ID = '11111111-2222-4333-8444-555555555555';

let env;
before(() => { env = withEnv({ STRIPE_SECRET_KEY: undefined, SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, NODE_ENV: 'test' }); });
after(() => env.restore());

test('toCents handles NUMERIC strings without float drift', () => {
    assert.equal(toCents('1127.40'), 112740);
    assert.equal(toCents('0.29'), 29);
    assert.equal(toCents(19.99), 1999);
});

test('no STRIPE_SECRET_KEY → 503, never a mock URL', async () => {
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ body: { invoiceId: INVOICE_ID, totals: { totalCents: 1 } } }), res);
    f.restore();
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'payments_not_configured');
    assert.equal(res.body.url, undefined);
});

test('amount is read from the stored invoice; body totals are ignored', async () => {
    const e = withEnv({ STRIPE_SECRET_KEY: 'sk_test', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'svc' });
    const f = stubFetch((url, init) => {
        if (url.startsWith('https://db.example/rest/v1/invoices?')) {
            assert.match(url, new RegExp(`id=eq\\.${INVOICE_ID}`));
            return { json: [{ id: INVOICE_ID, invoice_number: 'FPS-2026-0007', client_name: 'Acme', client_email: 'ap@acme.example', total: '1127.40', status: 'issued' }] };
        }
        if (url === 'https://api.stripe.com/v1/checkout/sessions') {
            const params = new URLSearchParams(init.body);
            assert.equal(params.get('line_items[0][price_data][unit_amount]'), '112740');
            assert.equal(params.get('client_reference_id'), INVOICE_ID);
            assert.equal(params.get('metadata[invoice_id]'), INVOICE_ID);
            return { json: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' } };
        }
        return null;
    });
    const res = makeRes();
    await handler(makeReq({ body: { invoiceId: INVOICE_ID, totals: { totalCents: 1 }, amount: 1 } }), res);
    f.restore(); e.restore();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.amountCents, 112740);
    assert.equal(res.body.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
});

test('unknown invoice → 404; paid invoice → 409', async () => {
    const e = withEnv({ STRIPE_SECRET_KEY: 'sk_test', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'svc' });
    let paid = false;
    const f = stubFetch((url) => {
        if (url.startsWith('https://db.example/rest/v1/invoices?')) {
            return { json: paid ? [{ id: INVOICE_ID, invoice_number: 'X', client_name: 'A', total: '5.00', status: 'paid' }] : [] };
        }
        return null;
    });
    const missing = makeRes();
    await handler(makeReq({ body: { invoiceId: INVOICE_ID } }), missing);
    assert.equal(missing.statusCode, 404);
    paid = true;
    const done = makeRes();
    await handler(makeReq({ body: { invoiceId: INVOICE_ID } }), done);
    f.restore(); e.restore();
    assert.equal(done.statusCode, 409);
});

test('malformed invoice id → 400', async () => {
    const e = withEnv({ STRIPE_SECRET_KEY: 'sk_test', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'svc' });
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ body: { invoiceId: "1 OR 1=1" } }), res);
    f.restore(); e.restore();
    assert.equal(res.statusCode, 400);
});
