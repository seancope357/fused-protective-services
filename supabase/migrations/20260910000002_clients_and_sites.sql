-- ==============================================================================
-- Clients and sites. A client is the billing entity; a site is a physical
-- location that belongs to it and persists across every job held there.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL DEFAULT 'company' CHECK (kind IN ('company', 'individual')),
    name TEXT NOT NULL,                       -- company name, or the person's name
    billing_contact_name TEXT,
    billing_email TEXT,
    billing_phone TEXT,
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT DEFAULT 'TX',
    billing_postal_code TEXT,
    default_net_term_id TEXT NOT NULL DEFAULT 'net-30',   -- id from src/data/invoice.mjs
    default_tax_rate_pct NUMERIC(5, 3) NOT NULL DEFAULT 8.250,
    tax_jurisdiction TEXT DEFAULT 'Austin, TX',
    tax_exempt BOOLEAN NOT NULL DEFAULT false,
    stripe_customer_id TEXT UNIQUE,
    sms_consent BOOLEAN NOT NULL DEFAULT false,
    sms_consent_at TIMESTAMPTZ,
    sms_opted_out_at TIMESTAMPTZ,
    source_quote_id UUID REFERENCES public.client_quotes (id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (lower(name));
CREATE INDEX IF NOT EXISTS idx_clients_billing_email ON public.clients (lower(billing_email));

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_client_fk FOREIGN KEY (client_id)
    REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    name TEXT NOT NULL,                       -- "The Rooftop, 6th Street"
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT DEFAULT 'TX',
    postal_code TEXT,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    onsite_contact_name TEXT,
    onsite_contact_phone TEXT,
    access_notes TEXT,
    parking_notes TEXT,
    gear_notes TEXT,
    tax_rate_pct NUMERIC(5, 3),               -- overrides the client default when set
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_client ON public.sites (client_id);

DROP TRIGGER IF EXISTS trg_sites_updated_at ON public.sites;
CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_staff_all" ON public.clients
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "clients_self_read" ON public.clients
    FOR SELECT TO authenticated
    USING (id = (SELECT public.current_client_id()));

CREATE POLICY "sites_staff_all" ON public.sites
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "sites_client_read" ON public.sites
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()));
