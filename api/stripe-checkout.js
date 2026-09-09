// ==============================================================================
// Fused Protective Services — Vercel Serverless Stripe Checkout (/api/stripe-checkout)
// Target: Node.js 18+ on Vercel Functions (Fluid Compute)
// Description: Zero-dependency Checkout Session generator via native fetch.
//
// Amount authority. The browser posts the invoice record it built, but the
// charge is what THIS file computes from the line items and tax rate. The
// caller's totals.totalCents is compared against that figure and never used
// as the amount; a disagreement is a 400. The arithmetic mirrors
// js/modules/invoice-form.mjs (lineCents + currentTotals) digit for digit so
// a legitimately built invoice always matches. Phase 1 replaces the posted
// record with a server-side lookup by invoice id.
//
// Delivery chain, in order:
//   1. Validate  → shape, bounds, recomputed total (400 on any disagreement)
//   2. Stripe    → Checkout Session (STRIPE_SECRET_KEY); 503 when unconfigured,
//                  never a mock link
//   3. Persist   → upsert public.invoices via Supabase REST (SUPABASE_URL +
//                  SUPABASE_SERVICE_ROLE_KEY) so the Phase 1 webhook can
//                  reconcile by session id. A failed write is reported as
//                  persisted:false, not hidden — the link still goes back.
//
// Env: STRIPE_SECRET_KEY, STRIPE_MAX_CHARGE_CENTS (default 5,000,000 = $50k),
//      SITE_ORIGIN (default https://fusedprotectiveservices.com),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ==============================================================================

const DEFAULT_SITE_ORIGIN = 'https://fusedprotectiveservices.com';
const DEFAULT_MAX_CHARGE_CENTS = 5_000_000;
const MAX_LINE_ITEMS = 50;

const siteOrigin = () => (process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');

function maxChargeCents() {
    const raw = parseInt(process.env.STRIPE_MAX_CHARGE_CENTS, 10);
    return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MAX_CHARGE_CENTS;
}

const text = (value, max = 500) =>
    (value == null ? '' : String(value)).trim().slice(0, max);

/* ---------- CORS ---------- */
/* Same posture as api/intake.js: invoice.html posts from its own origin and
   never needs a preflight, so the only cross-origin traffic is a script
   somewhere else — exactly what we refuse. The allow list is the production
   hosts, Vercel previews, a local dev server, and SITE_ORIGIN when it points
   somewhere else (a staging domain). Anything else gets no ACAO header and
   the browser refuses to hand it the response. */
const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?fusedprotectiveservices\.com|https:\/\/[a-z0-9.-]+\.vercel\.app|http:\/\/localhost(:\d+)?)$/i;

function resolveCorsOrigin(origin) {
    if (!origin) return null;
    return ALLOWED_ORIGIN.test(origin) || origin === siteOrigin() ? origin : null;
}

function applyCors(req, res) {
    /* Vary tells caches the answer depends on Origin, so a cached response
       for an allowed origin is never replayed to a disallowed one. */
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    const origin = resolveCorsOrigin(req.headers?.origin);
    if (!origin) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ---------- Stage 1: validate + recompute ---------- */
class InvoiceError extends Error {}
const reject = (message) => { throw new InvoiceError(message); };

/* The builder clamps every numeric input with Math.max(0, parseFloat(v) || 0)
   before it ever reaches a record, so a real record only carries finite,
   non-negative numbers. Anything else did not come from the builder. */
function amount(value, label, index) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        reject(`Line ${index + 1}: ${label} must be a finite, non-negative number.`);
    }
    return value;
}

/* Mirrors readRow() + lineCents() + currentTotals() in invoice-form.mjs:
     lineCents = Math.round(officers * hours * rate * 100)
     subtotal  = Σ lineCents
     tax       = Math.round((subtotal * taxRatePct) / 100)
     total     = subtotal + tax
   Same operand order, same single rounding per line and once for tax, so the
   two sides agree bit for bit. Do not "simplify" this. */
function recompute(body) {
    const lines = body.lines;
    if (!Array.isArray(lines) || lines.length === 0) reject('An invoice needs at least one line item.');
    if (lines.length > MAX_LINE_ITEMS) reject(`An invoice may carry at most ${MAX_LINE_ITEMS} line items.`);

    let subtotal = 0;
    const items = lines.map((line, i) => {
        if (!line || typeof line !== 'object') reject(`Line ${i + 1} is not a line item.`);
        const officers = amount(line.officers, 'officers', i);
        const hours = amount(line.hours, 'hours', i);
        const rate = amount(line.rate, 'rate', i);
        const amountCents = Math.round(officers * hours * rate * 100);
        subtotal += amountCents;
        return { tierId: text(line.tierId, 40), desc: text(line.desc, 200), officers, hours, rate, amountCents };
    });

    const taxRatePct = body.totals?.taxRatePct ?? 0;
    if (typeof taxRatePct !== 'number' || !Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) {
        reject('Tax rate must be a number between 0 and 100.');
    }
    const tax = Math.round((subtotal * taxRatePct) / 100);
    return { items, subtotalCents: subtotal, taxCents: tax, taxRatePct, totalCents: subtotal + tax };
}

const isoDate = (value, fallback) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) ? value : fallback;

