/* ==========================================================================
   SPEC-003 acceptance 7 — the Stripe webhook reports before every non-2xx.
   GO_LIVE D1b, the half that was still asserted by reading the code.

   Why this one is worth a test rather than a careful reading:

   Every non-2xx this route returns is a payment event Stripe will retry, and
   Stripe's retry is the ONLY other safety net. When it gives up, a client has
   paid, the invoice still says unpaid, and nobody finds out until they ask.
   The alert is what turns that into a fixable incident, and the event id is
   what makes it fixable by hand from the Stripe dashboard.

   Two properties, and the second is the one a reading cannot establish:

     1. Every non-2xx path reports. Guarded STRUCTURALLY below, over the source,
        because the failure mode is a future non-2xx added without an alert —
        which no test of today's three branches would ever catch.
     2. The report is AWAITED, not fire-and-forget. In a serverless runtime the
        function can be frozen the moment the response is written, so a
        floating promise is an alert that sometimes does not exist. That is
        invisible to inspection and to any test that only checks the response.
   ========================================================================== */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROUTE = path.resolve(__dirname, '../src/app/api/stripe/webhook/route.ts');

type Reported = { severity?: string; source?: string; context?: Record<string, unknown> };

describe('every non-2xx is reported (structural)', () => {
    const source = readFileSync(ROUTE, 'utf8');

    it('no non-2xx response is constructed outside the reporting helper', () => {
        /* `fail()` is the only place allowed to build a non-2xx, because it is
           the only place that reports first. A future `return NextResponse.json(
           {...}, { status: 409 })` added straight into a branch would return a
           retryable failure with no alert behind it — exactly the silent hole
           this criterion exists to close. */
        const body = source.slice(source.indexOf('export async function POST'));
        const statuses = [...body.matchAll(/status:\s*(\d{3})/g)].map((m) => Number(m[1]));
        const nonOk = statuses.filter((s) => s >= 300);
        expect(nonOk, `non-2xx status built outside fail(): ${nonOk.join(', ')}`).toHaveLength(0);
    });

    it('the reporting helper awaits the report before building the response', () => {
        const fail = source.slice(source.indexOf('async function fail('), source.indexOf('export async function POST'));
        const reportAt = fail.indexOf('await report(');
        const responseAt = fail.indexOf('NextResponse.json');
        expect(reportAt, 'fail() does not await report()').toBeGreaterThan(-1);
        expect(reportAt, 'fail() builds its response before reporting').toBeLessThan(responseAt);
    });
});

describe('the webhook reports, with the event id, before answering', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.restoreAllMocks());

    async function load({ reportImpl }: { reportImpl?: (o: Reported) => Promise<void> } = {}) {
        const reports: Reported[] = [];
        vi.doMock('@/lib/observability', () => ({
            report: async (_e: unknown, o: Reported) => {
                reports.push(o);
                if (reportImpl) await reportImpl(o);
            }
        }));
        vi.doMock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => ({}) }));
        vi.doMock('@/lib/notifications', () => ({ dispatch: async () => undefined }));
        return { reports };
    }

    const post = (body = '{}', headers: Record<string, string> = {}) =>
        ({ headers: new Headers(headers), text: async () => body }) as unknown as Parameters<
            typeof import('@/app/api/stripe/webhook/route')['POST']>[0];

    it('unconfigured Stripe → 503, reported at error, before the response', async () => {
        const { reports } = await load();
        vi.doMock('@/lib/stripe', () => ({
            stripeConfigured: () => false, stripe: () => ({}),
            interpretEvent: () => null, applyPaymentEvent: async () => ({})
        }));
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
        const { POST } = await import('@/app/api/stripe/webhook/route');
        const res = await POST(post());
        expect(res.status).toBe(503);
        expect(reports).toHaveLength(1);
        expect(reports[0]).toMatchObject({ severity: 'error', source: 'app/api/stripe/webhook' });
        expect(reports[0].context).toMatchObject({ error: 'payments_not_configured', status: 503 });
    });

    it('bad signature → 400, reported — the secret may be wrong and every event dropping', async () => {
        const { reports } = await load();
        vi.doMock('@/lib/stripe', () => ({
            stripeConfigured: () => true,
            stripe: () => ({ webhooks: { constructEvent: () => { throw new Error('no signatures found'); } } }),
            interpretEvent: () => null, applyPaymentEvent: async () => ({})
        }));
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
        const { POST } = await import('@/app/api/stripe/webhook/route');
        const res = await POST(post('{}', { 'stripe-signature': 'bad' }));
        expect(res.status).toBe(400);
        expect(reports[0].context).toMatchObject({ error: 'bad_signature', status: 400, signaturePresent: true });
    });

    it('apply failure → 500, and THE EVENT ID IS IN THE ALERT', async () => {
        /* The id is the one thing that makes the failure recoverable by hand
           from the Stripe dashboard. An alert without it says only that money
           moved somewhere and something broke. */
        const { reports } = await load();
        vi.doMock('@/lib/stripe', () => ({
            stripeConfigured: () => true,
            stripe: () => ({ webhooks: { constructEvent: () => ({ id: 'evt_1PxYz', type: 'payment_intent.succeeded', data: { object: {} } }) } }),
            interpretEvent: () => ({ status: 'succeeded', invoiceId: 'inv_7', paymentIntentId: 'pi_9' }),
            applyPaymentEvent: async () => { throw new Error('deadlock detected'); }
        }));
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
        const { POST } = await import('@/app/api/stripe/webhook/route');
        const res = await POST(post('{}', { 'stripe-signature': 'ok' }));
        expect(res.status).toBe(500);
        expect(reports[0].context).toMatchObject({
            error: 'apply_failed', status: 500,
            eventId: 'evt_1PxYz', eventType: 'payment_intent.succeeded',
            invoiceId: 'inv_7', paymentIntentId: 'pi_9'
        });
    });

    it('THE ONE A READING CANNOT PROVE: the response waits for the report', async () => {
        /* A floating `report(...)` would let the response be written first. In
           a serverless runtime the function can be frozen the instant that
           happens, so the alert is sent sometimes and not others — the worst
           possible failure mode for the thing you rely on to notice money
           moving wrongly. Held the report open and asserted the POST has not
           settled; that cannot be faked by a route that fires and forgets. */
        let release!: () => void;
        const held = new Promise<void>((resolve) => { release = resolve; });
        await load({ reportImpl: () => held });

        vi.doMock('@/lib/stripe', () => ({
            stripeConfigured: () => false, stripe: () => ({}),
            interpretEvent: () => null, applyPaymentEvent: async () => ({})
        }));
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
        const { POST } = await import('@/app/api/stripe/webhook/route');

        let settled = false;
        const pending = POST(post()).then((r) => { settled = true; return r; });
        await new Promise((r) => setTimeout(r, 25));
        expect(settled, 'the webhook answered before its alert was sent').toBe(false);

        release();
        const res = await pending;
        expect(settled).toBe(true);
        expect(res.status).toBe(503);
    });
});
