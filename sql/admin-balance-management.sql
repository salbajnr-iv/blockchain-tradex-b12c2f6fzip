-- ============================================================================
-- ADMIN BALANCE MANAGEMENT MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ── 1. Add balance_locked flag to portfolios ──────────────────────────────────
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS balance_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_locked_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS balance_locked_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS balance_locked_by uuid DEFAULT NULL REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 2. fn_admin_adjust_balance — add, deduct, or set a user's cash balance ────
--    p_portfolio_id : target portfolio
--    p_operation    : 'add' | 'deduct' | 'set'
--    p_amount       : the amount (always positive; for 'deduct' it is subtracted)
--    p_note         : admin reason/note (required)

CREATE OR REPLACE FUNCTION fn_admin_adjust_balance(
  p_portfolio_id uuid,
  p_operation    text,
  p_amount       numeric,
  p_note         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance     numeric;
  v_tx_type         text;
BEGIN
  -- Guard: only admins may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Validate operation
  IF p_operation NOT IN ('add', 'deduct', 'set') THEN
    RAISE EXCEPTION 'Invalid operation: %. Must be add, deduct, or set', p_operation;
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative';
  END IF;

  -- Fetch current balance
  SELECT cash_balance INTO v_current_balance
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_id;
  END IF;

  -- Calculate new balance
  CASE p_operation
    WHEN 'add'    THEN v_new_balance := v_current_balance + p_amount;
                       v_tx_type     := 'DEPOSIT';
    WHEN 'deduct' THEN v_new_balance := v_current_balance - p_amount;
                       v_tx_type     := 'WITHDRAWAL';
    WHEN 'set'    THEN v_new_balance := p_amount;
                       v_tx_type     := CASE WHEN p_amount >= v_current_balance THEN 'DEPOSIT' ELSE 'WITHDRAWAL' END;
  END CASE;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Resulting balance would be negative (current: %, deduct: %)', v_current_balance, p_amount;
  END IF;

  -- Update the portfolio
  UPDATE public.portfolios
  SET cash_balance = v_new_balance,
      updated_at   = now()
  WHERE id = p_portfolio_id;

  -- Log the operation to transactions table
  INSERT INTO public.transactions (
    portfolio_id,
    type,
    total_amount,
    status,
    notes,
    transaction_date
  ) VALUES (
    p_portfolio_id,
    v_tx_type,
    ABS(v_new_balance - v_current_balance),
    'completed',
    '[Admin] ' || p_note,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'operation', p_operation
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_admin_adjust_balance TO authenticated;

-- ── 3. fn_admin_lock_balance — lock or unlock a user's balance ─────────────────

CREATE OR REPLACE FUNCTION fn_admin_lock_balance(
  p_portfolio_id uuid,
  p_locked       boolean,
  p_reason       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.portfolios
  SET balance_locked        = p_locked,
      balance_locked_reason = CASE WHEN p_locked THEN p_reason ELSE NULL END,
      balance_locked_at     = CASE WHEN p_locked THEN now() ELSE NULL END,
      balance_locked_by     = CASE WHEN p_locked THEN auth.uid() ELSE NULL END,
      updated_at            = now()
  WHERE id = p_portfolio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_admin_lock_balance TO authenticated;

-- ── 4. Allow admins to SELECT all portfolios (extended — includes new cols) ───
--    (This policy may already exist from kyc-admin-review.sql — safe to re-run)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolios' AND policyname = 'Admins can view all portfolios'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can view all portfolios"
        ON public.portfolios FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
          )
        )
    $policy$;
  END IF;
END;
$$;

-- Allow admins to UPDATE all portfolios (for balance adjustments via direct RLS)
CREATE POLICY IF NOT EXISTS "Admins can update all portfolios"
  ON public.portfolios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to INSERT transactions (balance adjustment audit logs)
CREATE POLICY IF NOT EXISTS "Admins can insert transactions"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================================
-- USAGE SUMMARY:
-- 1. Add funds:    SELECT fn_admin_adjust_balance(portfolio_id, 'add',    500, 'Bonus credit');
-- 2. Deduct funds: SELECT fn_admin_adjust_balance(portfolio_id, 'deduct', 200, 'Fee reversal');
-- 3. Set balance:  SELECT fn_admin_adjust_balance(portfolio_id, 'set',   1000, 'Balance correction');
-- 4. Lock:         SELECT fn_admin_lock_balance(portfolio_id, true,  'Suspicious activity');
-- 5. Unlock:       SELECT fn_admin_lock_balance(portfolio_id, false);
-- ============================================================================