function validate(body) {
    const number = text(body.number, 64);
    /* Doubles as Stripe's client_reference_id, which only accepts [A-Za-z0-9_-]. */
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(number)) reject('Invoice number is missing or contains characters other than letters, digits, - and _.');

    const clientName = text(body.client?.name, 200);
    if (!clientName) reject('A client contact name is required.');

    const totals = recompute(body);
    const claimed = body.totals?.totalCents;
    if (!Number.isInteger(claimed) || claimed !== totals.totalCents) {
        reject(`Invoice total does not match its line items: the invoice says ${claimed} cents, the line items and tax come to ${totals.totalCents}. Reopen the invoice and save it again.`);
    }
    if (totals.totalCents <= 0) reject('Invoice total must be greater than zero.');
    const ceiling = maxChargeCents();
    if (totals.totalCents > ceiling) {
        reject(`Invoice total of $${(totals.totalCents / 100).toFixed(2)} is over the online-payment ceiling of $${(ceiling / 100).toFixed(2)}. Collect this one by check or ACH invoice.`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const issueDate = isoDate(body.issueDate, today);
    return {
        number,
        clientName,
        clientCompany: text(body.client?.company, 200) || null,
        clientEmail: text(body.client?.email, 254) || null,
        issueDate,
        dueDate: isoDate(body.dueDate, issueDate),
        paymentTerms: text(body.netTermId, 40) || 'unspecified',
        totals
    };
}

/* ---------- Stage 2: Stripe ---------- */
async function createSession(invoice, stripeKey) {
    const { number, clientName, clientCompany, totals } = invoice;
    const billTo = clientCompany || clientName;
    const site = siteOrigin();

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('client_reference_id', number);
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'us_bank_account'); // ACH
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `Invoice ${number}`);
    params.append('line_items[0][price_data][product_data][description]', `Security Services for ${billTo}`);
    params.append('line_items[0][price_data][unit_amount]', String(totals.totalCents));
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${site}/?payment=complete&invoice=${encodeURIComponent(number)}`);
    params.append('cancel_url', `${site}/?payment=cancelled&invoice=${encodeURIComponent(number)}`);
    params.append('metadata[invoice_number]', number);
    params.append('metadata[client_name]', clientName);
    if (clientCompany) params.append('metadata[client_company]', clientCompany);
    params.append('metadata[amount_cents]', String(totals.totalCents));
    params.append('payment_intent_data[description]', `Payment for Invoice ${number}`);
    params.append('payment_intent_data[metadata][invoice_number]', number);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[API Stripe] Stripe API error:', res.status, err);
        return { ok: false, detail: err.error?.message };
    }
    const session = await res.json();
    if (!session?.url || !session?.id) {
        console.error('[API Stripe] Stripe returned a session without url/id:', session);
        return { ok: false, detail: 'Stripe returned an incomplete session.' };
    }
    return { ok: true, session };
}

/* ---------- Stage 3: Supabase ---------- */
/* One upsert keyed on invoice_number rather than GET-then-PATCH: Postgres
   applies ON CONFLICT DO UPDATE atomically, so two saves of the same number
   in quick succession cannot race into a duplicate-key failure, and it is a
   single round trip. Regenerating a link for an existing number overwrites
   the session id, link, and figures on that row. Status is written as
   'issued' (the table's CHECK allows draft/issued/paid/overdue); the Phase 1
   webhook owns the transition to 'paid'. */
async function persist(invoice, session) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.warn('[API Stripe] Supabase not configured — session', session.id, 'for', invoice.number, 'was not recorded.');
        return { configured: false, ok: false };
    }

    const t = invoice.totals;
    const row = {
        invoice_number: invoice.number,
        client_name: invoice.clientName,
        client_company: invoice.clientCompany,
        client_email: invoice.clientEmail,
        issue_date: invoice.issueDate,
        due_date: invoice.dueDate,
        payment_terms: invoice.paymentTerms,
        subtotal: t.subtotalCents / 100,
        tax_amount: t.taxCents / 100,
        total: t.totalCents / 100,
        status: 'issued',
        line_items: t.items,
        stripe_checkout_session_id: session.id,
        payment_url: session.url
    };

    try {
        const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/invoices?on_conflict=invoice_number`, {
            method: 'POST',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(row)
        });
        if (!res.ok) {
            console.error('[API Stripe] Supabase upsert failed:', res.status, await res.text());
            return { configured: true, ok: false };
        }
        return { configured: true, ok: true };
    } catch (err) {
        console.error('[API Stripe] Supabase unreachable:', err);
        return { configured: true, ok: false };
    }
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        return res.status(400).json({ ok: false, error: 'invalid_json', message: 'Malformed JSON body' });
    }
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ ok: false, error: 'invalid_json', message: 'Request body must be an invoice record.' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('[API Stripe] STRIPE_SECRET_KEY is not set. Refusing to mint a pay link.');
        return res.status(503).json({
            ok: false,
            error: 'not_configured',
            message: 'Online payment is not configured — the invoice saved without a pay link.'
        });
    }

    let invoice;
    try {
        invoice = validate(body);
    } catch (err) {
        if (!(err instanceof InvoiceError)) throw err;
        return res.status(400).json({ ok: false, error: 'invalid_invoice', message: err.message });
    }

    try {
        const stripe = await createSession(invoice, stripeKey);
        if (!stripe.ok) {
            return res.status(502).json({
                ok: false,
                error: 'stripe_error',
                message: `Stripe refused to create the checkout session${stripe.detail ? `: ${stripe.detail}` : '.'}`
            });
        }

        const stored = await persist(invoice, stripe.session);
        return res.status(200).json({
            ok: true,
            url: stripe.session.url,
            sessionId: stripe.session.id,
            invoiceNumber: invoice.number,
            amountCents: invoice.totals.totalCents,
            persisted: stored.ok
        });
    } catch (err) {
        console.error('[API Stripe] Handler error:', err);
        return res.status(500).json({ ok: false, error: 'internal_error', message: 'Internal Server Error' });
    }
}
