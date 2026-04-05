-- ============================================================================
-- BLOCKTRADE — MISSING TABLES, COLUMNS, STORAGE & FIXES
-- ============================================================================
-- Run this in your Supabase SQL Editor AFTER running database.sql,
-- cards-deposit-schema.sql, and supabase-updates.sql.
--
-- This script is fully idempotent — safe to run on an existing database.
-- It fixes:
--   1. Missing columns on public.users (date_of_birth, bio)
--   2. Updated handle_new_auth_user trigger to capture all signup fields
--   3. Sync function: auth metadata → public.users on every profile update
--   4. kyc_submissions table for KYC document tracking
--   5. user_preferences table (guard re-creation)
--   6. Storage buckets: avatars, kyc-documents, kyc-selfies
--   7. Storage RLS policies for each bucket
-- ============================================================================


-- ============================================================================
-- 1. ADD MISSING COLUMNS TO public.users
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS bio text;

-- ============================================================================
-- 2. REBUILD handle_new_auth_user — CAPTURE ALL SIGNUP FIELDS
-- ============================================================================
-- The original trigger only saved full_name. This version also saves
-- phone_number, country, and date_of_birth from raw_user_meta_data
-- so that fields entered at registration are persisted immediately.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_portfolio_id uuid;
  username_val     text;
BEGIN
  -- Derive a unique username: email prefix + first 6 chars of UUID (no dashes)
  username_val := split_part(NEW.email, '@', 1)
               || '_'
               || substring(replace(NEW.id::text, '-', ''), 1, 6);

  -- Insert the user profile row, carrying over all available metadata
  INSERT INTO public.users (
    id,
    email,
    username,
    full_name,
    phone_number,
    country,
    date_of_birth
  )
  VALUES (
    NEW.id,
    NEW.email,
    username_val,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'country', '')), ''),
    CASE
      WHEN NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'date_of_birth', '')), '') IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create the user's default portfolio with $0 starting balance
  INSERT INTO public.portfolios (user_id, name, cash_balance, initial_investment)
  VALUES (NEW.id, 'My Portfolio', 0.00, 0.00)
  ON CONFLICT DO NOTHING
  RETURNING id INTO new_portfolio_id;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (drop first to replace cleanly)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

GRANT EXECUTE ON FUNCTION public.handle_new_auth_user TO authenticated, service_role;


-- ============================================================================
-- 3. SYNC FUNCTION: auth metadata → public.users ON PROFILE UPDATE
-- ============================================================================
-- When a user calls supabase.auth.updateUser({ data: {...} }), Supabase
-- updates auth.users.raw_user_meta_data but does NOT touch public.users.
-- This function is called by the application (or a trigger) to keep them in sync.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_user_profile(
  p_user_id    uuid,
  p_full_name  text   DEFAULT NULL,
  p_phone      text   DEFAULT NULL,
  p_country    text   DEFAULT NULL,
  p_bio        text   DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only the authenticated user can sync their own profile
  IF p_user_id <> auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.users
  SET
    full_name    = COALESCE(p_full_name, full_name),
    phone_number = COALESCE(p_phone,     phone_number),
    country      = COALESCE(p_country,   country),
    bio          = COALESCE(p_bio,       bio),
    updated_at   = now()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_user_profile(uuid, text, text, text, text) TO authenticated;


-- ============================================================================
-- 4. KYC SUBMISSIONS TABLE
-- ============================================================================
-- Tracks every KYC verification attempt: uploaded documents, review status,
-- and reviewer notes. Separate from the kyc_verified / kyc_tier columns on
-- public.users, which represent the current verified state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tier being applied for
  tier              text NOT NULL DEFAULT 'intermediate'
                    CHECK (tier IN ('intermediate', 'pro')),

  -- Current lifecycle status
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'more_info_needed')),

  -- Document storage paths (relative to the kyc-documents bucket)
  id_document_path  text,           -- e.g. "<user_id>/id_front.jpg"
  id_back_path      text,           -- e.g. "<user_id>/id_back.jpg"
  selfie_path       text,           -- e.g. "<user_id>/selfie.jpg" (kyc-selfies bucket)
  proof_of_address_path text,       -- e.g. "<user_id>/address_proof.pdf"

  -- Document metadata
  document_type     text CHECK (document_type IN ('passport', 'national_id', 'drivers_license', 'residence_permit')),
  document_number   text,
  document_country  text,
  document_expiry   date,

  -- Personal details submitted with the KYC form
  legal_first_name  text,
  legal_last_name   text,
  date_of_birth     date,
  nationality       text,
  address_line1     text,
  address_line2     text,
  city              text,
  postal_code       text,
  country           text,

  -- Review metadata
  reviewer_notes    text,
  rejection_reason  text,
  reviewed_at       timestamptz,

  submitted_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status  ON public.kyc_submissions(status);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "kyc_select_own" ON public.kyc_submissions
  FOR SELECT USING (user_id = auth.uid());

