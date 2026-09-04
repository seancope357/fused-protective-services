// ==============================================================================
// Fused Protective Services — Vercel Serverless Stripe Checkout
// Target: Node.js 18+ / Vercel Edge / Serverless
// Description: Zero-dependency checkout session generator via native fetch
// ==============================================================================

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        // Fallback for local dev when Stripe isn't configured yet
        if (!stripeKey) {
            console.log('[API Stripe] Missing STRIPE_SECRET_KEY. Returning mock checkout URL.');
            return res.status(200).json({ url: 'https://buy.stripe.com/test_mock_link' });
        }

        const amountCents = body.totals?.totalCents || 0;
        if (amountCents <= 0) {
            return res.status(400).json({ error: 'Invoice total must be greater than zero.' });
        }

        const invoiceNumber = body.number || 'Draft';
        const clientName = body.client?.company || body.client?.name || 'Client';

        // 2. Create Stripe Checkout Session
        const params = new URLSearchParams();
        params.append('payment_method_types[0]', 'card');
        params.append('payment_method_types[1]', 'us_bank_account'); // ACH
        params.append('line_items[0][price_data][currency]', 'usd');
        params.append('line_items[0][price_data][product_data][name]', `Invoice ${invoiceNumber}`);
        params.append('line_items[0][price_data][product_data][description]', `Security Services for ${clientName}`);
        params.append('line_items[0][price_data][unit_amount]', amountCents.toString());
        params.append('line_items[0][quantity]', '1');
        params.append('mode', 'payment');
        params.append('success_url', 'https://fusedprotectiveservices.com'); 
        params.append('cancel_url', 'https://fusedprotectiveservices.com');
        params.append('payment_intent_data[description]', `Payment for Invoice ${invoiceNumber}`);

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!stripeRes.ok) {
            const err = await stripeRes.json();
            console.error('[API Stripe] Stripe API Error:', err);
            return res.status(500).json({ error: 'Failed to create Stripe session', details: err.error?.message });
        }

        const session = await stripeRes.json();
        
        return res.status(200).json({ url: session.url });

    } catch (err) {
        console.error('[API Stripe] Handler error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
