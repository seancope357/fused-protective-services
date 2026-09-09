-- ==============================================================================
-- Reviews, the notification log, settings, and SMS consent.
-- ==============================================================================

-- ---------- Reviews ----------

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES public.jobs (id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'submitted')),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    body TEXT,
    author_name TEXT,
    permission_to_publish BOOLEAN NOT NULL DEFAULT false,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_client ON public.reviews (client_id);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_staff_all" ON public.reviews
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "reviews_client_read" ON public.reviews
    FOR SELECT TO authenticated
    USING (client_id = (SELECT public.current_client_id()));

-- A client may submit (not edit) their own requested review.
CREATE POLICY "reviews_client_submit" ON public.reviews
    FOR UPDATE TO authenticated
    USING (client_id = (SELECT public.current_client_id()) AND status = 'requested')
    WITH CHECK (client_id = (SELECT public.current_client_id()) AND status = 'submitted');

-- ---------- Notification log (append-only) ----------

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger TEXT NOT NULL,                    -- e.g. proposal_sent, invoice_overdue_7
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
    recipient TEXT NOT NULL,                  -- address or E.164 number
    recipient_role TEXT NOT NULL CHECK (recipient_role IN ('owner', 'client', 'officer', 'visitor')),
    entity_type TEXT,                         -- client_quote | proposal | job | invoice | review | digest
    entity_id UUID,
    -- One send per (trigger, entity, recipient, channel) unless the dedupe key
    -- is null. The scheduler relies on this to never double-send.
    dedupe_key TEXT,
    subject TEXT,
    body_preview TEXT,
    provider TEXT,                            -- resend | twilio
    provider_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at DESC);

-- Append-only: no UPDATE or DELETE grants for anyone but the owner role.
REVOKE UPDATE, DELETE ON public.notifications FROM anon, authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_staff_read" ON public.notifications
    FOR SELECT TO authenticated
    USING ((SELECT public.is_staff()));

CREATE POLICY "notifications_staff_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_staff()));

-- ---------- Settings ----------

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_staff_all" ON public.settings
    FOR ALL TO authenticated
    USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));

-- ---------- SMS consent ----------

ALTER TABLE public.client_quotes
    ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

ALTER TABLE public.candidate_applications
    ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;

-- Honouring STOP: any number here is never texted again, whatever the consent
-- flag on the client says. Written by the Twilio inbound webhook.
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
    phone TEXT PRIMARY KEY,                   -- E.164
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'twilio_inbound',
    last_message TEXT
);

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_opt_outs_staff_read" ON public.sms_opt_outs
    FOR SELECT TO authenticated
    USING ((SELECT public.is_staff()));
