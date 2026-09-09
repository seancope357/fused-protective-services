-- ==============================================================================
-- Roles. One profile per auth user, carrying the role RLS enforces and, for
-- clients and officers, the row they are scoped to. Helper functions are
-- SECURITY DEFINER + STABLE so every policy can call them cheaply and no
-- policy has to join profiles itself.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'client'
        CHECK (role IN ('owner', 'staff', 'client', 'officer')),
    client_id UUID,           -- FK added once clients exists (next migration)
    officer_id UUID,          -- Phase 2 roster; modelled now
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_client ON public.profiles (client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- A profile is created for every auth user. Role and scoping come from the
-- user metadata the server set when it created the user; anything else
-- defaults to an unscoped client, which every policy below treats as "sees
-- nothing".
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, role, client_id, officer_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'client'),
        NULLIF(NEW.raw_user_meta_data ->> 'client_id', '')::UUID,
        NULLIF(NEW.raw_user_meta_data ->> 'officer_id', '')::UUID,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------- Policy helpers ----------

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE((SELECT role IN ('owner', 'staff') FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT client_id FROM public.profiles WHERE id = auth.uid() AND role = 'client';
$$;

CREATE OR REPLACE FUNCTION public.current_officer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT officer_id FROM public.profiles WHERE id = auth.uid() AND role = 'officer';
$$;

REVOKE ALL ON FUNCTION public.current_role_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_client_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_officer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role_name(), public.is_staff(), public.current_client_id(), public.current_officer_id() TO authenticated, service_role;

-- ---------- RLS ----------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_read" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_staff_all" ON public.profiles
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff()))
    WITH CHECK ((SELECT public.is_staff()));

-- The earlier "authenticated_full_access_*" policies on client_quotes,
-- candidate_applications and invoices predate roles: any signed-in user could
-- read every lead. Replace them with staff-only access. Clients get scoped
-- policies on invoices in the invoices migration.
DROP POLICY IF EXISTS "authenticated_full_access_client_quotes" ON public.client_quotes;
DROP POLICY IF EXISTS "authenticated_full_access_candidates" ON public.candidate_applications;
DROP POLICY IF EXISTS "authenticated_full_access_invoices" ON public.invoices;

CREATE POLICY "staff_all_client_quotes" ON public.client_quotes
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "staff_all_candidates" ON public.candidate_applications
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "staff_all_invoices" ON public.invoices
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

-- Public inserts came through the anon key in an earlier design; the intake
-- function now writes with the service role, so the anon paths close.
DROP POLICY IF EXISTS "anon_can_insert_client_quotes" ON public.client_quotes;
DROP POLICY IF EXISTS "anon_can_insert_candidate_applications" ON public.candidate_applications;
