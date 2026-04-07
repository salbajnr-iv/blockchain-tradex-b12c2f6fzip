-- ============================================================
-- ADMIN CRYPTO BALANCE MANAGEMENT
-- Run this in Supabase SQL Editor AFTER master_wallet_deposit_system.sql
-- ============================================================

-- ── Admin function: add, deduct, or set a user's crypto balance ─────────────
-- Operations: 'add' | 'deduct' | 'set' | 'delete'
-- 'delete' removes the row entirely (zeroes it out of existence)

CREATE OR REPLACE FUNCTION fn_admin_adjust_crypto_balance(
  p_user_id   UUID,
  p_asset     TEXT,
  p_operation TEXT,   -- 'add' | 'deduct' | 'set' | 'delete'
  p_amount    NUMERIC DEFAULT 0,
  p_note      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin      BOOLEAN;
  v_current_bal   NUMERIC := 0;
  v_new_bal       NUMERIC;
BEGIN
  -- 1. Verify caller is an admin
  SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  -- 2. Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;
  IF p_asset IS NULL OR p_asset = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'asset is required');
  END IF;
  IF p_operation NOT IN ('add', 'deduct', 'set', 'delete') THEN
    RETURN jsonb_build_object('success', false, 'error', 'operation must be add, deduct, set, or delete');
  END IF;

  -- 3. Handle delete
  IF p_operation = 'delete' THEN
    DELETE FROM user_balances WHERE user_id = p_user_id AND asset = p_asset;
    RETURN jsonb_build_object('success', true, 'new_balance', 0, 'operation', 'delete');
  END IF;

  -- 4. Fetch current balance (if exists)
  SELECT balance INTO v_current_bal
  FROM user_balances
  WHERE user_id = p_user_id AND asset = p_asset;

  IF NOT FOUND THEN
    v_current_bal := 0;
  END IF;

  -- 5. Compute new balance
  v_new_bal := CASE p_operation
    WHEN 'add'    THEN v_current_bal + p_amount
    WHEN 'deduct' THEN v_current_bal - p_amount
    WHEN 'set'    THEN p_amount
  END;

  IF v_new_bal < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Balance cannot go negative');
  END IF;

  -- 6. Upsert
  INSERT INTO user_balances (user_id, asset, balance, updated_at)
  VALUES (p_user_id, p_asset, v_new_bal, NOW())
  ON CONFLICT (user_id, asset)
  DO UPDATE SET
    balance    = EXCLUDED.balance,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_bal, 'operation', p_operation);
END;
$$;

-- ── Ensure DELETE policy exists on user_balances for admins ─────────────────
-- (The FOR ALL policy from the first migration already covers this,
--  but if you ran just SELECT/INSERT/UPDATE policies before, add this:)
DROP POLICY IF EXISTS "user_balances_admin_delete" ON user_balances;
CREATE POLICY "user_balances_admin_delete"
  ON user_balances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

-- ── DONE ────────────────────────────────────────────────────────────────────
-- New function: fn_admin_adjust_crypto_balance(user_id, asset, operation, amount, note)
-- Operations supported: 'add', 'deduct', 'set', 'delete'
