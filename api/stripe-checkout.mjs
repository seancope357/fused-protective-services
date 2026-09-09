// ==============================================================================
// Fused Protective Services — Stripe Checkout (/api/stripe-checkout)
// Target: Node.js 18+ on Vercel Functions. Zero dependencies.
//
// The amount is authoritative on the server. The request names an invoice by
// id; the total is read from the stored `public.invoices` row and nothing in
// the request body can change it. Missing configuration fails loudly with a
// 503 — there is no mock link, ever.
// ==============================================================================

import { cors, parseBody, text } from './_lib/http.mjs';
import { selectRows, supabaseConfigured } from './_lib/supabase.mjs';
import { site } from '../src/data/site.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dollars (NUMERIC from Postgres, arrives as a string) → integer cents. */
export const toCents = (amount) => Math.round(Number(amount) * 100);

export default async function handler(req, res) {
    if (!cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('[API Stripe] STRIPE_SECRET_KEY is not set. Refusing to mint a checkout link.');
        return res.status(503).json({
            ok: false,
            error: 'payments_not_configured',
            message: 'Online payment is not configured. Please remit by check or contact dispatch.'
        });
    }
    if (!supabaseConfigured()) {
        console.error('[API Stripe] Supabase is not configured; cannot look up the invoice.');
        return res.status(503).json({ ok: false, error: 'invoice_store_unavailable' });
    }

    let body;
    try {
        body = parseBody(req);
    } catch {
        return res.status(400).json({ ok: false, error: 'Malformed JSON body' });
    }

    const invoiceId = text(body.invoiceId, 40);
    if (!UUID.test(invoiceId)) {
        return res.status(400).json({ ok: false, error: 'invoice_id_required' });
    }

    const lookup = await selectRows(
        'invoices',
        `id=eq.${invoiceId}&select=id,invoice_number,client_name,client_email,total,status`
    );
    if (!lookup.ok) {
        console.error('[API Stripe] Invoice lookup failed:', lookup.status, lookup.data);
        return res.status(503).json({ ok: false, error: 'invoice_store_unavailable' });
    }
    const invoice = lookup.rows[0];
    if (!invoice) return res.status(404).json({ ok: false, error: 'invoice_not_found' });
    if (['paid', 'void'].includes(invoice.status)) {
        return res.status(409).json({ ok: false, error: `invoice_${invoice.status}` });
    }

    const amountCents = toCents(invoice.total);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return res.status(409).json({ ok: false, error: 'invoice_total_not_positive' });
    }

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('client_reference_id', invoice.id);
    params.append('metadata[invoice_id]', invoice.id);
    params.append('metadata[invoice_number]', invoice.invoice_number);
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'us_bank_account');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoice_number}`);
    params.append('line_items[0][price_data][product_data][description]', `Security services for ${invoice.client_name}`);
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][quantity]', '1');
    params.append('payment_intent_data[description]', `Payment for invoice ${invoice.invoice_number}`);
    params.append('payment_intent_data[metadata][invoice_id]', invoice.id);
    if (invoice.client_email) params.append('customer_email', invoice.client_email);
    params.append('success_url', `${site.url}/?payment=received&invoice=${encodeURIComponent(invoice.invoice_number)}`);
    params.append('cancel_url', `${site.url}/?payment=cancelled&invoice=${encodeURIComponent(invoice.invoice_number)}`);

    let session;
    try {
        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Idempotency-Key': `checkout-${invoice.id}-${amountCents}-${Date.now().toString(36)}`
            },
            body: params.toString()
        });
        session = await stripeRes.json();
        if (!stripeRes.ok) {
            console.error('[API Stripe] Stripe rejected the session:', session.error);
            return res.status(502).json({ ok: false, error: 'stripe_rejected', message: session.error?.message });
        }
    } catch (err) {
        console.error('[API Stripe] Stripe unreachable:', err);
        return res.status(503).json({ ok: false, error: 'stripe_unreachable' });
    }

    return res.status(200).json({ ok: true, url: session.url, amountCents, invoiceNumber: invoice.invoice_number });
}
