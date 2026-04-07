-- ============================================================
-- MASTER WALLET + MANUAL DEPOSIT VERIFICATION SYSTEM
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. MASTER WALLETS TABLE ─────────────────────────────────
-- Global wallet addresses shared across all users

CREATE TABLE IF NOT EXISTS master_wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset      TEXT NOT NULL,
  network    TEXT NOT NULL,
  address    TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the initial master wallet addresses
INSERT INTO master_wallets (asset, network, address) VALUES
  ('BTC',  'Bitcoin', 'bc1qk9hp7gel2mvcncckqc39hk6ypns3jqlv8n5t0c'),
  ('ETH',  'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('SOL',  'Solana',  '3avJ3X6kmq7sgjMG3KPcoQPfqyww6Cc7vHEmFK7ku2oK'),
  ('BNB',  'BEP20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('USDT', 'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('USDC', 'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7')
ON CONFLICT DO NOTHING;

-- ── 2. USER BALANCES TABLE ──────────────────────────────────
-- Per-user, per-asset balance tracking

CREATE TABLE IF NOT EXISTS user_balances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL,
  balance    NUMERIC(28, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances (user_id);

-- ── 3. DEPOSITS TABLE ───────────────────────────────────────
-- Manual crypto deposit submissions

CREATE TYPE IF NOT EXISTS deposit_status AS ENUM (
  'pending',
  'under_review',
  'completed',
  'rejected'
);

CREATE TABLE IF NOT EXISTS deposits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset       TEXT NOT NULL,
  network     TEXT NOT NULL,
  amount      NUMERIC(28, 8) NOT NULL CHECK (amount > 0),
  proof_url   TEXT,
  tx_hash     TEXT,
  status      deposit_status NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status  ON deposits (status);

-- ── 4. SUPABASE STORAGE BUCKET ──────────────────────────────
-- Create a bucket for deposit proof files (run once)
-- Note: do this via Supabase Dashboard → Storage, or uncomment below:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-proofs', 'deposit-proofs', false) ON CONFLICT DO NOTHING;

-- ── 5. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE master_wallets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits        ENABLE ROW LEVEL SECURITY;

-- master_wallets: anyone authenticated can read
DROP POLICY IF EXISTS "master_wallets_read" ON master_wallets;
CREATE POLICY "master_wallets_read"
  ON master_wallets FOR SELECT
  TO authenticated
  USING (is_active = true);

-- user_balances: users can only read their own balances
DROP POLICY IF EXISTS "user_balances_select_own" ON user_balances;
CREATE POLICY "user_balances_select_own"
  ON user_balances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- user_balances: only admins (via service role / function) can insert/update
-- Regular users never touch this table directly; balances are updated by admin approval function.

-- deposits: users can insert their own
DROP POLICY IF EXISTS "deposits_insert_own" ON deposits;
CREATE POLICY "deposits_insert_own"
  ON deposits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- deposits: users can read their own
DROP POLICY IF EXISTS "deposits_select_own" ON deposits;
CREATE POLICY "deposits_select_own"
  ON deposits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- deposits: admins can read all (check is_admin on users table)
DROP POLICY IF EXISTS "deposits_admin_select" ON deposits;
CREATE POLICY "deposits_admin_select"
  ON deposits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

-- deposits: admins can update status / admin_note / reviewed_at
DROP POLICY IF EXISTS "deposits_admin_update" ON deposits;
CREATE POLICY "deposits_admin_update"
  ON deposits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

-- user_balances: admins can insert / update
DROP POLICY IF EXISTS "user_balances_admin_upsert" ON user_balances;
CREATE POLICY "user_balances_admin_upsert"
  ON user_balances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

-- ── 6. STORAGE RLS (deposit-proofs bucket) ─────────────────
-- Allow authenticated users to upload their own proof files
-- and allow admins to read any file.
-- Run these after creating the bucket via Dashboard.

-- INSERT policy: user can upload to their own folder
-- (path pattern: <user_id>/filename)
DROP POLICY IF EXISTS "deposit_proofs_upload" ON storage.objects;
CREATE POLICY "deposit_proofs_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT policy: owner can view their proof
DROP POLICY IF EXISTS "deposit_proofs_select_own" ON storage.objects;
CREATE POLICY "deposit_proofs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT policy: admins can view all proofs
DROP POLICY IF EXISTS "deposit_proofs_admin_select" ON storage.objects;
CREATE POLICY "deposit_proofs_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'deposit-proofs'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

-- ── 7. ADMIN APPROVAL FUNCTION ──────────────────────────────
-- Safe atomic function to approve a deposit and credit balance.
-- Prevents double-crediting; must be called by an admin.

CREATE OR REPLACE FUNCTION fn_approve_deposit(p_deposit_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit    deposits%ROWTYPE;
  v_is_admin   BOOLEAN;
BEGIN
  -- 1. Verify caller is an admin
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  -- 2. Lock and fetch the deposit row
  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  -- 3. Guard: only approve pending or under_review deposits
  IF v_deposit.status NOT IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is already ' || v_deposit.status);
  END IF;

  -- 4. Mark deposit as completed
  UPDATE deposits
  SET
    status      = 'completed',
    admin_note  = COALESCE(p_admin_note, admin_note),
    reviewed_at = NOW()
  WHERE id = p_deposit_id;

  -- 5. Upsert user balance (atomic increment or create)
  INSERT INTO user_balances (user_id, asset, balance, updated_at)
  VALUES (v_deposit.user_id, v_deposit.asset, v_deposit.amount, NOW())
  ON CONFLICT (user_id, asset)
  DO UPDATE SET
    balance    = user_balances.balance + EXCLUDED.balance,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 8. ADMIN REJECT FUNCTION ────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reject_deposit(p_deposit_id UUID, p_admin_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit  deposits%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status NOT IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is already ' || v_deposit.status);
  END IF;

  UPDATE deposits
  SET
    status      = 'rejected',
    admin_note  = p_admin_note,
    reviewed_at = NOW()
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 9. ADMIN SET UNDER_REVIEW FUNCTION ──────────────────────

CREATE OR REPLACE FUNCTION fn_set_deposit_under_review(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  UPDATE deposits
  SET status = 'under_review'
  WHERE id = p_deposit_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found or not pending');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 10. AUDIT LOG ENTRIES (optional) ────────────────────────
-- Extend admin_audit_log to capture deposit actions if that table exists.
-- This is already handled by your existing logAdminAction() JS helper.

-- ── DONE ────────────────────────────────────────────────────
-- Tables:    master_wallets, user_balances, deposits
-- Functions: fn_approve_deposit, fn_reject_deposit, fn_set_deposit_under_review
-- Policies:  RLS on all three tables + storage bucket (deposit-proofs)
--
-- NEXT STEPS:
--   1. Create the 'deposit-proofs' storage bucket in Supabase Dashboard → Storage
--      (set it to private / non-public)
--   2. Run this script in Supabase SQL Editor
--   3. Verify the master_wallets rows were seeded correctly
