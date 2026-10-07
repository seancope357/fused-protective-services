-- =============================================================================
-- Allow 'push' as a notification channel (Telegram), alongside email and sms.
--
-- Why: A2P 10DLC brand registration (GO_LIVE B3) needs an EIN and takes
-- business days, and it was the longest pole on the launch path. The owner
-- alerts it was blocking -- the 2-hour unanswered-lead page, the emergency
-- intake alert and proposal-accepted -- are the business notifying ITSELF, so
-- they need no carrier registration, no consumer consent and no STOP list.
-- They now go out over the Telegram Bot API, which is free.
--
-- Client-facing SMS (the 24h job reminder) deliberately stays on the 'sms'
-- channel and stays unconfigured, so it logs an honest `not_configured` skip
-- until a real carrier route exists. Texting a consumer is the thing 10DLC
-- governs; nothing here routes client messages over a free channel.
--
-- Additive and reversible: this widens a CHECK constraint and writes no rows.
-- =============================================================================

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_channel_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_channel_check
    CHECK (channel IN ('email', 'sms', 'push'));

COMMENT ON COLUMN public.notifications.channel IS
    'email (resend) | sms (twilio, client-facing, needs 10DLC) | push (telegram, owner alerts)';

COMMENT ON COLUMN public.notifications.provider IS
    'resend | twilio | telegram';