-- Users can create a submission for themselves
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pending submissions (e.g. re-upload docs)
CREATE POLICY "kyc_update_own_pending" ON public.kyc_submissions
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('pending', 'more_info_needed'))
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kyc_submissions_updated_at'
  ) THEN
    CREATE TRIGGER trg_kyc_submissions_updated_at
      BEFORE UPDATE ON public.kyc_submissions
      FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
  END IF;
END $$;

-- Grant table access
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_submissions;


-- ============================================================================
-- 5. ENSURE user_preferences TABLE EXISTS (safe re-run guard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme       text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  notif_prefs jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Upsert the policy safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_preferences' AND policyname = 'Users manage own preferences'
  ) THEN
    CREATE POLICY "Users manage own preferences"
      ON public.user_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_preferences_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_preferences_updated_at
      BEFORE UPDATE ON public.user_preferences
      FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;


-- ============================================================================
-- 6. STORAGE BUCKETS
-- ============================================================================
-- Creates three private buckets:
--   • avatars        — user profile pictures
--   • kyc-documents  — government-issued IDs, proof of address
--   • kyc-selfies    — selfie photos for liveness check
-- Files are stored as: <user_id>/<filename>
-- ============================================================================

-- avatars bucket (private — users serve their own via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  5242880,   -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- kyc-documents bucket (private — restricted to owners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,  -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- kyc-selfies bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-selfies',
  'kyc-selfies',
  false,
  5242880,   -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 7. STORAGE RLS POLICIES
-- ============================================================================
-- Convention: files must be stored under the user's own ID as folder prefix.
-- e.g. storage path: "abc123-user-id/avatar.jpg"
-- ============================================================================

-- ── avatars ──────────────────────────────────────────────────────────────────

-- Users can upload their own avatar
CREATE POLICY "avatars: users can upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update (replace) their own avatar
CREATE POLICY "avatars: users can update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own avatar
CREATE POLICY "avatars: users can view own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatar
CREATE POLICY "avatars: users can delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── kyc-documents ─────────────────────────────────────────────────────────────

-- Users can upload their own KYC documents
CREATE POLICY "kyc-documents: users can upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own KYC documents
CREATE POLICY "kyc-documents: users can update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view only their own KYC documents
CREATE POLICY "kyc-documents: users can view own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own KYC documents (e.g. to re-upload)
CREATE POLICY "kyc-documents: users can delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── kyc-selfies ───────────────────────────────────────────────────────────────

CREATE POLICY "kyc-selfies: users can upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "kyc-selfies: users can update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'kyc-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "kyc-selfies: users can view own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "kyc-selfies: users can delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-selfies'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================================
-- 8. GRANT UPDATE ON new columns to authenticated users
-- ============================================================================

GRANT UPDATE (full_name, phone_number, country, date_of_birth, bio, avatar_url, updated_at)
  ON public.users TO authenticated;


-- ============================================================================
-- DONE
-- ============================================================================
-- Summary of changes:
--   ✓ public.users — added date_of_birth and bio columns
--   ✓ handle_new_auth_user — now saves phone, country, date_of_birth at signup
--   ✓ fn_sync_user_profile() — call this after supabase.auth.updateUser() to
--       sync full_name, phone, country, bio into public.users
--   ✓ kyc_submissions — new table for KYC document tracking with full RLS
--   ✓ user_preferences — safe re-creation guard
--   ✓ Storage buckets: avatars (5MB), kyc-documents (10MB), kyc-selfies (5MB)
--   ✓ Storage RLS: each user can only access files under their own user_id prefix
-- ============================================================================
