-- ==============================================================================
-- Fused Protective Services — Core Relational Schema & Governance
-- Author: Cameron Harrell / Fused Command Systems
-- Engine: PostgreSQL 15+ / Supabase
-- Target: Inbound Quotes (Leads), Officer Candidate Applications, and Invoicing
-- ==============================================================================

-- 1. Helper function: updated_at refresher
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- Table: client_quotes (Inbound Security Detail Inquiries & Leads)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    company TEXT,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    service_division TEXT NOT NULL,
    armed_preference TEXT NOT NULL,
    deployment_location TEXT NOT NULL,
    schedule TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'new' 
        CHECK (status IN ('new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost')),
    priority TEXT NOT NULL DEFAULT 'standard' 
        CHECK (priority IN ('standard', 'priority', 'emergency')),
    estimated_value NUMERIC(10, 2) DEFAULT 0.00,
    hubspot_deal_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast triage and command queries
CREATE INDEX IF NOT EXISTS idx_client_quotes_status ON public.client_quotes(status);
CREATE INDEX IF NOT EXISTS idx_client_quotes_priority ON public.client_quotes(priority);
CREATE INDEX IF NOT EXISTS idx_client_quotes_created_at ON public.client_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_quotes_ref_code ON public.client_quotes(ref_code);

-- Automated threat triage trigger
CREATE OR REPLACE FUNCTION public.triage_client_quote_priority()
RETURNS TRIGGER AS $$
BEGIN
    -- Escalate to emergency if rapid tactical dispatch or Level IV PPO requested
    IF NEW.service_division ILIKE '%Emergency%' 
       OR NEW.service_division ILIKE '%Tactical Dispatch%' 
       OR NEW.service_division ILIKE '%Level IV PPO%' THEN
        NEW.priority = 'emergency';
    ELSIF NEW.notes ILIKE '%urgent%' 
       OR NEW.notes ILIKE '%threat%' 
       OR NEW.notes ILIKE '%immediate%' THEN
        NEW.priority = 'priority';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_triage_quote ON public.client_quotes;
CREATE TRIGGER trg_triage_quote
    BEFORE INSERT OR UPDATE ON public.client_quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.triage_client_quote_priority();

DROP TRIGGER IF EXISTS trg_client_quotes_updated_at ON public.client_quotes;
CREATE TRIGGER trg_client_quotes_updated_at
    BEFORE UPDATE ON public.client_quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- Table: candidate_applications (Officer Recruiting & TOPS Licensure)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_code TEXT NOT NULL UNIQUE,
    position_id TEXT NOT NULL,
    license_level TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    tops_number TEXT,
    service_branch TEXT,
    bio TEXT NOT NULL,
    vetting_stage TEXT NOT NULL DEFAULT 'application_received'
        CHECK (vetting_stage IN ('application_received', 'tops_audit', 'background_mmpi2', 'range_physical', 'command_interview', 'active_roster', 'rejected')),
    hubspot_ticket_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_vetting_stage ON public.candidate_applications(vetting_stage);
CREATE INDEX IF NOT EXISTS idx_candidates_license_level ON public.candidate_applications(license_level);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON public.candidate_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_ref_code ON public.candidate_applications(ref_code);

DROP TRIGGER IF EXISTS trg_candidate_applications_updated_at ON public.candidate_applications;
CREATE TRIGGER trg_candidate_applications_updated_at
    BEFORE UPDATE ON public.candidate_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- Table: invoices (Accounting & Billing Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    client_email TEXT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'paid', 'overdue')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Ensure Supabase roles exist (for local testing compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.client_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 1. Public / Anon Insert: Allows visitors on fusedprotectiveservices.com to submit forms
CREATE POLICY "anon_can_insert_client_quotes" 
    ON public.client_quotes 
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

CREATE POLICY "anon_can_insert_candidate_applications" 
    ON public.candidate_applications 
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- 2. Command Staff / Authenticated Operations Full Access
CREATE POLICY "authenticated_full_access_client_quotes" 
    ON public.client_quotes 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "authenticated_full_access_candidates" 
    ON public.candidate_applications 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "authenticated_full_access_invoices" 
    ON public.invoices 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 3. Service Role (Bypasses RLS by default, but explicitly declared for edge functions)
CREATE POLICY "service_role_full_access_quotes" 
    ON public.client_quotes 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "service_role_full_access_candidates" 
    ON public.candidate_applications 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "service_role_full_access_invoices" 
    ON public.invoices 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
