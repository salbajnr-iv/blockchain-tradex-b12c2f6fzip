-- ============================================================================
-- BLOCKTRADE — PAYMENT METHODS & DEPOSIT REQUESTS SCHEMA
-- ============================================================================
-- Run this in your Supabase SQL Editor AFTER running the main database.sql
-- This adds: payment_methods, deposit_requests, two SECURITY DEFINER
-- functions, and locks cash_balance from direct user mutation.
-- ============================================================================

-- ============================================================================
-- 1. PAYMENT METHODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type: 'card' | 'bank_account' | 'paypal'
  type               text NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),

  -- Card fields (only safe/masked data stored — never full number or CVV)
  card_brand         text,            -- 'visa' | 'mastercard' | 'amex' | 'discover'
  card_last_four     text,
  card_holder_name   text,
  expiry_month       integer CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year        integer,

  -- Bank account fields
  bank_name          text,
  account_last_four  text,
  account_holder     text,
  routing_last_four  text,

  -- PayPal
  paypal_email       text,

  -- Meta
  label              text,           -- user-defined nickname
  is_default         boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_user_id ON public.payment_methods(user_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select_own" ON public.payment_methods
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pm_insert_own" ON public.payment_methods
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_update_own" ON public.payment_methods
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_delete_own" ON public.payment_methods
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 2. DEPOSIT REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id      uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,

  amount            decimal(20,2) NOT NULL CHECK (amount > 0),
  fee               decimal(20,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  net_amount        decimal(20,2) NOT NULL CHECK (net_amount > 0),

  -- status lifecycle: pending → processing → completed | failed | cancelled
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  reference_code    text UNIQUE DEFAULT
                    'DEP-' || upper(substring(gen_random_uuid()::text FROM 1 FOR 8)),

  notes             text,
  failure_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dr_portfolio_id ON public.deposit_requests(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_dr_user_id      ON public.deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dr_status       ON public.deposit_requests(status);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own deposit requests
CREATE POLICY "dr_select_own" ON public.deposit_requests
  FOR SELECT USING (user_id = auth.uid());

-- Users can create deposit requests for their own portfolios
CREATE POLICY "dr_insert_own" ON public.deposit_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.portfolios WHERE id = portfolio_id AND user_id = auth.uid())
  );

-- Users CANNOT directly update or delete deposit requests
-- (only the SECURITY DEFINER function below can modify them)

-- ============================================================================
-- 3. SECURITY DEFINER FUNCTION: fn_process_deposit
-- ============================================================================
-- This is the ONLY code path that credits cash_balance for a deposit.
-- It verifies ownership, marks the request completed, and logs a transaction.
-- Because it is SECURITY DEFINER it runs as the function owner (bypassing RLS)
-- which is necessary since users cannot UPDATE cash_balance directly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_process_deposit(p_deposit_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req    public.deposit_requests;
  v_port   public.portfolios;
  v_new_bal decimal(20,2);
BEGIN
  -- Fetch and lock the deposit request
  SELECT * INTO v_req
  FROM   public.deposit_requests
  WHERE  id = p_deposit_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found');
  END IF;

  -- Ownership check
  IF v_req.user_id <> auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Idempotency guard
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN json_build_object('success', false, 'error', 'Deposit already processed',
                             'status', v_req.status);
  END IF;

  -- Fetch and lock portfolio
  SELECT * INTO v_port
  FROM   public.portfolios
  WHERE  id = v_req.portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Portfolio not found');
  END IF;

  v_new_bal := v_port.cash_balance + v_req.net_amount;

  -- Credit the portfolio
  UPDATE public.portfolios
  SET    cash_balance = v_new_bal,
         updated_at   = now()
  WHERE  id = v_port.id;

  -- Mark deposit completed
  UPDATE public.deposit_requests
  SET    status       = 'completed',
         processed_at = now()
  WHERE  id = v_req.id;

  -- Audit log in transactions table
  INSERT INTO public.transactions (
    portfolio_id, type, total_amount, status, transaction_date, notes
  ) VALUES (
    v_req.portfolio_id,
    'DEPOSIT',
    v_req.net_amount,
    'completed',
    now(),
    'Deposit (ref: ' || COALESCE(v_req.reference_code, v_req.id::text) || ')'
  );

  RETURN json_build_object(
    'success',        true,
    'new_balance',    v_new_bal,
    'reference_code', v_req.reference_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_process_deposit(uuid) TO authenticated;

-- ============================================================================
-- 4. SECURITY DEFINER FUNCTION: fn_update_cash_after_trade
-- ============================================================================
-- Trades (BUY/SELL) need to adjust cash_balance. Because direct UPDATE on
-- cash_balance is blocked for users (see section 5), executeTrade() on the
-- frontend calls this function instead.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_update_cash_after_trade(
  p_portfolio_id uuid,
  p_new_balance  decimal
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller owns this portfolio
  IF NOT EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE  id = p_portfolio_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.portfolios
  SET    cash_balance = p_new_balance,
         updated_at   = now()
  WHERE  id = p_portfolio_id;

  RETURN json_build_object('success', true, 'new_balance', p_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_cash_after_trade(uuid, decimal) TO authenticated;

-- ============================================================================
-- 5. LOCK cash_balance FROM DIRECT USER UPDATES
-- ============================================================================
-- Users get UPDATE permission only on non-financial columns.
-- All cash_balance changes must go through fn_process_deposit or
-- fn_update_cash_after_trade above.
-- ============================================================================

-- Revoke the blanket UPDATE granted by the existing RLS policy's implicit
-- column access and re-grant only safe columns.
REVOKE UPDATE (cash_balance) ON public.portfolios FROM authenticated;

-- Ensure safe columns are still updatable by users
GRANT UPDATE (name, description, is_public, currency, updated_at)
  ON public.portfolios TO authenticated;

-- ============================================================================
-- 6. ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_methods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;

-- ============================================================================
-- Done. Summary of what was created:
--   • public.payment_methods  — saved cards/banks (masked, no raw card data)
--   • public.deposit_requests — audit trail for every fund request
--   • fn_process_deposit()    — SECURITY DEFINER: credits balance on deposit
--   • fn_update_cash_after_trade() — SECURITY DEFINER: adjusts balance on trade
--   • cash_balance locked from direct UPDATE by authenticated users
-- ============================================================================
