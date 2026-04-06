-- ============================================================================
-- RECURRING / DCA ORDERS MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Recurring orders table
CREATE TABLE IF NOT EXISTS public.recurring_orders (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id      uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol            text        NOT NULL,
  name              text        NOT NULL,
  amount_usd        numeric     NOT NULL CHECK (amount_usd > 0),
  frequency         text        NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly')),
  day_of_week       integer     CHECK (day_of_week BETWEEN 0 AND 6),
  next_execution_at timestamptz NOT NULL,
  status            text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  total_executed    integer     NOT NULL DEFAULT 0,
  total_spent       numeric     NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_orders_portfolio
  ON public.recurring_orders(portfolio_id, status);

CREATE INDEX IF NOT EXISTS idx_recurring_orders_next_execution
  ON public.recurring_orders(next_execution_at)
  WHERE status = 'active';

ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own recurring orders"
  ON public.recurring_orders FOR ALL TO authenticated
  USING (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ))
  WITH CHECK (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

-- 2. Portfolio snapshots table (for history chart)
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id  uuid    NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  total_value   numeric NOT NULL,
  cash_balance  numeric NOT NULL,
  crypto_value  numeric NOT NULL DEFAULT 0,
  snapshot_date date    NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_portfolio_date
  ON public.portfolio_snapshots(portfolio_id, snapshot_date DESC);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own portfolio snapshots"
  ON public.portfolio_snapshots FOR ALL TO authenticated
  USING (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ))
  WITH CHECK (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFY:
-- SELECT * FROM public.recurring_orders LIMIT 5;
-- SELECT * FROM public.portfolio_snapshots LIMIT 5;
-- ============================================================================
