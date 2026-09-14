import { NextResponse, type NextRequest } from 'next/server';
import { stripe, stripeConfigured, interpretEvent, applyPaymentEvent } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatch } from '@/lib/notifications';
import { appUrl } from '@/lib/shared';
import { report } from '@/lib/observability';
import type { Client, Invoice, Payment } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/* Every non-2xx this route returns is a payment event Stripe will have to
   retry, and Stripe's retry is the only other safety net there is: when it
   gives up, a client has paid and the invoice still says unpaid, and nobody
   finds out until they ask. So each one is reported and emailed before the
   response is written — never after, and never fire-and-forget (SPEC-003 §4).

   The event id is always in the alert, because it is the one thing that makes
   the failure recoverable by hand from the Stripe dashboard. */
async function fail(
    status: number,
    error: string,
    cause: unknown,
    context: Record<string, unknown>
): Promise<NextResponse> {
    await report(cause, { severity: 'error', source: 'app/api/stripe/webhook', context: { error, status, ...context } });
    return NextResponse.json({ ok: false, error }, { status });
}

/**
 * The webhook is the source of truth for payment state. Signature verified,
 * event id deduplicated in Postgres, invoice + payment updated in one
 * transaction, receipts sent only when the transaction reports it applied.
 */
export async function POST(request: NextRequest) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeConfigured() || !secret) {
        console.error('[stripe] webhook received but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set.');
        return fail(503, 'payments_not_configured',
            new Error('A Stripe webhook arrived but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set.'),
            { eventId: null });
    }

    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    let event;
    try {
        event = stripe().webhooks.constructEvent(body, signature ?? '', secret);
    } catch (err) {
        console.error('[stripe] signature verification failed:', (err as Error).message);
        /* Either the signing secret is wrong — every payment event is being
           dropped right now — or somebody is posting to this endpoint. Both
           are worth an alert, and the dedupe window keeps a flood to one. */
        return fail(400, 'bad_signature', err, { eventId: null, signaturePresent: Boolean(signature) });
    }

    const pe = interpretEvent(event);
    if (!pe) return NextResponse.json({ ok: true, ignored: event.type });

    let result;
    try {
        result = await applyPaymentEvent(pe, event.data.object);
    } catch (err) {
        console.error('[stripe] apply failed; Stripe will retry:', err);
        return fail(500, 'apply_failed', err, {
            eventId: event.id,
            eventType: event.type,
            invoiceId: pe.invoiceId,
            paymentIntentId: pe.paymentIntentId
        });
    }

    if (result.applied && pe.status === 'succeeded' && pe.invoiceId) {
        /* The payment is recorded by this point, so a failure here is a
           receipt that did not go out rather than money in the wrong state.
           Reported, and deliberately not turned into a non-2xx: asking Stripe
           to retry would re-apply an event that already succeeded. */
        try {
            await notifyPaid(pe.invoiceId, pe.paymentIntentId);
        } catch (err) {
            await report(err, {
                severity: 'error',
                source: 'app/api/stripe/webhook',
                context: { stage: 'notify', eventId: event.id, invoiceId: pe.invoiceId }
            });
        }
    }
    return NextResponse.json({ ok: true, ...result });
}

async function notifyPaid(invoiceId: string, paymentIntentId: string | null) {
    const db = supabaseAdmin();
    const { data: invoice } = await db.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (!invoice) return;
    const { data: payment } = await db.from('payments').select('*')
        .eq('invoice_id', invoiceId).eq('status', 'succeeded')
        .order('received_at', { ascending: false }).limit(1).maybeSingle();
    const { data: client } = invoice.client_id ? await db.from('clients').select('*').eq('id', invoice.client_id).maybeSingle() : { data: null };
    const ctx = { client: client as Client | null, invoice: invoice as Invoice, payment: payment as Payment };
    const base = appUrl();
    const key = paymentIntentId ?? payment?.id ?? 'pi';
    await dispatch('payment_received', { ...ctx, link: `${base}/portal/invoices/${invoice.id}` }, { entityType: 'invoice', entityId: invoice.id, idempotent: true, dedupeSuffix: key });
    await dispatch('payment_receipt', { ...ctx, link: `${base}/pay/${invoice.pay_token}` }, { entityType: 'invoice', entityId: invoice.id, idempotent: true, dedupeSuffix: key });
}
