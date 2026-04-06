-- ============================================================================
-- PENDING ORDERS — Migration
-- ============================================================================
-- Adds a pending_orders table so that Limit orders are stored and held until
-- the live market price reaches the user's target, at which point the order
-- is automatically filled by the client-side order engine.
--
-- Run this in your Supabase SQL Editor ONCE after the base schema is applied.
-- ===========================================================================

-- ── 1. TABLE ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol        text NOT NULL,
  name          text,
  side          text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity      decimal(20,8) NOT NULL,
  limit_price   decimal(20,8) NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'filled', 'cancelled', 'expired')),
  notes         text,
  created_at    timestamp with time zone DEFAULT now(),
  filled_at     timestamp with time zone,
  cancelled_at  timestamp with time zone,
  CONSTRAINT pending_qty_positive    CHECK (quantity    > 0),
  CONSTRAINT pending_price_positive  CHECK (limit_price > 0)
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          

CREATE INDEX IF NOT EXISTS idx_pending_orders_portfolio_id ON public.pending_orders(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol       ON public.pending_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status       ON public.pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_created_at   ON public.pending_orders(created_at);

-- ── 2. ENABLE ROW-LEVEL SECURITY ─────────────────────────────────────────────

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending orders
CREATE POLICY "Users can view own pending orders"
  ON public.pending_orders FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      

-- Users can create pending orders in their own portfolio
CREATE POLICY "Users can create pending orders"
  ON public.pending_orders FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        

-- Users can update (fill / cancel) their own pending orders
CREATE POLICY "Users can update own pending orders"
  ON public.pending_orders FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              

-- Users can delete their own pending orders
CREATE POLICY "Users can delete own pending orders"
  ON public.pending_orders FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          

-- ── 3. REALTIME ───────────────────────────────────────────────────────────────
-- Enable realtime publications so the client gets instant updates when an
-- order is filled or cancelled by the order engine.

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_orders;
