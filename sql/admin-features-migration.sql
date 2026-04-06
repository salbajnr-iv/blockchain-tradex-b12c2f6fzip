-- ============================================================================
-- ADMIN FEATURES MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Platform settings table (fee config, deposit/withdrawal limits)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT 'null',
  description text,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can manage platform settings"
  ON public.platform_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ));

-- Seed default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('trading_fee_percent',      '0.25',   'Trading fee as a percentage per trade (e.g. 0.25 = 0.25%)'),
  ('deposit_minimum_usd',      '10',     'Minimum deposit amount in USD'),
  ('withdrawal_minimum_usd',   '20',     'Minimum withdrawal amount in USD'),
  ('withdrawal_maximum_usd',   '50000',  'Maximum single withdrawal amount in USD'),
  ('withdrawal_daily_limit_usd','10000', 'Maximum total withdrawals per user per day in USD')
ON CONFLICT (key) DO NOTHING;

-- 2. Admin audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  admin_email text,
  admin_name  text,
  action      text        NOT NULL,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log(action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY IF NOT EXISTS "Admins can insert audit log"
  ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ));

-- ============================================================================
-- HOW TO VERIFY:
-- SELECT * FROM public.platform_settings;
-- SELECT * FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 20;
-- ============================================================================
