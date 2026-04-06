-- ─────────────────────────────────────────────────────────────────────────────
-- BlockTrade — User Activity Log
-- Run once in your Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Activity log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id               bigserial PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       uuid,                          -- optional: group events in one session
  action           text        NOT NULL,          -- e.g. 'TRADE_EXECUTED', 'LOGIN'
  category         text        NOT NULL,          -- 'auth' | 'trade' | 'portfolio' | 'wallet' | 'alert' | 'kyc' | 'settings'
  status           text        NOT NULL DEFAULT 'success', -- 'success' | 'failure' | 'pending'
  metadata         jsonb       NOT NULL DEFAULT '{}', -- any extra context (coin, amount, side, etc.)
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id    ON public.user_activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action      ON public.user_activity_log (action);
CREATE INDEX IF NOT EXISTS idx_activity_log_category    ON public.user_activity_log (category);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at  ON public.user_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_status      ON public.user_activity_log (status);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_time   ON public.user_activity_log (user_id, created_at DESC);

-- 2. Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs
CREATE POLICY "Users can read own activity"
  ON public.user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own logs (client-side logging)
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (used by Supabase functions / edge functions) can do anything
-- This is handled automatically by the service_role key, no explicit policy needed.

-- 3. Helper function — log_activity() ────────────────────────────────────────
-- Call this from Supabase Edge Functions or RPC calls to log securely server-side.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action     text,
  p_category   text,
  p_status     text       DEFAULT 'success',
  p_metadata   jsonb      DEFAULT '{}',
  p_session_id uuid       DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as the function owner, bypassing RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_activity_log
    (user_id, session_id, action, category, status, metadata)
  VALUES
    (auth.uid(), p_session_id, p_action, p_category, p_status, p_metadata);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;

-- 4. Realtime (optional — enables live admin dashboards) ───────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_log;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reference: Standardised action strings
-- ─────────────────────────────────────────────────────────────────────────────
--
-- category: auth
--   LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, REGISTER, PASSWORD_RESET_REQUEST,
--   PASSWORD_RESET_COMPLETE, SESSION_EXPIRED
--
-- category: trade
--   TRADE_EXECUTED      { side, symbol, qty, price, total, order_type }
--   LIMIT_ORDER_PLACED  { side, symbol, qty, limit_price }
--   LIMIT_ORDER_FILLED  { order_id, symbol, qty, fill_price }
--   LIMIT_ORDER_CANCELLED { order_id, symbol }
--   TRADE_FAILED        { side, symbol, reason }
--
-- category: wallet
--   DEPOSIT_INITIATED   { method, amount, currency }
--   DEPOSIT_CONFIRMED   { method, amount, currency, txn_id }
--   WITHDRAWAL_REQUESTED { method, amount, currency, address }
--   WITHDRAWAL_APPROVED  { amount }
--   WITHDRAWAL_REJECTED  { reason }
--   TRANSFER_SENT        { to_user_id, amount }
--   TRANSFER_RECEIVED    { from_user_id, amount }
--
-- category: portfolio
--   PORTFOLIO_CREATED   { portfolio_id }
--   PORTFOLIO_VIEWED    {}
--
-- category: alert
--   ALERT_CREATED       { symbol, alert_type, threshold }
--   ALERT_TRIGGERED     { alert_id, symbol, price }
--   ALERT_DELETED       { alert_id }
--
-- category: kyc
--   KYC_SUBMITTED       { doc_type }
--   KYC_APPROVED        {}
--   KYC_REJECTED        { reason }
--
-- category: settings
--   PROFILE_UPDATED     { fields_changed[] }
--   AVATAR_CHANGED      {}
--   PAYMENT_METHOD_ADDED { method_type }
--   PAYMENT_METHOD_REMOVED { method_id }
--   WATCHLIST_ADDED     { symbol }
--   WATCHLIST_REMOVED   { symbol }
-- ─────────────────────────────────────────────────────────────────────────────
