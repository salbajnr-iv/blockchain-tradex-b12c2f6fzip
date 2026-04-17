-- ─────────────────────────────────────────────────────────────────
-- BlockTrade Email Notifications Setup
-- Run this in your Supabase SQL Editor to enable email notifications.
-- ─────────────────────────────────────────────────────────────────

-- 1. Create email_queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  user_email   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  subject      TEXT NOT NULL,
  content      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ
);

-- 2. Index for efficient polling
CREATE INDEX IF NOT EXISTS email_queue_status_idx ON public.email_queue (status, created_at);
CREATE INDEX IF NOT EXISTS email_queue_user_idx   ON public.email_queue (user_id);

-- 3. Enable Row Level Security (users can only read their own emails)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email queue" ON public.email_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.email_queue
  USING (true)
  WITH CHECK (true);

-- 4. Grant insert for authenticated users (app inserts their own queue entries)
GRANT INSERT ON public.email_queue TO authenticated;
GRANT SELECT ON public.email_queue TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- NEXT STEP: Deploy the Supabase Edge Function
-- ─────────────────────────────────────────────────────────────────
-- After running this SQL:
-- 1. Get a Resend API key from https://resend.com (free tier available)
-- 2. Deploy the Edge Function:
--    supabase functions deploy send-email-notification
-- 3. Set the secret:
--    supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
--    supabase secrets set FROM_EMAIL=noreply@yourdomain.com
-- 4. Create a Database Webhook in Supabase Dashboard:
--    Table: email_queue  |  Event: INSERT
--    URL: https://<project-ref>.supabase.co/functions/v1/send-email-notification
-- ─────────────────────────────────────────────────────────────────
