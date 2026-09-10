-- ==============================================================================
-- Audit log. Every insert, update and delete on the operations tables becomes
-- one append-only row: who (auth user, or "system" for the webhook and the
-- scheduler), what changed (only the columns that changed, old and new), and a
-- one-line summary the timeline renders. Nothing but the triggers writes here;
-- nobody updates or deletes here.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID,                                -- auth.users id, null for system
    actor_role TEXT NOT NULL DEFAULT 'system',    -- owner | staff | client | officer | system
    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    table_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,                    -- matches notifications.entity_type vocabulary
    record_id UUID NOT NULL,
    -- The parent the timeline groups under: invoice → its job; shift → its job;
    -- site → its client. Null when the record is its own parent.
    parent_type TEXT,
    parent_id UUID,
    changes JSONB,                                -- {column: {old, new}} for updates; full row for insert/delete
    summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity_type, record_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_parent ON public.audit_log (parent_type, parent_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_at ON public.audit_log (at DESC);

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_staff_read" ON public.audit_log
    FOR SELECT TO authenticated
    USING ((SELECT public.is_staff()));
-- No insert policy: rows arrive only through the SECURITY DEFINER trigger below.

-- Columns that change on every write and carry no meaning for a reader.
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
        ELSE 'Updated ' || v_entity || ' ' || v_label || ': ' || array_to_string(v_keys, ', ')
    END;

    INSERT INTO public.audit_log (actor_id, actor_role, action, table_name, entity_type, record_id, parent_type, parent_id, changes, summary)
    VALUES (v_actor, v_role, lower(TG_OP), TG_TABLE_NAME, v_entity, v_record, v_parent_type, v_parent_id, v_changes, v_summary);
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['client_quotes', 'clients', 'sites', 'quotes', 'proposals', 'jobs', 'shifts', 'invoices', 'payments', 'reviews', 'settings'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    END LOOP;
END $$;
