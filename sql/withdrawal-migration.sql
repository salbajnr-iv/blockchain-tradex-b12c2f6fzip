-- ============================================================================
-- WITHDRAWAL SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Add new columns to the transactions table for withdrawal details & admin review
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS withdrawal_details jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_message text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid DEFAULT NULL REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Add is_admin flag to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 3. Create index for faster admin queries on pending withdrawals
CREATE INDEX IF NOT EXISTS idx_transactions_type_status
  ON public.transactions(type, status)
  WHERE type = 'WITHDRAWAL';

-- 4. Allow admins to view ALL transactions (for review panel)
CREATE POLICY IF NOT EXISTS "Admins can view all transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 5. Allow admins to update any transaction (to approve/reject withdrawals + set message)
CREATE POLICY IF NOT EXISTS "Admins can update any transaction"
  ON public.transactions
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

-- 6. RPC function: admin updates a withdrawal status + message
CREATE OR REPLACE FUNCTION fn_admin_update_withdrawal(
  p_transaction_id uuid,
  p_status         text,
  p_admin_message  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.transactions
  SET
    status        = p_status,
    admin_message = p_admin_message,
    reviewed_at   = now(),
    reviewed_by   = auth.uid()
  WHERE id = p_transaction_id
    AND type = 'WITHDRAWAL';
END;
$$;

-- 7. RPC function: subscribe to a user's withdrawal transaction changes
-- (Real-time handled on client; this is for reference)
-- Users can subscribe via Supabase Realtime to:
-- table: transactions, filter: id=eq.<transaction_id>

-- 8. Grant execute on the admin function to authenticated users
-- (The SECURITY DEFINER + internal check handles the guard)
GRANT EXECUTE ON FUNCTION fn_admin_update_withdrawal TO authenticated;

-- ============================================================================
-- HOW TO MAKE A USER AN ADMIN:
-- UPDATE public.users SET is_admin = true WHERE email = 'admin@yourdomain.com';
-- ============================================================================
