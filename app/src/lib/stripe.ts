import 'server-only';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { appUrl, site } from '@/lib/shared';
import type { Invoice } from '@/lib/db/types';

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;
export function stripe(): Stripe {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('payments_not_configured');
    if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
    return client;
}

/** Amount still owed, from the stored row only. */
export const balanceCents = (inv: Pick<Invoice, 'total_cents' | 'amount_paid_cents'>): number => Math.max(0, inv.total_cents - inv.amount_paid_cents);

/**
 * Creates a Checkout Session for the outstanding balance of a stored invoice.
 * The amount is read from the row; callers never pass one. Card and ACH.
 */
export async function createCheckoutSession(invoice: Invoice, opts: { returnTo?: string } = {}): Promise<{ url: string }> {
    const amount = balanceCents(invoice);
    if (amount <= 0) throw new Error('invoice_settled');
    if (['void', 'draft'].includes(invoice.status)) throw new Error(`invoice_${invoice.status}`);

    const base = appUrl();
    const returnTo = opts.returnTo ?? `${base}/pay/${invoice.pay_token}`;
    const session = await stripe().checkout.sessions.create(
        {
            mode: 'payment',
            client_reference_id: invoice.id,
            customer_email: invoice.client_email ?? undefined,
            payment_method_types: ['card', 'us_bank_account'],
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: 'usd',
                        unit_amount: amount,
                        product_data: {
                            name: `Invoice ${invoice.invoice_number}`,
                            description: `${site.name} — security services for ${invoice.client_company || invoice.client_name}`
                        }
                    }
                }
            ],
            metadata: { invoice_id: invoice.id, invoice_number: invoice.invoice_number },
            payment_intent_data: { description: `Invoice ${invoice.invoice_number}`, metadata: { invoice_id: invoice.id } },
            success_url: `${returnTo}?status=received&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnTo}?status=cancelled`
        },
        { idempotencyKey: `checkout-${invoice.id}-${amount}-${Math.floor(Date.now() / 60000)}` }
    );
    if (!session.url) throw new Error('stripe_no_url');
    await supabaseAdmin().from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoice.id);
    return { url: session.url };
}

/* ---------- Webhook ---------- */

export type PaymentEvent = {
    eventId: string;
    type: string;
    invoiceId: string | null;
    paymentIntentId: string | null;
    checkoutSessionId: string | null;
    chargeId: string | null;
    amountCents: number;
    method: string;
    status: 'pending' | 'succeeded' | 'failed';
    failureMessage: string | null;
};

/** Pure: maps a Stripe event to what the database function needs, or null when the event is not one we act on. */
export function interpretEvent(event: Stripe.Event): PaymentEvent | null {
    const base = { eventId: event.id, type: event.type };
    if (event.type === 'checkout.session.completed') {
        const s = event.data.object;
        return {
            ...base,
            invoiceId: s.metadata?.invoice_id || s.client_reference_id || null,
            paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
            checkoutSessionId: s.id,
            chargeId: null,
            amountCents: s.amount_total ?? 0,
            method: s.payment_method_types?.[0] ?? 'unknown',
            /* Card sessions are paid at completion; ACH sessions complete with
               the mandate and pay asynchronously — treat those as pending
               until payment_intent.succeeded arrives. */
            status: s.payment_status === 'paid' ? 'succeeded' : 'pending',
            failureMessage: null
        };
    }
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object;
        const charge = pi.latest_charge;
        return {
            ...base,
            invoiceId: pi.metadata?.invoice_id || null,
            paymentIntentId: pi.id,
            checkoutSessionId: null,
            chargeId: typeof charge === 'string' ? charge : (charge?.id ?? null),
            amountCents: event.type === 'payment_intent.succeeded' ? (pi.amount_received || pi.amount) : pi.amount,
            method: pi.payment_method_types?.[0] ?? 'unknown',
            status: event.type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
            failureMessage: pi.last_payment_error?.message ?? null
        };
    }
    return null;
}

export type ApplyResult = { applied: boolean; reason: string; invoice_status?: string };

/** Records the event and updates the invoice in one database transaction. */
export async function applyPaymentEvent(pe: PaymentEvent, raw: unknown): Promise<ApplyResult> {
    if (!pe.invoiceId) return { applied: false, reason: 'no_invoice_reference' };
    const { data, error } = await supabaseAdmin().rpc('apply_stripe_payment_event', {
        p_event_id: pe.eventId,
        p_event_type: pe.type,
        p_invoice_id: pe.invoiceId,
        p_payment_intent_id: pe.paymentIntentId,
        p_checkout_session_id: pe.checkoutSessionId,
        p_charge_id: pe.chargeId,
        p_amount_cents: pe.amountCents,
        p_method: pe.method,
        p_status: pe.status,
        p_failure_message: pe.failureMessage,
        p_raw: raw
    });
    if (error) throw new Error(`apply_stripe_payment_event: ${error.message}`);
    return data as ApplyResult;
}
