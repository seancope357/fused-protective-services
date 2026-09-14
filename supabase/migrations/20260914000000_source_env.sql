-- ==============================================================================
-- Row provenance: which deployment wrote this row (SPEC-002).
--
-- Both Vercel projects build a preview for every pull request, and the
-- Marketplace integration injects the Supabase variables into every
-- environment. Until a preview-scoped Supabase branch is configured, a
-- submission on a preview URL lands in the same table as a real lead.
--
-- The answer is provenance, not prevention: a preview that cannot write is a
-- preview nobody can test intake on. `/api/intake` stamps every public
-- submission with its own VERCEL_ENV, the portal's Leads inbox and dashboard
-- filter to 'production' by default, and the scheduler only pages about
-- production rows. Outbound side effects are suppressed in code, not here.
--
-- Additive and forward-only. Existing rows are production rows: they were
-- written before previews were distinguishable, from the live site.
--
-- Deployment order: apply this before deploying the `/api/intake` that writes
-- the column, or PostgREST rejects the insert with an unknown-column error.
--
-- No new table, so no new RLS to enable; both tables below already have row
-- level security on, and the existing policies cover the new column.
-- ==============================================================================

ALTER TABLE public.client_quotes
    ADD COLUMN IF NOT EXISTS source_env TEXT NOT NULL DEFAULT 'production'
        CHECK (source_env IN ('production', 'preview', 'development'));

ALTER TABLE public.candidate_applications
    ADD COLUMN IF NOT EXISTS source_env TEXT NOT NULL DEFAULT 'production'
        CHECK (source_env IN ('production', 'preview', 'development'));

-- Backfill. `ADD COLUMN ... NOT NULL DEFAULT` already stamps every existing row
-- with 'production'; these statements make the intent explicit and repair the
-- column if it was ever added ahead of this migration without the default.
UPDATE public.client_quotes SET source_env = 'production' WHERE source_env IS NULL;
UPDATE public.candidate_applications SET source_env = 'production' WHERE source_env IS NULL;

-- The inbox query shape: newest production rows first.
CREATE INDEX IF NOT EXISTS idx_client_quotes_source_env
    ON public.client_quotes (source_env, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidates_source_env
    ON public.candidate_applications (source_env, created_at DESC);

COMMENT ON COLUMN public.client_quotes.source_env IS
    'Deployment that created this row: production | preview | development. Written by /api/intake from VERCEL_ENV. The portal filters to production by default.';

COMMENT ON COLUMN public.candidate_applications.source_env IS
    'Deployment that created this row: production | preview | development. Written by /api/intake from VERCEL_ENV. The portal filters to production by default.';
