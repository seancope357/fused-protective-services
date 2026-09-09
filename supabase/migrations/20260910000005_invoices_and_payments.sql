-- ==============================================================================
-- Invoices (server-side, replacing the browser store) and payments.
--   invoice.status: draft → sent → partially_paid → paid | overdue | void
-- The invoices table already exists (core schema, zero rows). It is reshaped
-- additively: cents columns become the source of truth and the NUMERIC dollar
-- columns are regenerated from them so earlier readers keep working.
-- ==============================================================================

-- ---------- Reshape invoices ----------

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard'
        CHECK (kind IN ('standard', 'deposit', 'balance')),
    ADD COLUMN IF NOT EXISTS net_term_id TEXT NOT NULL DEFAULT 'net-30',
    ADD COLUMN IF NOT EXISTS subtotal_cents INT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
    ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(5, 3) NOT NULL DEFAULT 8.250,
    ADD COLUMN IF NOT EXISTS tax_cents INT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    ADD COLUMN IF NOT EXISTS total_cents INT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
    ADD COLUMN IF NOT EXISTS amount_paid_cents INT NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
    ADD COLUMN IF NOT EXISTS client_company TEXT,
    ADD COLUMN IF NOT EXISTS client_phone TEXT,
    ADD COLUMN IF NOT EXISTS client_address TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS terms TEXT,
    -- Random token for the emailed pay link: it lets a client pay without a
    -- portal login while keeping the invoice unguessable.
    ADD COLUMN IF NOT EXISTS pay_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    ADD COLUMN IF NOT EXISTS legacy_source JSONB,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_pay_token ON public.invoices (pay_token);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON public.invoices (job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices (due_date);

-- Dollar columns become derived. The table is empty, so drop and re-add.
ALTER TABLE public.invoices DROP COLUMN IF EXISTS subtotal;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS total;
ALTER TABLE public.invoices
    ADD COLUMN subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (subtotal_cents / 100.0) STORED,
    ADD COLUMN tax_amount NUMERIC(12, 2) GENERATED ALWAYS AS (tax_cents / 100.0) STORED,
    ADD COLUMN total NUMERIC(12, 2) GENERATED ALWAYS AS (total_cents / 100.0) STORED;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'));

ALTER TABLE public.invoices ALTER COLUMN payment_terms SET DEFAULT 'Net 30';
ALTER TABLE public.invoices ALTER COLUMN invoice_number SET DEFAULT '';
ALTER TABLE public.invoices ALTER COLUMN issue_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ALTER COLUMN due_date SET DEFAULT CURRENT_DATE + 30;

ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_deposit_invoice_fk FOREIGN KEY (deposit_invoice_id)
    REFERENCES public.invoices (id) ON DELETE SET NULL;

-- ---------- Numbering ----------
-- FPS-YYYY-#### from one global sequence; two devices cannot collide because
-- the number is minted by Postgres, never by a browser. Prefix and padding
-- are passed by the application from src/data/invoice.mjs; the defaults here
-- only cover direct SQL inserts.

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_prefix TEXT DEFAULT 'FPS', p_pad INT DEFAULT 4)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::TEXT, p_pad, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := public.next_invoice_number();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_number ON public.invoices;
CREATE TRIGGER trg_invoices_number
    BEFORE INSERT ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- Legacy import: the browser tool minted FPS-YYYY-#### numbers of its own.
