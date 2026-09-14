-- ==============================================================================
-- Alert dedupe window (SPEC-003).
--
-- One email per distinct error per window; every occurrence held back in that
-- window is counted, and the count rides along on the next alert that does go
-- out, so nothing is lost — only compressed. Ten thousand failures cost a
-- handful of emails instead of ten thousand.
--
-- It reuses public.intake_gate rather than adding a table. The two uses share
-- nothing but storage and the opportunistic cleanup: alert rows are namespaced
-- with an `alert:` prefix on both hash columns, and intake never writes or
-- reads a prefixed value, so neither can see the other's rows. Reusing the
-- table also means the retention promise — nothing older than a day survives —
-- is already written and already true here.
--
-- Called by api/_lib/report.mjs and app/src/lib/observability.ts through
-- PostgREST with the service role; never by a browser. Only hashes are stored:
-- no message text, no stack, no addresses.
-- ==============================================================================

-- One row per alert key, rather than one row per occurrence: a storm must not
-- be able to write itself into the table it is being throttled by.
ALTER TABLE public.intake_gate
    ADD COLUMN IF NOT EXISTS suppressed_count INTEGER NOT NULL DEFAULT 0;

-- Returns {"allowed": bool, "suppressed": int}.
--   allowed=true   send this one. `suppressed` is how many occurrences were
--                  held back since the last alert, for the email to carry.
--   allowed=false  the window is still open; this occurrence was counted and
--                  `suppressed` is the running total.
CREATE OR REPLACE FUNCTION public.alert_gate(
    p_key_hash TEXT,
    p_window_seconds INT DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_key        TEXT := 'alert:' || p_key_hash;
    v_id         BIGINT;
    v_sent_at    TIMESTAMPTZ;
    v_suppressed INTEGER;
BEGIN
    -- Same opportunistic cleanup the intake gate does, for the same reason:
    -- the table stays tiny without a scheduled job.
    DELETE FROM public.intake_gate WHERE created_at < NOW() - INTERVAL '1 day';

    -- A concurrent storm across function instances must not produce two
    -- emails for one window, so the row is locked before it is read.
    SELECT id, created_at, suppressed_count
      INTO v_id, v_sent_at, v_suppressed
      FROM public.intake_gate
     WHERE ip_hash = v_key
     ORDER BY created_at DESC
     LIMIT 1
       FOR UPDATE;

    IF v_id IS NOT NULL AND v_sent_at > NOW() - make_interval(secs => p_window_seconds) THEN
        UPDATE public.intake_gate
           SET suppressed_count = suppressed_count + 1
         WHERE id = v_id
        RETURNING suppressed_count INTO v_suppressed;
        RETURN jsonb_build_object('allowed', false, 'suppressed', v_suppressed);
    END IF;

    -- The window has closed (or never opened). This occurrence sends, and
    -- carries the count of everything suppressed while the window was open.
    IF v_id IS NOT NULL THEN
        DELETE FROM public.intake_gate WHERE id = v_id;
    END IF;

    INSERT INTO public.intake_gate (ip_hash, dedupe_hash, ref_code, suppressed_count)
    VALUES (v_key, v_key, 'alert', 0);

    RETURN jsonb_build_object('allowed', true, 'suppressed', COALESCE(v_suppressed, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.alert_gate(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_gate(TEXT, INT) TO service_role;
