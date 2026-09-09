-- ==============================================================================
-- Intake abuse controls: shared per-IP rate limit and duplicate suppression.
-- Called by api/intake.js through PostgREST with the service role; never by a
-- browser. Only hashes are stored — no raw addresses, no payloads.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.intake_gate (
    id BIGSERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    dedupe_hash TEXT NOT NULL,
    ref_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_gate_ip_created ON public.intake_gate (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_gate_dedupe_created ON public.intake_gate (dedupe_hash, created_at DESC);

ALTER TABLE public.intake_gate ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: nothing but the service role (which bypasses RLS)
-- may read or write this table.

-- Returns {"allowed": bool, "retry_after": int|null, "duplicate_of": text|null}.
-- A duplicate is still "allowed" (the caller answers with the earlier
-- reference instead of creating a second lead); a rate-limited call is not.
CREATE OR REPLACE FUNCTION public.intake_gate(
    p_ip_hash TEXT,
    p_dedupe_hash TEXT,
    p_ref_code TEXT,
    p_limit INT DEFAULT 5,
    p_window_seconds INT DEFAULT 600,
    p_dedupe_seconds INT DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_window_start TIMESTAMPTZ := NOW() - make_interval(secs => p_window_seconds);
    v_dupe_start   TIMESTAMPTZ := NOW() - make_interval(secs => p_dedupe_seconds);
    v_duplicate    TEXT;
    v_count        INT;
    v_oldest       TIMESTAMPTZ;
BEGIN
    -- Opportunistic cleanup keeps the table tiny without a scheduled job.
    DELETE FROM public.intake_gate WHERE created_at < NOW() - INTERVAL '1 day';

    SELECT ref_code INTO v_duplicate
      FROM public.intake_gate
     WHERE dedupe_hash = p_dedupe_hash AND created_at > v_dupe_start
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_duplicate IS NOT NULL THEN
        RETURN jsonb_build_object('allowed', true, 'retry_after', NULL, 'duplicate_of', v_duplicate);
    END IF;

    SELECT COUNT(*), MIN(created_at) INTO v_count, v_oldest
      FROM public.intake_gate
     WHERE ip_hash = p_ip_hash AND created_at > v_window_start;

    IF v_count >= p_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'retry_after', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - NOW())))::INT),
            'duplicate_of', NULL
        );
    END IF;

    INSERT INTO public.intake_gate (ip_hash, dedupe_hash, ref_code)
    VALUES (p_ip_hash, p_dedupe_hash, p_ref_code);

    RETURN jsonb_build_object('allowed', true, 'retry_after', NULL, 'duplicate_of', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.intake_gate(TEXT, TEXT, TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_gate(TEXT, TEXT, TEXT, INT, INT, INT) TO service_role;
