-- ============================================================================
-- DEVICE FINGERPRINTS MIGRATION
-- Stores active client-side fingerprints (canvas / audio / WebGL).
-- Only admins can read. Authenticated users can insert/update their OWN rows.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  visitor_id    text        NOT NULL,
  canvas_hash   text,
  audio_hash    text,
  webgl_hash    text,
  components    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  user_agent    text,
  language      text,
  timezone      text,
  screen        text,
  platform      text,
  ip_address    text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  seen_count    integer     NOT NULL DEFAULT 1,
  CONSTRAINT device_fingerprints_user_visitor_unique UNIQUE (user_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id
  ON public.device_fingerprints(user_id);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_visitor_id
  ON public.device_fingerprints(visitor_id);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_last_seen
  ON public.device_fingerprints(last_seen_at DESC);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Drop old policies if rerunning
DROP POLICY IF EXISTS "Admins can read device fingerprints"   ON public.device_fingerprints;
DROP POLICY IF EXISTS "Users can insert own device fingerprint" ON public.device_fingerprints;
DROP POLICY IF EXISTS "Users can update own device fingerprint" ON public.device_fingerprints;
DROP POLICY IF EXISTS "Admins can delete device fingerprints" ON public.device_fingerprints;

-- Only admins can SELECT
CREATE POLICY "Admins can read device fingerprints"
  ON public.device_fingerprints
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ));

-- Authenticated users can INSERT their own row
CREATE POLICY "Users can insert own device fingerprint"
  ON public.device_fingerprints
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users can UPDATE their own row (to bump last_seen_at / seen_count)
CREATE POLICY "Users can update own device fingerprint"
  ON public.device_fingerprints
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can DELETE
CREATE POLICY "Admins can delete device fingerprints"
  ON public.device_fingerprints
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ));

-- ============================================================================
-- HOW TO VERIFY:
-- SELECT * FROM public.device_fingerprints ORDER BY last_seen_at DESC LIMIT 20;
-- ============================================================================
