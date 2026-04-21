-- ============================================================================
-- PLATFORM FLAGS / MAINTENANCE MIGRATION
-- Adds runtime feature flags and a maintenance-mode toggle.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT true,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads feature_flags"   ON public.feature_flags;
DROP POLICY IF EXISTS "Admins manage feature_flags"  ON public.feature_flags;

CREATE POLICY "Anyone reads feature_flags"
  ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage feature_flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Seed default flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('maintenance_mode',       false, 'Read-only platform-wide. Blocks trades, deposits, withdrawals.'),
  ('trading_enabled',        true,  'Enable buying/selling assets.'),
  ('deposits_enabled',       true,  'Enable deposit submissions.'),
  ('withdrawals_enabled',    true,  'Enable withdrawal submissions.'),
  ('registrations_enabled',  true,  'Allow new user signups.'),
  ('investments_enabled',    true,  'Show and allow new investments.'),
  ('leaderboard_enabled',    true,  'Show the leaderboard page.')
ON CONFLICT (key) DO NOTHING;
