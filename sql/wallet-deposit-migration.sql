-- =============================================================================
-- BlockTrade — Master Wallet & Manual Deposit Verification System
-- Run this entire script in your Supabase SQL Editor (once).
-- Safe to re-run: all objects use IF NOT EXISTS / OR REPLACE.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MASTER WALLETS
--    Shared deposit addresses, one row per asset/network combination.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.master_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset       text NOT NULL,
  network     text NOT NULL,
  address     text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset, network)
);

-- Seed the initial wallet addresses (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO public.master_wallets (asset, network, address) VALUES
  ('BTC',  'Bitcoin', 'bc1qk9hp7gel2mvcncckqc39hk6ypns3jqlv8n5t0c'),
  ('ETH',  'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('SOL',  'Solana',  '3avJ3X6kmq7sgjMG3KPcoQPfqyww6Cc7vHEmFK7ku2oK'),
  ('BNB',  'BEP20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('USDT', 'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7'),
  ('USDC', 'ERC20',   '0x277aE008E2d37D560B6034D10aBEc5f29c384Ca7')
ON CONFLICT (asset, network) DO NOTHING;

-- RLS: any authenticated user can read active wallets; only admins modify
ALTER TABLE public.master_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_wallets_read" ON public.master_wallets;
CREATE POLICY "master_wallets_read"
  ON public.master_wallets FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "master_wallets_admin_all" ON public.master_wallets;
CREATE POLICY "master_wallets_admin_all"
  ON public.master_wallets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. USER BALANCES
--    Per-user, per-asset crypto balances.
--    Updated only by admin-approved deposits or admin manual adjustments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_balances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset      text NOT NULL,
  balance    numeric(28, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset)
);

CREATE INDEX IF NOT EXISTS user_balances_user_id_idx ON public.user_balances (user_id);

-- RLS: users see only their own balances; admins see all
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_balances_own_select" ON public.user_balances;
CREATE POLICY "user_balances_own_select"
  ON public.user_balances FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_balances_admin_all" ON public.user_balances;
CREATE POLICY "user_balances_admin_all"
  ON public.user_balances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DEPOSITS
--    Manual crypto deposit submissions awaiting admin review.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_status') THEN
    CREATE TYPE public.deposit_status AS ENUM (
      'pending', 'under_review', 'completed', 'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.deposits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset       text NOT NULL,
  network     text NOT NULL,
  amount      numeric(28, 8) NOT NULL CHECK (amount > 0),
  tx_hash     text,
  proof_url   text,
  status      public.deposit_status NOT NULL DEFAULT 'pending',
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS deposits_user_id_idx    ON public.deposits (user_id);
CREATE INDEX IF NOT EXISTS deposits_status_idx     ON public.deposits (status);
CREATE INDEX IF NOT EXISTS deposits_created_at_idx ON public.deposits (created_at DESC);

-- RLS
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposits_own_select" ON public.deposits;
CREATE POLICY "deposits_own_select"
  ON public.deposits FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "deposits_own_insert" ON public.deposits;
CREATE POLICY "deposits_own_insert"
  ON public.deposits FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users may NOT update their own deposits (status changes are admin-only)

DROP POLICY IF EXISTS "deposits_admin_all" ON public.deposits;
CREATE POLICY "deposits_admin_all"
  ON public.deposits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADMIN NOTIFICATIONS
--    Broadcast or targeted messages sent by admins to users.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  message          text NOT NULL,
  type             text NOT NULL DEFAULT 'announcement',
  icon             text NOT NULL DEFAULT '📢',
  target_type      text NOT NULL DEFAULT 'all'
                     CHECK (target_type IN ('all', 'individual')),
  target_user_ids  uuid[],
  created_by       uuid REFERENCES auth.users(id),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notifications_active_idx ON public.admin_notifications (is_active, created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_notifications_read" ON public.admin_notifications;
CREATE POLICY "admin_notifications_read"
  ON public.admin_notifications FOR SELECT
  USING (
    is_active = true
    AND (
      target_type = 'all'
      OR auth.uid() = ANY(target_user_ids)
    )
  );

DROP POLICY IF EXISTS "admin_notifications_admin_all" ON public.admin_notifications;
CREATE POLICY "admin_notifications_admin_all"
  ON public.admin_notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SUPPORT TICKETS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  user_name   text,
  subject     text NOT NULL,
  category    text NOT NULL DEFAULT 'general',
  priority    text NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'pending', 'answered', 'closed')),
  admin_reply text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx  ON public.support_tickets (status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_own" ON public.support_tickets;
CREATE POLICY "support_tickets_own"
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert"
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_all"
  ON public.support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── fn_approve_deposit ───────────────────────────────────────────────────────
-- Atomically marks a deposit completed and credits the user's crypto balance.
-- Prevents double-crediting by checking status = 'pending' | 'under_review'.
CREATE OR REPLACE FUNCTION public.fn_approve_deposit(
  p_deposit_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit   public.deposits%ROWTYPE;
  v_balance   numeric(28,8);
BEGIN
  -- Lock the row to prevent race conditions
  SELECT * INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already approved');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot approve a rejected deposit');
  END IF;

  -- Update deposit status
  UPDATE public.deposits
  SET
    status      = 'completed',
    admin_note  = p_admin_note,
    reviewed_at = now()
  WHERE id = p_deposit_id;

  -- Credit user_balances (upsert)
  INSERT INTO public.user_balances (user_id, asset, balance, updated_at)
  VALUES (v_deposit.user_id, v_deposit.asset, v_deposit.amount, now())
  ON CONFLICT (user_id, asset)
  DO UPDATE SET
    balance    = public.user_balances.balance + v_deposit.amount,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'deposit_id', p_deposit_id);
END;
$$;


-- ── fn_reject_deposit ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_reject_deposit(
  p_deposit_id uuid,
  p_admin_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
BEGIN
  SELECT * INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reject a completed deposit');
  END IF;

  UPDATE public.deposits
  SET
    status      = 'rejected',
    admin_note  = p_admin_note,
    reviewed_at = now()
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ── fn_set_deposit_under_review ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_deposit_under_review(
  p_deposit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.deposits
  SET status = 'under_review'
  WHERE id = p_deposit_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found or already processed');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ── fn_admin_adjust_crypto_balance ───────────────────────────────────────────
-- Operations: 'add' | 'deduct' | 'set' | 'delete'
CREATE OR REPLACE FUNCTION public.fn_admin_adjust_crypto_balance(
  p_user_id   uuid,
  p_asset     text,
  p_operation text,
  p_amount    numeric(28,8),
  p_note      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance numeric(28,8);
BEGIN
  IF p_operation = 'delete' THEN
    DELETE FROM public.user_balances
    WHERE user_id = p_user_id AND asset = p_asset;
    RETURN jsonb_build_object('success', true, 'operation', 'delete');
  END IF;

  IF p_operation = 'set' THEN
    INSERT INTO public.user_balances (user_id, asset, balance, updated_at)
    VALUES (p_user_id, p_asset, p_amount, now())
    ON CONFLICT (user_id, asset)
    DO UPDATE SET balance = p_amount, updated_at = now()
    RETURNING balance INTO v_new_balance;
  ELSIF p_operation = 'add' THEN
    INSERT INTO public.user_balances (user_id, asset, balance, updated_at)
    VALUES (p_user_id, p_asset, p_amount, now())
    ON CONFLICT (user_id, asset)
    DO UPDATE SET balance = public.user_balances.balance + p_amount, updated_at = now()
    RETURNING balance INTO v_new_balance;
  ELSIF p_operation = 'deduct' THEN
    UPDATE public.user_balances
    SET balance = GREATEST(0, balance - p_amount), updated_at = now()
    WHERE user_id = p_user_id AND asset = p_asset
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Balance row not found');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown operation: ' || p_operation);
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;


-- ── fn_admin_adjust_balance (cash balance) ───────────────────────────────────
-- Operations: 'add' | 'deduct' | 'set'
CREATE OR REPLACE FUNCTION public.fn_admin_adjust_balance(
  p_portfolio_id uuid,
  p_operation    text,
  p_amount       numeric(18,2),
  p_note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance numeric(18,2);
BEGIN
  IF p_operation = 'add' THEN
    UPDATE public.portfolios
    SET cash_balance = cash_balance + p_amount, updated_at = now()
    WHERE id = p_portfolio_id
    RETURNING cash_balance INTO v_new_balance;
  ELSIF p_operation = 'deduct' THEN
    UPDATE public.portfolios
    SET cash_balance = GREATEST(0, cash_balance - p_amount), updated_at = now()
    WHERE id = p_portfolio_id
    RETURNING cash_balance INTO v_new_balance;
  ELSIF p_operation = 'set' THEN
    UPDATE public.portfolios
    SET cash_balance = p_amount, updated_at = now()
    WHERE id = p_portfolio_id
    RETURNING cash_balance INTO v_new_balance;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown operation: ' || p_operation);
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portfolio not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;


-- ── fn_admin_lock_balance ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_admin_lock_balance(
  p_portfolio_id uuid,
  p_locked       boolean,
  p_reason       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.portfolios
  SET
    balance_locked        = p_locked,
    balance_locked_reason = CASE WHEN p_locked THEN p_reason ELSE NULL END,
    balance_locked_at     = CASE WHEN p_locked THEN now() ELSE NULL END,
    updated_at            = now()
  WHERE id = p_portfolio_id;
END;
$$;


-- ── fn_admin_update_withdrawal ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_admin_update_withdrawal(
  p_transaction_id uuid,
  p_status         text,
  p_admin_message  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id AND type = 'WITHDRAWAL'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal transaction not found';
  END IF;

  UPDATE public.transactions
  SET
    status         = p_status,
    admin_message  = p_admin_message,
    reviewed_at    = now()
  WHERE id = p_transaction_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STORAGE BUCKET
--    Run these in the Supabase Dashboard → Storage → New Bucket,
--    OR execute via the management API.
--    The SQL below documents the configuration; buckets cannot be created
--    via plain SQL in Supabase — use the Dashboard or Storage API.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Bucket name : deposit-proofs
-- Public      : NO  (signed URLs only)
-- File size   : 10 MB max
-- Allowed MIME: image/jpeg, image/png, image/webp, image/gif, application/pdf
--
-- After creating the bucket, add these storage policies in the Dashboard:
--
-- Policy 1 — Authenticated users can upload their own proofs:
--   Operation : INSERT
--   Target     : deposit-proofs
--   Expression : (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy 2 — Admins can read any proof file:
--   Operation : SELECT
--   Target     : deposit-proofs
--   Expression :
--     EXISTS (
--       SELECT 1 FROM public.users
--       WHERE id = auth.uid() AND is_admin = true
--     )
--
-- Policy 3 — Users can read their own uploaded proofs:
--   Operation : SELECT
--   Target     : deposit-proofs
--   Expression : (auth.uid()::text = (storage.foldername(name))[1])
--
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. GRANT EXECUTE on functions to authenticated role
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_approve_deposit            TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reject_deposit             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_deposit_under_review   TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_adjust_crypto_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_adjust_balance        TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_lock_balance          TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_withdrawal     TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Done!
-- ─────────────────────────────────────────────────────────────────────────────
-- Next steps after running this script:
--   1. Go to Supabase Dashboard → Storage → Create bucket "deposit-proofs"
--      (set to Private, 10 MB limit)
--   2. Add the three storage policies described in Section 7 above
--   3. Make sure at least one user has is_admin = true in the users table
--      (UPDATE public.users SET is_admin = true WHERE email = 'your@email.com')
-- =============================================================================
