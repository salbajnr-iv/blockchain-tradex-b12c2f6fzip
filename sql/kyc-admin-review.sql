-- ============================================================================
-- KYC ADMIN REVIEW MIGRATION
-- Run this in your Supabase SQL Editor after withdrawal-migration.sql
-- ============================================================================

-- ── 1. fn_admin_review_kyc: update a KYC submission and propagate to users ──

CREATE OR REPLACE FUNCTION fn_admin_review_kyc(
  p_submission_id  uuid,
  p_status         text,
  p_reviewer_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Validate status value
  IF p_status NOT IN ('pending', 'under_review', 'approved', 'rejected', 'more_info_needed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- Update the submission
  UPDATE public.kyc_submissions
  SET
    status         = p_status,
    reviewer_notes = p_reviewer_notes,
    reviewed_at    = now(),
    reviewed_by    = auth.uid()
  WHERE id = p_submission_id
  RETURNING user_id INTO v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found: %', p_submission_id;
  END IF;

  -- Propagate KYC verification status to the users table
  IF p_status = 'approved' THEN
    UPDATE public.users
    SET
      kyc_verified = true,
      updated_at   = now()
    WHERE id = v_user_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE public.users
    SET
      kyc_verified = false,
      updated_at   = now()
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- Grant execute to authenticated users (SECURITY DEFINER + internal check handles the guard)
GRANT EXECUTE ON FUNCTION fn_admin_review_kyc TO authenticated;

-- ── 2. Admin RLS policies for kyc_submissions ────────────────────────────────

-- Allow admins to view ALL KYC submissions
CREATE POLICY IF NOT EXISTS "Admins can view all kyc submissions"
  ON public.kyc_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Allow admins to update any KYC submission (to set status, reviewer_notes, etc.)
CREATE POLICY IF NOT EXISTS "Admins can update any kyc submission"
  ON public.kyc_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 3. Allow admins to view all users (required for admin user-management page)

CREATE POLICY IF NOT EXISTS "Admins can view all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  );

-- Allow admins to update any user (to toggle is_admin, status, etc.)
CREATE POLICY IF NOT EXISTS "Admins can update any user"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users AS u2
      WHERE u2.id = auth.uid() AND u2.is_admin = true
    )
  );

-- Allow admins to view all portfolios (required for platform-value stat)
CREATE POLICY IF NOT EXISTS "Admins can view all portfolios"
  ON public.portfolios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── 4. Ensure kyc_submissions has the reviewed_at / reviewed_by columns ──────
--    (Run only if you haven't done this already)

ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid DEFAULT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_notes text DEFAULT NULL;

-- ── 5. Expand transactions.status constraint to include 'rejected' ────────────
--    The default schema only allows: pending, completed, failed, cancelled.
--    Admin withdrawal rejection requires 'rejected' as a distinct status.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'rejected'));

-- ── 6. Admin storage policies for KYC document buckets ───────────────────────
--    Without these, createSignedUrl for other users' files returns 403.
--    Admins must be able to read objects from kyc-documents and kyc-selfies.

CREATE POLICY IF NOT EXISTS "Admins can read all kyc documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('kyc-documents', 'kyc-selfies')
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- HOW TO MAKE A USER AN ADMIN (if not already done via withdrawal-migration.sql):
-- UPDATE public.users SET is_admin = true WHERE email = 'admin@yourdomain.com';
-- ============================================================================
