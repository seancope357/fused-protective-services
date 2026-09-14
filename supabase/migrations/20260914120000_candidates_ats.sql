-- ==============================================================================
-- Candidate ATS (SPEC-010).
--
-- `/careers` has been live, indexed for Google Jobs and writing real rows to
-- public.candidate_applications since the first migration. Nothing could work
-- those rows: no assignment, no notes, no rejection reason, no record of when a
-- stage last moved — and, because the table was never added to the audit trigger
-- array in 20260910000009, no trail at all behind a stage change.
--
-- This migration adds the four columns the portal needs, keeps stage_changed_at
-- honest in the database rather than trusting every future caller to remember
-- it, and brings the table into the audit log.
--
-- Additive and forward-only. `source_env` arrived in 20260914000000 and is not
-- touched here. RLS already covers the table: `staff_all_candidates` from
-- 20260910000001 is the only policy, no new table is created, and nothing below
-- widens who can read a candidate.
--
-- Re-runnable: every statement is IF NOT EXISTS, OR REPLACE, or a no-op on a
-- second pass.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1 · Working columns
-- ------------------------------------------------------------------------------

ALTER TABLE public.candidate_applications
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Existing rows have never had a stage change: their stage is the one they
-- arrived with, so the truthful value is when they arrived. Doing this before
-- the NOT NULL means the backfill states a fact rather than stamping NOW() over
-- every historical application.
UPDATE public.candidate_applications
    SET stage_changed_at = created_at
    WHERE stage_changed_at IS NULL;

ALTER TABLE public.candidate_applications
    ALTER COLUMN stage_changed_at SET DEFAULT NOW();

ALTER TABLE public.candidate_applications
    ALTER COLUMN stage_changed_at SET NOT NULL;

COMMENT ON COLUMN public.candidate_applications.assigned_to IS
    'Staff member working this application. NULL means unassigned; the reference does not grant the assignee any read access — staff_all_candidates does.';
COMMENT ON COLUMN public.candidate_applications.stage_changed_at IS
    'When vetting_stage last changed. Maintained by trg_candidate_stage_changed_at, not by the caller.';
COMMENT ON COLUMN public.candidate_applications.rejection_reason IS
    'Internal only. Never rendered to the candidate and never quoted in the rejection email (SPEC-010).';
COMMENT ON COLUMN public.candidate_applications.internal_notes IS
    'Staff working notes. Internal only.';

-- The list query shape: a stage filtered, newest first.
CREATE INDEX IF NOT EXISTS idx_candidates_stage_created
    ON public.candidate_applications (vetting_stage, created_at DESC);

-- The nav badge and the assignment view.
CREATE INDEX IF NOT EXISTS idx_candidates_assigned_to
    ON public.candidate_applications (assigned_to)
    WHERE assigned_to IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2 · stage_changed_at, maintained by the database
--
-- The portal's server actions are not the only thing that can move a stage —
-- the table editor and a future import can too. A column whose accuracy depends
-- on every caller remembering it is a column that is quietly wrong, so the
-- database owns it and no application code writes it.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_candidate_stage_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.stage_changed_at := NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_candidate_stage_changed_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_candidate_stage_changed_at ON public.candidate_applications;
CREATE TRIGGER trg_candidate_stage_changed_at
    BEFORE UPDATE ON public.candidate_applications
    FOR EACH ROW
    WHEN (OLD.vetting_stage IS DISTINCT FROM NEW.vetting_stage)
    EXECUTE FUNCTION public.set_candidate_stage_changed_at();

-- ------------------------------------------------------------------------------
-- 3 · Audit coverage
--
-- 20260910000009 named eleven tables and not this one, so every stage change so
-- far would have left no trail. The applied migration is never edited: the
-- function is re-declared here in full, with two changes —
--   * `candidate_applications` maps to the entity type `candidate`;
--   * a stage change summarises as "old → new" the way a status change does,
--     because `vetting_stage` is this table's status column under another name.
-- Everything else is character-for-character the 20260910000009 body.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_new JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_changes JSONB := '{}'::jsonb;
    v_key TEXT;
    v_keys TEXT[] := ARRAY[]::TEXT[];
    v_entity TEXT;
    v_record UUID;
    v_parent_type TEXT;
    v_parent_id UUID;
    v_summary TEXT;
    v_label TEXT;
    v_actor UUID := auth.uid();
    v_role TEXT;
    v_ignored TEXT[] := ARRAY['updated_at', 'created_at', 'snapshot', 'raw', 'legacy_source', 'pay_token', 'token'];
