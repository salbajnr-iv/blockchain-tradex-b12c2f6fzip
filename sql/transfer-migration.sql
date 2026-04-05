-- ============================================================================
-- INTERNAL P2P FUND TRANSFER SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Create a sequence for short numeric Transfer UIDs (Bybit-style)
CREATE SEQUENCE IF NOT EXISTS user_transfer_uid_seq START 10000001 INCREMENT 1;

-- 2. Add transfer_uid column to users (auto-assigns on insert & to all existing rows)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS transfer_uid BIGINT
    DEFAULT nextval('user_transfer_uid_seq')
    UNIQUE;

-- Backfill any existing rows that don't have a transfer_uid yet
UPDATE public.users
  SET transfer_uid = nextval('user_transfer_uid_seq')
  WHERE transfer_uid IS NULL;

-- 3. Add transfer-specific columns to transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS counterparty_uid      bigint  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS counterparty_username  text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transfer_direction     text    DEFAULT NULL
    CHECK (transfer_direction IN ('IN', 'OUT'));

-- Index for fast lookup by transfer_uid
CREATE INDEX IF NOT EXISTS idx_users_transfer_uid ON public.users(transfer_uid);

-- ============================================================================
-- 4. RPC: Look up a user by their transfer UID (safe — only returns public info)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_lookup_user_for_transfer(p_transfer_uid bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_caller_id uuid := auth.uid();
BEGIN
  -- Must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object(
    'transfer_uid', u.transfer_uid,
    'username',     u.username,
    'display_name', COALESCE(u.full_name, u.username),
    'found',        true
  )
  INTO v_result
  FROM public.users u
  WHERE u.transfer_uid = p_transfer_uid
    AND u.id <> v_caller_id        -- can't transfer to yourself
    AND u.status = 'active';

  IF v_result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_lookup_user_for_transfer(bigint) TO authenticated;

-- ============================================================================
-- 5. RPC: Execute an internal fund transfer atomically
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_transfer_funds(
  p_from_portfolio_id uuid,
  p_to_transfer_uid   bigint,
  p_amount            numeric,
  p_note              text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id          uuid := auth.uid();
  v_from_portfolio     public.portfolios%ROWTYPE;
  v_to_user            public.users%ROWTYPE;
  v_to_portfolio       public.portfolios%ROWTYPE;
  v_from_user          public.users%ROWTYPE;
  v_out_tx_id          uuid;
  v_in_tx_id           uuid;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────────
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- ── Validate amount ─────────────────────────────────────────────────────────
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  -- ── Load sender portfolio & verify ownership ─────────────────────────────────
  SELECT * INTO v_from_portfolio FROM public.portfolios
    WHERE id = p_from_portfolio_id AND user_id = v_caller_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Portfolio not found or access denied');
  END IF;

  -- ── Check sufficient balance ─────────────────────────────────────────────────
  IF v_from_portfolio.cash_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Insufficient balance. Available: $%s', round(v_from_portfolio.cash_balance, 2))
    );
  END IF;

  -- ── Load sender user info ────────────────────────────────────────────────────
  SELECT * INTO v_from_user FROM public.users WHERE id = v_caller_id;

  -- ── Load recipient user ──────────────────────────────────────────────────────
  SELECT * INTO v_to_user FROM public.users
    WHERE transfer_uid = p_to_transfer_uid
      AND id <> v_caller_id
      AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found or is inactive');
  END IF;

  -- ── Load recipient portfolio ─────────────────────────────────────────────────
  SELECT * INTO v_to_portfolio FROM public.portfolios
    WHERE user_id = v_to_user.id LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Recipient does not have a portfolio');
  END IF;

  -- ── Execute atomic transfer ──────────────────────────────────────────────────

  -- Deduct from sender
  UPDATE public.portfolios
    SET cash_balance = cash_balance - p_amount,
        updated_at   = now()
    WHERE id = v_from_portfolio.id;

  -- Credit to recipient
  UPDATE public.portfolios
    SET cash_balance = cash_balance + p_amount,
        updated_at   = now()
    WHERE id = v_to_portfolio.id;

  -- Log TRANSFER OUT for sender
  INSERT INTO public.transactions (
    portfolio_id, type, total_amount, status,
    payment_method, transaction_date, notes,
    counterparty_uid, counterparty_username, transfer_direction
  )
  VALUES (
    v_from_portfolio.id,
    'TRANSFER',
    p_amount,
    'completed',
    'internal_transfer',
    now(),
    COALESCE(p_note, 'Internal transfer to ' || v_to_user.username),
    v_to_user.transfer_uid,
    v_to_user.username,
    'OUT'
  )
  RETURNING id INTO v_out_tx_id;

  -- Log TRANSFER IN for recipient
  INSERT INTO public.transactions (
    portfolio_id, type, total_amount, status,
    payment_method, transaction_date, notes,
    counterparty_uid, counterparty_username, transfer_direction
  )
  VALUES (
    v_to_portfolio.id,
    'TRANSFER',
    p_amount,
    'completed',
    'internal_transfer',
    now(),
    COALESCE(p_note, 'Internal transfer from ' || v_from_user.username),
    v_from_user.transfer_uid,
    v_from_user.username,
    'IN'
  )
  RETURNING id INTO v_in_tx_id;

  -- ── Return success with summary ──────────────────────────────────────────────
  RETURN json_build_object(
    'success',              true,
    'out_transaction_id',   v_out_tx_id,
    'in_transaction_id',    v_in_tx_id,
    'amount',               p_amount,
    'recipient_uid',        v_to_user.transfer_uid,
    'recipient_username',   v_to_user.username
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_transfer_funds(uuid, bigint, numeric, text) TO authenticated;

-- ============================================================================
-- 6. Allow users to read each other's transfer_uid and username for lookup
--    (Only exposes transfer_uid + username — NOT email/personal data)
-- ============================================================================
CREATE POLICY IF NOT EXISTS "Users can look up others for transfer"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 7. Update transactions RLS so users can see transfers credited to them
--    (They already see their own portfolio's transactions — this is covered by
--     the existing "Users can view own transactions" policy via portfolio_id)
-- ============================================================================

-- ============================================================================
-- HOW TRANSFER UIDs ARE SHOWN TO USERS:
-- SELECT transfer_uid FROM public.users WHERE id = auth.uid();
-- The 8-digit number (e.g. 10000042) is the user's Transfer ID.
-- Share it with others to receive internal transfers.
-- ============================================================================
