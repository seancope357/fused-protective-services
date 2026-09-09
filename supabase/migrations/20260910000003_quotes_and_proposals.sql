-- ==============================================================================
-- Quotes and proposals.
--   quote.status:    draft → sent → accepted | declined | expired
--   proposal:        the client-facing rendering of a quote; records acceptance
-- Money is integer cents. Rates default from src/data/estimator.mjs at the
-- application layer; the database stores what was actually quoted.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
    site_id UUID REFERENCES public.sites (id) ON DELETE SET NULL,
    source_quote_id UUID REFERENCES public.client_quotes (id) ON DELETE SET NULL,
    division_quote_value TEXT NOT NULL,       -- the quoteValue contract from src/data/divisions.mjs
    armed_level TEXT NOT NULL DEFAULT 'level-3' CHECK (armed_level IN ('level-2', 'level-3', 'level-4', 'mixed')),
    officer_count INT NOT NULL DEFAULT 1 CHECK (officer_count > 0),
    hours NUMERIC(7, 2) NOT NULL DEFAULT 8 CHECK (hours > 0),
    bill_rate_cents INT NOT NULL CHECK (bill_rate_cents >= 0),
    subtotal_cents INT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
    tax_rate_pct NUMERIC(5, 3) NOT NULL DEFAULT 8.250,
    tax_cents INT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    total_cents INT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
    deposit_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (deposit_pct >= 0 AND deposit_pct <= 100),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    valid_until DATE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
    sent_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_client ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes (status);

-- Server-minted numbers: Q-2026-0001. One sequence per year would need DDL at
-- new year; instead one global sequence plus the year in the label keeps it
-- unique without a scheduler. The invoice numbering uses the same pattern.
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT 'Q-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::TEXT, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := public.next_quote_number();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_number ON public.quotes;
CREATE TRIGGER trg_quotes_number
    BEFORE INSERT ON public.quotes
    FOR EACH ROW EXECUTE FUNCTION public.set_quote_number();

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- The quote_number column is NOT NULL but filled by the trigger; allow the
-- insert to omit it.
ALTER TABLE public.quotes ALTER COLUMN quote_number SET DEFAULT '';

CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL UNIQUE REFERENCES public.quotes (id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    scope TEXT NOT NULL,
    exclusions TEXT,
    terms TEXT NOT NULL,
    -- What the client saw, frozen at send time, so the accepted document is
    -- exactly what was accepted even if the quote changes later.
    snapshot JSONB,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    accepted_name TEXT,
    accepted_ip TEXT,
    accepted_user_agent TEXT,
    declined_at TIMESTAMPTZ,
    declined_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_client ON public.proposals (client_id);

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_staff_all" ON public.quotes
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

-- A client sees a quote only once it has been sent (never a draft).
CREATE POLICY "quotes_client_read" ON public.quotes
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()) AND status <> 'draft');

CREATE POLICY "proposals_staff_all" ON public.proposals
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "proposals_client_read" ON public.proposals
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()) AND status <> 'draft');

-- Acceptance and decline are the only client writes: a sent proposal may move
-- to accepted or declined, nothing else may change. Column-level checks live
-- in the accept_proposal() function the portal calls.
CREATE POLICY "proposals_client_decide" ON public.proposals
    FOR UPDATE TO authenticated
    USING (client_id = (SELECT public.current_client_id()) AND status = 'sent')
    WITH CHECK (client_id = (SELECT public.current_client_id()) AND status IN ('accepted', 'declined'));