BEGIN
    -- Entity vocabulary shared with the notifications table.
    v_entity := CASE TG_TABLE_NAME
        WHEN 'client_quotes' THEN 'client_quote'
        WHEN 'candidate_applications' THEN 'candidate'
        WHEN 'clients' THEN 'client'
        WHEN 'sites' THEN 'site'
        WHEN 'quotes' THEN 'quote'
        WHEN 'proposals' THEN 'proposal'
        WHEN 'jobs' THEN 'job'
        WHEN 'shifts' THEN 'shift'
        WHEN 'invoices' THEN 'invoice'
        WHEN 'payments' THEN 'payment'
        WHEN 'reviews' THEN 'review'
        WHEN 'settings' THEN 'setting'
        ELSE TG_TABLE_NAME END;

    IF TG_TABLE_NAME = 'settings' THEN
        v_record := '00000000-0000-4000-8000-00000000cafe';
    ELSE
        v_record := COALESCE((v_new ->> 'id'), (v_old ->> 'id'))::UUID;
    END IF;

    -- Parent for grouping.
    CASE TG_TABLE_NAME
        WHEN 'sites' THEN v_parent_type := 'client'; v_parent_id := COALESCE(v_new ->> 'client_id', v_old ->> 'client_id')::UUID;
        WHEN 'shifts' THEN v_parent_type := 'job'; v_parent_id := COALESCE(v_new ->> 'job_id', v_old ->> 'job_id')::UUID;
        WHEN 'invoices' THEN v_parent_type := 'job'; v_parent_id := NULLIF(COALESCE(v_new ->> 'job_id', v_old ->> 'job_id'), '')::UUID;
        WHEN 'payments' THEN v_parent_type := 'invoice'; v_parent_id := COALESCE(v_new ->> 'invoice_id', v_old ->> 'invoice_id')::UUID;
        WHEN 'proposals' THEN v_parent_type := 'quote'; v_parent_id := COALESCE(v_new ->> 'quote_id', v_old ->> 'quote_id')::UUID;
        WHEN 'reviews' THEN v_parent_type := 'job'; v_parent_id := COALESCE(v_new ->> 'job_id', v_old ->> 'job_id')::UUID;
        ELSE v_parent_type := NULL; v_parent_id := NULL;
    END CASE;

    -- Actor.
    IF v_actor IS NULL THEN
        v_role := 'system';
    ELSE
        SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
        v_role := COALESCE(v_role, 'system');
    END IF;

    -- Diff.
    IF TG_OP = 'UPDATE' THEN
        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            IF NOT (v_key = ANY (v_ignored)) AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
                v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
                v_keys := v_keys || v_key;
            END IF;
        END LOOP;
        IF array_length(v_keys, 1) IS NULL THEN
            RETURN NULL; -- nothing meaningful changed; no row
        END IF;
    ELSE
        v_changes := COALESCE(v_new, v_old) - v_ignored;
    END IF;

    -- Label for the summary.
    v_label := COALESCE(
        COALESCE(v_new, v_old) ->> 'invoice_number',
        COALESCE(v_new, v_old) ->> 'quote_number',
        COALESCE(v_new, v_old) ->> 'job_number',
        COALESCE(v_new, v_old) ->> 'ref_code',
        COALESCE(v_new, v_old) ->> 'name',
        COALESCE(v_new, v_old) ->> 'title',
        COALESCE(v_new, v_old) ->> 'key',
        v_entity
    );

    v_summary := CASE
        WHEN TG_OP = 'INSERT' THEN 'Created ' || v_entity || ' ' || v_label
        WHEN TG_OP = 'DELETE' THEN 'Deleted ' || v_entity || ' ' || v_label
        WHEN v_changes ? 'status' THEN v_entity || ' ' || v_label || ': ' || (v_changes #>> '{status,old}') || ' → ' || (v_changes #>> '{status,new}')
            || CASE WHEN array_length(v_keys, 1) > 1 THEN ' (+' || (array_length(v_keys, 1) - 1) || ' more)' ELSE '' END
        WHEN v_changes ? 'vetting_stage' THEN v_entity || ' ' || v_label || ': ' || (v_changes #>> '{vetting_stage,old}') || ' → ' || (v_changes #>> '{vetting_stage,new}')
            || CASE WHEN array_length(v_keys, 1) > 1 THEN ' (+' || (array_length(v_keys, 1) - 1) || ' more)' ELSE '' END
        ELSE 'Updated ' || v_entity || ' ' || v_label || ': ' || array_to_string(v_keys, ', ')
    END;

    INSERT INTO public.audit_log (actor_id, actor_role, action, table_name, entity_type, record_id, parent_type, parent_id, changes, summary)
    VALUES (v_actor, v_role, lower(TG_OP), TG_TABLE_NAME, v_entity, v_record, v_parent_type, v_parent_id, v_changes, v_summary);
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

-- The eleven tables of 20260910000009, plus candidate_applications. Re-created
-- here so a database that has this migration but not the next one still audits
-- every table the code expects.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['client_quotes', 'candidate_applications', 'clients', 'sites', 'quotes', 'proposals', 'jobs', 'shifts', 'invoices', 'payments', 'reviews', 'settings'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    END LOOP;
END $$;
