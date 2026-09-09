-- ==============================================================================
-- Intake abuse controls: attempt ledger for rate limiting + duplicate suppression
-- Read and written only by api/intake.js through the service role.
--
-- Vercel functions share no memory, so per-IP counters and "already submitted"
-- checks live here. Identities are stored as salted SHA-256 hashes
-- (INTAKE_HASH_SALT), never as raw addresses: the table can throttle without
-- becoming a list of visitor IPs. ref_code is set only on attempts that went
-- on to deliver, so a duplicate can be pointed back at its original.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.intake_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    ref_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Both lookups are "this identity within the last N minutes".
CREATE INDEX IF NOT EXISTS idx_intake_attempts_ip_created
    ON public.intake_attempts(ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_attempts_fingerprint_created
    ON public.intake_attempts(fingerprint, created_at DESC);

-- ------------------------------------------------------------------------------
-- Row Level Security: service role only. No anon policy on purpose — the browser
-- must never be able to read the ledger or pre-seed it to lock a competitor out.
-- ------------------------------------------------------------------------------
ALTER TABLE public.intake_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_intake_attempts"
    ON public.intake_attempts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
