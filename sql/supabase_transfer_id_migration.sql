-- ============================================================
-- BlockTrade: Transfer ID (UUID) Migration
-- Run this entire script in your Supabase SQL Editor
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 0. ADD transfer_id COLUMN TO users TABLE (if not present)
--    Each user gets a unique UUID used to receive transfers
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS transfer_id UUID DEFAULT gen_random_uuid() UNIQUE;

-- Backfill any existing rows that don't have a transfer_id yet
UPDATE public.users
  SET transfer_id = gen_random_uuid()
  WHERE transfer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_transfer_id ON public.users(transfer_id);


-- ──────────────────────────────────────────────────────────
-- 1. LOOKUP FUNCTION
--    Finds a user by their transfer_id (UUID)
--    Returns: found, username, display_name, transfer_id
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_lookup_user_by_transfer_id(p_transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_user   public.users%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Not authenticated');
  END IF;

  SELECT *
  INTO   v_user
  FROM   public.users
  WHERE  transfer_id = p_transfer_id
    AND  id <> v_caller_id
    AND  status = 'active'
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found',        true,
    'username',     v_user.username,
    'display_name', COALESCE(v_user.full_name, v_user.username),
    'transfer_id',  v_user.transfer_id
  );
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 2. TRANSFER FUNDS FUNCTION
--    Moves cash between portfolios using transfer_id (UUID)
--    Returns: success, error, amount, recipient_username,
--             out_transaction_id
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_transfer_funds_by_id(
  p_from_portfolio_id uuid,
  p_to_transfer_id    uuid,
  p_amount            numeric,
  p_note              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_user_id    uuid;
  v_recipient_user    public.users%ROWTYPE;
  v_recipient_portfolio_id uuid;
  v_sender_cash       numeric;
  v_tx_out_id         uuid;
  v_tx_in_id          uuid;
BEGIN
  -- Basic validation
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Get sender's user_id from their portfolio
  SELECT user_id INTO v_sender_user_id
  FROM   public.portfolios
  WHERE  id = p_from_portfolio_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender portfolio not found');
  END IF;

  -- Look up recipient by transfer_id
  SELECT * INTO v_recipient_user
  FROM   public.users
  WHERE  transfer_id = p_to_transfer_id
    AND  status = 'active'
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  -- Prevent self-transfer
  IF v_recipient_user.id = v_sender_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Get recipient's portfolio
  SELECT id INTO v_recipient_portfolio_id
  FROM   public.portfolios
  WHERE  user_id = v_recipient_user.id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient has no active portfolio');
  END IF;

  -- Check sender has sufficient balance
  SELECT cash_balance INTO v_sender_cash
  FROM   public.portfolios
  WHERE  id = p_from_portfolio_id;

  IF v_sender_cash < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct from sender
  UPDATE public.portfolios
  SET    cash_balance = cash_balance - p_amount,
         updated_at   = now()
  WHERE  id = p_from_portfolio_id;

  -- Credit to recipient
  UPDATE public.portfolios
  SET    cash_balance = cash_balance + p_amount,
         updated_at   = now()
  WHERE  id = v_recipient_portfolio_id;

  -- Log outgoing transaction (TRANSFER is valid per CHECK constraint)
  INSERT INTO public.transactions (
    portfolio_id, type, total_amount, status,
    transaction_date, notes
  )
  VALUES (
    p_from_portfolio_id, 'TRANSFER', p_amount, 'completed',
    now(),
    COALESCE(p_note, 'Transfer to ' || COALESCE(v_recipient_user.username, 'user'))
  )
  RETURNING id INTO v_tx_out_id;

  -- Log incoming transaction
  INSERT INTO public.transactions (
    portfolio_id, type, total_amount, status,
    transaction_date, notes
  )
  VALUES (
    v_recipient_portfolio_id, 'TRANSFER', p_amount, 'completed',
    now(),
    COALESCE(p_note, 'Transfer from BlockTrade user')
  )
  RETURNING id INTO v_tx_in_id;

  RETURN jsonb_build_object(
    'success',              true,
    'amount',               p_amount,
    'recipient_username',   COALESCE(v_recipient_user.username, 'user'),
    'out_transaction_id',   v_tx_out_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 3. GRANT EXECUTION RIGHTS TO AUTHENTICATED USERS
-- ──────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION fn_lookup_user_by_transfer_id(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION fn_transfer_funds_by_id(uuid, uuid, numeric, text) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- DONE ✓
-- After running this script, your app will be able to:
--   • Show users their own Transfer ID (UUID)
--   • Look up recipients by their UUID Transfer ID
--   • Execute instant fund transfers using UUID IDs
-- ──────────────────────────────────────────────────────────