-- Importing keeps the original number and pushes the sequence past it so a
-- later server-minted number cannot collide within the same year.
CREATE OR REPLACE FUNCTION public.reserve_invoice_sequence(p_number TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_seq INT;
    v_year TEXT;
BEGIN
    v_year := substring(p_number FROM '^[A-Z]+-(\d{4})-\d+$');
    v_seq := substring(p_number FROM '^[A-Z]+-\d{4}-(\d+)$')::INT;
    IF v_seq IS NOT NULL AND v_year = to_char(now(), 'YYYY') THEN
        PERFORM setval('public.invoice_number_seq', GREATEST(v_seq, (SELECT last_value FROM public.invoice_number_seq)), true);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_invoice_sequence(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_invoice_sequence(TEXT) TO authenticated, service_role;

-- ---------- Payments ----------

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
    amount_cents INT NOT NULL CHECK (amount_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    method TEXT NOT NULL DEFAULT 'unknown',   -- card | us_bank_account | check | other
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    stripe_charge_id TEXT,
    failure_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments (invoice_id);
-- One succeeded row per payment intent: checkout.session.completed and
-- payment_intent.succeeded describe the same money.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_intent_once
    ON public.payments (stripe_payment_intent_id) WHERE status = 'succeeded' AND stripe_payment_intent_id IS NOT NULL;

-- Every Stripe event id is recorded exactly once; a redelivered event is a
-- no-op. This is the idempotency key the webhook relies on.
CREATE TABLE IF NOT EXISTS public.stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applies one Stripe event to payments + invoice in a single transaction.
-- Returns {"applied": bool, "reason": text, "invoice_status": text}.
CREATE OR REPLACE FUNCTION public.apply_stripe_payment_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_invoice_id UUID,
    p_payment_intent_id TEXT,
    p_checkout_session_id TEXT,
    p_charge_id TEXT,
    p_amount_cents INT,
    p_method TEXT,
    p_status TEXT,             -- pending | succeeded | failed
    p_failure_message TEXT,
    p_raw JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv public.invoices%ROWTYPE;
    v_paid INT;
    v_new_status TEXT;
BEGIN
    -- Idempotency: the event id row is the lock. A duplicate delivery stops here.
    BEGIN
        INSERT INTO public.stripe_events (event_id, event_type, invoice_id)
        VALUES (p_event_id, p_event_type, p_invoice_id);
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_event');
    END;

    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'invoice_not_found');
    END IF;

    IF p_status = 'succeeded' THEN
        -- Second event for the same intent (session completed + intent
        -- succeeded): upgrade the pending row rather than adding money twice.
        IF p_payment_intent_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.payments
             WHERE stripe_payment_intent_id = p_payment_intent_id AND status = 'succeeded'
        ) THEN
            RETURN jsonb_build_object('applied', false, 'reason', 'intent_already_settled', 'invoice_status', v_inv.status);
        END IF;

        UPDATE public.payments
           SET status = 'succeeded', amount_cents = p_amount_cents, method = p_method,
               stripe_charge_id = COALESCE(p_charge_id, stripe_charge_id), received_at = now(), raw = p_raw
         WHERE stripe_payment_intent_id = p_payment_intent_id AND status = 'pending';
        IF NOT FOUND THEN
            INSERT INTO public.payments (invoice_id, amount_cents, method, status, stripe_payment_intent_id,
                                         stripe_checkout_session_id, stripe_charge_id, raw)
            VALUES (p_invoice_id, p_amount_cents, p_method, 'succeeded', p_payment_intent_id,
                    p_checkout_session_id, p_charge_id, p_raw);
        END IF;

        SELECT COALESCE(SUM(amount_cents), 0) INTO v_paid
          FROM public.payments WHERE invoice_id = p_invoice_id AND status = 'succeeded';

        v_new_status := CASE
            WHEN v_paid >= v_inv.total_cents THEN 'paid'
            WHEN v_paid > 0 THEN 'partially_paid'
            ELSE v_inv.status END;

        UPDATE public.invoices
           SET amount_paid_cents = v_paid,
               status = CASE WHEN status = 'void' THEN 'void' ELSE v_new_status END,
               paid_at = CASE WHEN v_paid >= total_cents THEN COALESCE(paid_at, now()) ELSE paid_at END,
               stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
               stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id)
         WHERE id = p_invoice_id;

    ELSIF p_status = 'pending' THEN
        IF NOT EXISTS (SELECT 1 FROM public.payments WHERE stripe_payment_intent_id = p_payment_intent_id) THEN
            INSERT INTO public.payments (invoice_id, amount_cents, method, status, stripe_payment_intent_id,
                                         stripe_checkout_session_id, raw)
            VALUES (p_invoice_id, p_amount_cents, p_method, 'pending', p_payment_intent_id, p_checkout_session_id, p_raw);
        END IF;
        UPDATE public.invoices
           SET stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
               stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id)
         WHERE id = p_invoice_id;

    ELSE -- failed
        INSERT INTO public.payments (invoice_id, amount_cents, method, status, stripe_payment_intent_id,
                                     stripe_checkout_session_id, failure_message, raw)
        VALUES (p_invoice_id, p_amount_cents, p_method, 'failed', p_payment_intent_id, p_checkout_session_id,
                p_failure_message, p_raw);
        UPDATE public.payments SET status = 'failed', failure_message = p_failure_message
         WHERE stripe_payment_intent_id = p_payment_intent_id AND status = 'pending';
    END IF;

    SELECT status INTO v_new_status FROM public.invoices WHERE id = p_invoice_id;
    RETURN jsonb_build_object('applied', true, 'reason', p_status, 'invoice_status', v_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_payment_event(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_payment_event(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ---------- RLS ----------

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- stripe_events: service role only (no policies).

-- invoices: staff policy exists from the roles migration. Clients see their
-- own non-draft invoices only.
CREATE POLICY "invoices_client_read" ON public.invoices
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()) AND status <> 'draft');

CREATE POLICY "payments_staff_all" ON public.payments
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "payments_client_read" ON public.payments
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = payments.invoice_id AND i.client_id = (SELECT public.current_client_id())
    ));
