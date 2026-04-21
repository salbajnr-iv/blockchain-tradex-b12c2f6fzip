-- ============================================================================
-- ADMIN ROLES MIGRATION
-- Adds granular admin roles on top of the existing is_admin flag.
-- Roles: super_admin, finance, compliance, support, ops, read_only
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Add admin_role column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_role text;

-- Backfill: any existing admin becomes super_admin
UPDATE public.users
   SET admin_role = 'super_admin'
 WHERE is_admin = true AND admin_role IS NULL;

-- 2. Constrain to known roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_admin_role_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_admin_role_check
      CHECK (admin_role IS NULL OR admin_role IN
        ('super_admin','finance','compliance','support','ops','read_only'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_admin_role ON public.users(admin_role);

-- 3. Helper function: current user's role
CREATE OR REPLACE FUNCTION public.fn_current_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_role FROM public.users WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.fn_current_admin_role() TO authenticated;

-- 4. Helper: does the current user have a permission?
-- Permission map mirrored on the client in src/lib/permissions.js.
CREATE OR REPLACE FUNCTION public.fn_admin_has_permission(p_perm text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT admin_role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'super_admin' THEN RETURN true; END IF;

  RETURN CASE p_perm
    -- Finance
    WHEN 'withdrawals.review'   THEN v_role IN ('finance')
    WHEN 'deposits.review'      THEN v_role IN ('finance')
    WHEN 'balances.adjust'      THEN v_role IN ('finance')
    WHEN 'investments.manage'   THEN v_role IN ('finance')
    -- Compliance
    WHEN 'kyc.review'           THEN v_role IN ('compliance')
    WHEN 'fingerprints.view'    THEN v_role IN ('compliance')
    WHEN 'multiaccount.view'    THEN v_role IN ('compliance')
    WHEN 'platform.flags'       THEN false  -- super_admin only handled above
    WHEN 'platform.access'      THEN v_role IN ('compliance')
    WHEN 'announcements.manage' THEN v_role IN ('support')
    WHEN 'audit.view'           THEN v_role IN ('compliance')
    -- Support
    WHEN 'support.manage'       THEN v_role IN ('support')
    WHEN 'notifications.send'   THEN v_role IN ('support')
    WHEN 'users.message'        THEN v_role IN ('support')
    -- User mgmt (shared with support, finance, compliance for read)
    WHEN 'users.view'           THEN v_role IN ('support','finance','compliance','ops','read_only')
    WHEN 'users.freeze'         THEN v_role IN ('support','compliance')
    WHEN 'users.role.assign'    THEN false
    -- Ops / platform
    WHEN 'platform.settings'    THEN v_role IN ('ops')
    WHEN 'platform.maintenance' THEN v_role IN ('ops')
    WHEN 'platform.flags'       THEN v_role IN ('ops')
    WHEN 'announcements.manage' THEN v_role IN ('ops')
    WHEN 'leaderboard.manage'   THEN v_role IN ('ops')
    WHEN 'deposit_addresses.manage' THEN v_role IN ('ops')
    -- Dashboard view
    WHEN 'dashboard.view'       THEN true
    ELSE false
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_has_permission(text) TO authenticated;

-- ============================================================================
-- HOW TO VERIFY:
-- SELECT id, email, is_admin, admin_role FROM public.users WHERE is_admin = true;
-- SELECT public.fn_current_admin_role();
-- SELECT public.fn_admin_has_permission('kyc.review');
-- ============================================================================
