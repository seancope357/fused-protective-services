-- ==============================================================================
-- Jobs and shifts.
--   job.status:   scheduled → in_progress → completed | cancelled
--   shift:        one dated block within a job. Assignment and clock-in columns
--                 are modelled for Phase 2; no UI writes them yet.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number TEXT NOT NULL UNIQUE DEFAULT '',
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
    site_id UUID REFERENCES public.sites (id) ON DELETE SET NULL,
    quote_id UUID REFERENCES public.quotes (id) ON DELETE SET NULL,
    division_quote_value TEXT NOT NULL,
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    -- RFC 5545 RRULE for standing details ("FREQ=WEEKLY;BYDAY=FR,SA"); null for
    -- one-off jobs. Shifts are materialised from it by the application.
    recurrence_rule TEXT,
    recurrence_until DATE,
    arrival_window TEXT,                      -- "Officers arrive 30 minutes before start"
    onsite_contact_name TEXT,
    onsite_contact_phone TEXT,
    client_prep_notes TEXT,                   -- "what to prepare" in the brief
    post_orders TEXT,
    deposit_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (deposit_pct >= 0 AND deposit_pct <= 100),
    deposit_invoice_id UUID,                  -- FK added in the invoices migration
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completion_summary TEXT,
    created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_jobs_client ON public.jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_starts ON public.jobs (starts_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);

CREATE SEQUENCE IF NOT EXISTS public.job_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
        NEW.job_number := 'J-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.job_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_number ON public.jobs;
CREATE TRIGGER trg_jobs_number
    BEFORE INSERT ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_job_number();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    officers_required INT NOT NULL DEFAULT 1 CHECK (officers_required > 0),
    armed_level TEXT NOT NULL DEFAULT 'level-3' CHECK (armed_level IN ('level-2', 'level-3', 'level-4', 'mixed')),
    bill_rate_cents INT NOT NULL CHECK (bill_rate_cents >= 0),
    pay_rate_cents INT CHECK (pay_rate_cents >= 0),   -- Phase 2 payroll; nullable now
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_shifts_job ON public.shifts (job_id);
CREATE INDEX IF NOT EXISTS idx_shifts_starts ON public.shifts (starts_at);

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Phase 2 seams: the roster and per-shift assignments with clock-in columns.
-- Modelled now so the RLS story for officers is complete from day one.
CREATE TABLE IF NOT EXISTS public.officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    dps_license_level TEXT CHECK (dps_license_level IN ('level-2', 'level-3', 'level-4')),
    dps_license_number TEXT,
    dps_license_expires_on DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_officers_updated_at ON public.officers;
CREATE TRIGGER trg_officers_updated_at
    BEFORE UPDATE ON public.officers
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_officer_fk FOREIGN KEY (officer_id)
    REFERENCES public.officers (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.shifts (id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES public.officers (id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'assigned'
        CHECK (status IN ('assigned', 'confirmed', 'declined', 'no_show', 'completed')),
    clock_in_at TIMESTAMPTZ,
    clock_in_lat NUMERIC(9, 6),
    clock_in_lng NUMERIC(9, 6),
    clock_out_at TIMESTAMPTZ,
    clock_out_lat NUMERIC(9, 6),
    clock_out_lng NUMERIC(9, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shift_id, officer_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_officer ON public.shift_assignments (officer_id);

-- ---------- Cross-table policy helpers ----------
-- Policies on jobs and shifts need facts from each other. Reading through
-- SECURITY DEFINER functions (which bypass RLS) keeps the policy graph acyclic.

CREATE OR REPLACE FUNCTION public.job_client_id(p_job_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT client_id FROM public.jobs WHERE id = p_job_id;
$$;

CREATE OR REPLACE FUNCTION public.officer_on_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.shift_assignments a ON a.shift_id = s.id
        WHERE s.job_id = p_job_id AND a.officer_id = public.current_officer_id()
    );
$$;

REVOKE ALL ON FUNCTION public.job_client_id(UUID), public.officer_on_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_client_id(UUID), public.officer_on_job(UUID) TO authenticated, service_role;

-- ---------- RLS ----------

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_staff_all" ON public.jobs
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "jobs_client_read" ON public.jobs
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()));

-- An officer sees a job only through a shift they are assigned to. The check
-- runs through a SECURITY DEFINER helper so the jobs policy never evaluates
-- the shifts policy (which itself looks at jobs) — that would recurse.
CREATE POLICY "jobs_officer_read" ON public.jobs
    FOR SELECT TO authenticated
    USING ((SELECT public.officer_on_job(jobs.id)));

CREATE POLICY "shifts_staff_all" ON public.shifts
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "shifts_client_read" ON public.shifts
    FOR SELECT TO authenticated
    USING ((SELECT public.job_client_id(shifts.job_id)) = (SELECT public.current_client_id()));

CREATE POLICY "shifts_officer_read" ON public.shifts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.shift_assignments a
        WHERE a.shift_id = shifts.id AND a.officer_id = (SELECT public.current_officer_id())
    ));

CREATE POLICY "officers_staff_all" ON public.officers
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "officers_self_read" ON public.officers
    FOR SELECT TO authenticated
    USING (id = (SELECT public.current_officer_id()));

CREATE POLICY "assignments_staff_all" ON public.shift_assignments
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "assignments_officer_read" ON public.shift_assignments
    FOR SELECT TO authenticated
    USING (officer_id = (SELECT public.current_officer_id()));

-- Phase 2: an officer may write their own clock-in/out on their own assignment.
CREATE POLICY "assignments_officer_clock" ON public.shift_assignments
    FOR UPDATE TO authenticated
    USING (officer_id = (SELECT public.current_officer_id()))
    WITH CHECK (officer_id = (SELECT public.current_officer_id()));
