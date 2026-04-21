-- ============================================================================
-- ACCOUNT CONTROLS MIGRATION
-- Force-logout, force-password-reset, force-re-KYC, freeze/unfreeze.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS force_logout_at        timestamptz,
  ADD COLUMN IF NOT EXISTS force_password_reset   boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_kyc_renewal      boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at              timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_reason          text,
  ADD COLUMN IF NOT EXISTS frozen_by              uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Allow each user to read their own enforcement flags
DROP POLICY IF EXISTS "Users read own enforcement flags" ON public.users;
CREATE POLICY "Users read own enforcement flags"
  ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Admin RPCs
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_admin_freeze_user(
  p_user_id uuid,
  p_reason  text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.users
     SET status         = 'suspended',
         frozen_at      = now(),
         frozen_reason  = p_reason,
         frozen_by      = v_caller,
         force_logout_at= now()
   WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_admin_freeze_user(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_unfreeze_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.users
     SET status        = 'active',
         frozen_at     = NULL,
         frozen_reason = NULL,
         frozen_by     = NULL
   WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_admin_unfreeze_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_force_logout(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.users SET force_logout_at = now() WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_admin_force_logout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_require_password_reset(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.users
     SET force_password_reset = true,
         force_logout_at      = now()
   WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_admin_require_password_reset(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_require_kyc_renewal(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.users
     SET force_kyc_renewal = true,
         kyc_verified      = false
   WHERE id = p_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_admin_require_kyc_renewal(uuid) TO authenticated;

-- User-side helper: clear their own force_password_reset flag after success
CREATE OR REPLACE FUNCTION public.fn_clear_password_reset_flag()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET force_password_reset = false WHERE id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.fn_clear_password_reset_flag() TO authenticated;
