import { NextResponse, type NextRequest } from 'next/server';
import { stripe, stripeConfigured, interpretEvent, applyPaymentEvent } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatch } from '@/lib/notifications';
import { appUrl } from '@/lib/shared';
import type { Client, Invoice, Payment } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/**
 * The webhook is the source of truth for payment state. Signature verified,
 * event id deduplicated in Postgres, invoice + payment updated in one
 * transaction, receipts sent only when the transaction reports it applied.
 */
export async function POST(request: NextRequest) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeConfigured() || !secret) {
        console.error('[stripe] webhook received but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set.');
        return NextResponse.json({ ok: false, error: 'payments_not_configured' }, { status: 503 });
    }

    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    let event;
    try {
        event = stripe().webhooks.constructEvent(body, signature ?? '', secret);
    } catch (err) {
        console.error('[stripe] signature verification failed:', (err as Error).message);
        return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 400 });
    }

    const pe = interpretEvent(event);
    if (!pe) return NextResponse.json({ ok: true, ignored: event.type });

    let result;
    try {
        result = await applyPaymentEvent(pe, event.data.object);
    } catch (err) {
        console.error('[stripe] apply failed; Stripe will retry:', err);
        return NextResponse.json({ ok: false, error: 'apply_failed' }, { status: 500 });
    }

    if (result.applied && pe.status === 'succeeded' && pe.invoiceId) {
        await notifyPaid(pe.invoiceId, pe.paymentIntentId);
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
