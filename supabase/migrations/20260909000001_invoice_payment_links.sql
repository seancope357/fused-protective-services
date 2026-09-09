-- ==============================================================================
-- Invoice payment links: reconcile Stripe Checkout Sessions against invoices
-- /api/stripe-checkout upserts one row per session it creates (keyed on
-- invoice_number) so the Phase 1 webhook can mark the matching invoice paid
-- by session id. Additive only; the applied core schema is untouched.
-- ==============================================================================

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_url TEXT,
    ADD COLUMN IF NOT EXISTS client_company TEXT;

COMMENT ON COLUMN public.invoices.stripe_checkout_session_id IS
    'Stripe Checkout Session id (cs_...) for the most recent pay link; NULL for invoices never sent to Stripe.';
COMMENT ON COLUMN public.invoices.payment_url IS
    'Hosted Stripe Checkout URL matching stripe_checkout_session_id.';
COMMENT ON COLUMN public.invoices.client_company IS
    'Billing company, when the invoice is to a business rather than an individual.';

-- Unique per session, expressed as a partial index rather than an inline
-- UNIQUE constraint: ADD CONSTRAINT has no IF NOT EXISTS, and the partial
-- index also serves the webhook's lookup by session id without indexing the
-- NULLs of invoices that never had a link.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id
    ON public.invoices (stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;
