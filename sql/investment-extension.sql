-- ============================================================================
-- BLOCKTRADE — INVESTMENT EXTENSION MIGRATION
-- ============================================================================
-- Extends the database to support multi-asset investing:
--   Stocks · ETFs · Bonds · Fixed Income · Commodities
--   Futures · Options · Metals · NFTs
--
-- Run sections in order in your Supabase SQL Editor.
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT.
--
-- Sections:
--   1.  Extend transactions type constraint
--   2.  investment_categories table
--   3.  investment_instruments table
--   4.  investment_price_history table
--   5.  investment_holdings table
--   6.  investment_transactions table
--   7.  investment_orders table
--   8.  investment_dividends table
--   9.  investment_watchlist table
--   10. RLS enable + policies
--   11. Indexes
--   12. Admin helper functions (RPCs)
--   13. Seed: categories + instruments
--   14. Platform settings seed for investments
-- ============================================================================


-- ============================================================================
-- 1. EXTEND EXISTING TRANSACTIONS TABLE
-- ============================================================================

-- 1a. Drop the old type CHECK so we can add INVESTMENT_BUY / INVESTMENT_SELL
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 1b. Re-add with the full set of investment types
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'BUY', 'SELL',
    'DEPOSIT', 'WITHDRAWAL',
    'TRANSFER', 'DIVIDEND', 'FEE',
    'INVESTMENT_BUY', 'INVESTMENT_SELL', 'INVESTMENT_DIVIDEND'
  ));

-- 1c. Add investment-specific columns to the existing transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS investment_instrument_id text            DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS investment_category      text            DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee_amount               decimal(20,8)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settled_at               timestamptz     DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_investment
  ON public.transactions(type, investment_instrument_id)
  WHERE type IN ('INVESTMENT_BUY', 'INVESTMENT_SELL', 'INVESTMENT_DIVIDEND');


-- ============================================================================
-- 2. INVESTMENT CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_categories (
  id          text        PRIMARY KEY,           -- e.g. 'stocks', 'etfs', 'bonds'
  label       text        NOT NULL,              -- display name
  icon        text        NOT NULL DEFAULT 'TrendingUp',
  color       text        NOT NULL DEFAULT 'blue',
  bg_class    text        NOT NULL DEFAULT 'bg-blue-500/10',
  text_class  text        NOT NULL DEFAULT 'text-blue-500',
  border_class text       NOT NULL DEFAULT 'border-blue-500/30',
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL
);


-- ============================================================================
-- 3. INVESTMENT INSTRUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_instruments (
  -- Identity
  id              text        PRIMARY KEY,      -- e.g. 'AAPL', 'US10Y', 'XAUUSD'
  category_id     text        NOT NULL REFERENCES public.investment_categories(id) ON DELETE RESTRICT,
  name            text        NOT NULL,
  symbol          text        NOT NULL,
  icon            text        NOT NULL DEFAULT '★',

  -- Pricing (updated by admin or price feed)
  price           decimal(20,6) NOT NULL DEFAULT 0,
  change_24h      decimal(20,6) NOT NULL DEFAULT 0,
  change_pct_24h  decimal(10,4) NOT NULL DEFAULT 0,
  price_updated_at timestamptz  DEFAULT now(),

  -- Market info (display strings)
  market_cap_display   text,
  volume_24h_display   text,
  exchange             text,
  currency             text NOT NULL DEFAULT 'USD',

  -- Investment constraints
  min_investment  decimal(20,2) NOT NULL DEFAULT 1,
  max_investment  decimal(20,2),                -- NULL = no limit

  -- Visibility
  enabled         boolean NOT NULL DEFAULT true,
  featured        boolean NOT NULL DEFAULT false,

  -- Description
  description     text,

  -- ── Bond / Fixed Income fields ───────────────────────────────────────────
  yield_rate      text,           -- e.g. '4.52%'
  maturity        text,           -- e.g. '10 Years'
  credit_rating   text,           -- e.g. 'AAA', 'BBB'

  -- ── Commodities / Metals fields ──────────────────────────────────────────
  unit            text,           -- e.g. 'per barrel', 'per troy oz', 'per lb'

  -- ── Futures fields ───────────────────────────────────────────────────────
  expiry_date     text,           -- e.g. 'Jun 2025'
  contract_size   text,           -- e.g. '100 troy oz'

  -- ── Options fields ───────────────────────────────────────────────────────
  option_type     text CHECK (option_type IS NULL OR option_type IN ('Call', 'Put')),
  strike_price    text,           -- e.g. '$200'
  option_expiry   text,           -- e.g. 'Jun 20, 2025'
  underlying      text,           -- e.g. 'AAPL'

  -- ── NFT fields ───────────────────────────────────────────────────────────
  blockchain      text,           -- e.g. 'Ethereum'
  nft_supply      text,           -- e.g. '10,000'
  floor_price     text,           -- e.g. '48.5 ETH'

  -- Admin metadata
  sort_order      integer   NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_instruments_category ON public.investment_instruments(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_instruments_symbol   ON public.investment_instruments(symbol);
CREATE INDEX IF NOT EXISTS idx_inv_instruments_enabled  ON public.investment_instruments(enabled);
CREATE INDEX IF NOT EXISTS idx_inv_instruments_featured ON public.investment_instruments(featured) WHERE featured = true;


-- ============================================================================
-- 4. INVESTMENT PRICE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_price_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id   text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE CASCADE,
  symbol          text        NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  open            decimal(20,6),
  high            decimal(20,6),
  low             decimal(20,6),
  close           decimal(20,6) NOT NULL,
  volume          decimal(20,2),
  interval        text NOT NULL DEFAULT '1d'
                  CHECK (interval IN ('1m','5m','15m','1h','4h','1d','1w','1mo')),
  source          text DEFAULT 'admin',         -- 'admin' | 'feed' | 'manual'

  CONSTRAINT close_positive CHECK (close > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_price_history_uniq
  ON public.investment_price_history(instrument_id, interval, recorded_at);

CREATE INDEX IF NOT EXISTS idx_inv_price_history_instrument
  ON public.investment_price_history(instrument_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_inv_price_history_symbol
  ON public.investment_price_history(symbol, interval, recorded_at DESC);


-- ============================================================================
-- 5. INVESTMENT HOLDINGS TABLE  (live user positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_holdings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id        uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id       text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE RESTRICT,
  symbol              text        NOT NULL,
  category_id         text        NOT NULL REFERENCES public.investment_categories(id) ON DELETE RESTRICT,

  -- Position
  units               decimal(20,8) NOT NULL DEFAULT 0,
  avg_cost_per_unit   decimal(20,8) NOT NULL DEFAULT 0,
  total_invested      decimal(20,2) NOT NULL DEFAULT 0,   -- sum of all buy amounts
  total_realized_pnl  decimal(20,2) NOT NULL DEFAULT 0,   -- realized from sells

  -- Cached current values (refreshed on price updates)
  current_price       decimal(20,6),
  current_value       decimal(20,2),
  unrealized_pnl      decimal(20,2),
  unrealized_pnl_pct  decimal(10,4),

  -- Metadata
  first_bought_at     timestamptz,
  last_transaction_at timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (portfolio_id, instrument_id),
  CONSTRAINT units_non_negative CHECK (units >= 0),
  CONSTRAINT avg_cost_non_negative CHECK (avg_cost_per_unit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_holdings_portfolio   ON public.investment_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inv_holdings_instrument  ON public.investment_holdings(instrument_id);
CREATE INDEX IF NOT EXISTS idx_inv_holdings_symbol      ON public.investment_holdings(symbol);


-- ============================================================================
-- 6. INVESTMENT TRANSACTIONS TABLE  (dedicated investment order log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id   text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE RESTRICT,
  symbol          text        NOT NULL,
  category_id     text        NOT NULL REFERENCES public.investment_categories(id) ON DELETE RESTRICT,

  -- Order details
  transaction_type text NOT NULL
                   CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'TRANSFER_IN', 'TRANSFER_OUT')),
  units           decimal(20,8),
  price_per_unit  decimal(20,8),
  gross_amount    decimal(20,2) NOT NULL,        -- units × price
  fee_amount      decimal(20,2) NOT NULL DEFAULT 0,
  net_amount      decimal(20,2) NOT NULL,        -- gross ± fee (sign depends on type)

  -- Status lifecycle
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'under_review', 'settled', 'rejected', 'cancelled')),

  -- Notes
  notes           text,
  rejection_reason text,

  -- Admin review
  admin_notes     text,
  reviewed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  settled_at      timestamptz,

  -- Cross-reference to main transactions table (if recorded there too)
  main_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT gross_amount_positive CHECK (gross_amount > 0),
  CONSTRAINT fee_non_negative      CHECK (fee_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_txns_portfolio     ON public.investment_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_instrument    ON public.investment_transactions(instrument_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_status        ON public.investment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_inv_txns_type          ON public.investment_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_txns_created_at    ON public.investment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txns_symbol        ON public.investment_transactions(symbol);

-- Partial index for admin pending-orders queue
CREATE INDEX IF NOT EXISTS idx_inv_txns_pending
  ON public.investment_transactions(created_at DESC)
  WHERE status IN ('pending', 'under_review');


-- ============================================================================
-- 7. INVESTMENT ORDERS TABLE  (limit / recurring / scheduled orders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id   text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE RESTRICT,
  symbol          text        NOT NULL,
  category_id     text        NOT NULL REFERENCES public.investment_categories(id) ON DELETE RESTRICT,

  -- Order specification
  order_type      text NOT NULL DEFAULT 'MARKET'
                  CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'RECURRING')),
  side            text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  requested_units decimal(20,8),                -- if ordering by units
  requested_amount decimal(20,2),              -- if ordering by USD amount
  limit_price     decimal(20,8),               -- for LIMIT / STOP_LIMIT orders
  stop_price      decimal(20,8),               -- for STOP orders

  -- Recurring (DCA)
  recurring_interval text
                  CHECK (recurring_interval IS NULL OR
                         recurring_interval IN ('daily','weekly','biweekly','monthly')),
  next_execution_at  timestamptz,

  -- Lifecycle
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled', 'expired', 'rejected')),
  filled_units    decimal(20,8) DEFAULT 0,
  filled_amount   decimal(20,2) DEFAULT 0,
  fill_price      decimal(20,8),               -- average fill price
  expires_at      timestamptz,
  filled_at       timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,

  -- Reference
  linked_transaction_id uuid REFERENCES public.investment_transactions(id) ON DELETE SET NULL,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_orders_portfolio   ON public.investment_orders(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inv_orders_instrument  ON public.investment_orders(instrument_id);
CREATE INDEX IF NOT EXISTS idx_inv_orders_status      ON public.investment_orders(status);
CREATE INDEX IF NOT EXISTS idx_inv_orders_open
  ON public.investment_orders(instrument_id, side, limit_price)
  WHERE status = 'open';


-- ============================================================================
-- 8. INVESTMENT DIVIDENDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_dividends (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id   text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE RESTRICT,
  symbol          text        NOT NULL,

  -- Dividend details
  amount_per_unit decimal(20,8) NOT NULL,
  units_held      decimal(20,8) NOT NULL,
  gross_amount    decimal(20,2) NOT NULL,       -- amount_per_unit × units_held
  tax_withheld    decimal(20,2) NOT NULL DEFAULT 0,
  net_amount      decimal(20,2) NOT NULL,       -- gross - tax

  dividend_type   text NOT NULL DEFAULT 'cash'
                  CHECK (dividend_type IN ('cash', 'stock', 'interest', 'coupon', 'special')),

  -- Dates
  declaration_date date,
  ex_dividend_date date,
  record_date      date,
  payment_date     date,

  -- Status
  status          text NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'processing', 'paid', 'cancelled')),
  paid_at         timestamptz,

  -- Admin
  admin_notes     text,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT gross_positive CHECK (gross_amount > 0),
  CONSTRAINT net_positive    CHECK (net_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_dividends_portfolio    ON public.investment_dividends(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inv_dividends_instrument   ON public.investment_dividends(instrument_id);
CREATE INDEX IF NOT EXISTS idx_inv_dividends_status       ON public.investment_dividends(status);
CREATE INDEX IF NOT EXISTS idx_inv_dividends_payment_date ON public.investment_dividends(payment_date);


-- ============================================================================
-- 9. INVESTMENT WATCHLIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_watchlist (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  uuid        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id text        NOT NULL REFERENCES public.investment_instruments(id) ON DELETE CASCADE,
  symbol        text        NOT NULL,
  notes         text,
  alert_below   decimal(20,6),                  -- notify if price drops below
  alert_above   decimal(20,6),                  -- notify if price rises above
  added_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (portfolio_id, instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_watchlist_portfolio  ON public.investment_watchlist(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inv_watchlist_instrument ON public.investment_watchlist(instrument_id);


-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.investment_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_instruments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_holdings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_dividends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_watchlist     ENABLE ROW LEVEL SECURITY;

-- ── investment_categories: public read, admin write ───────────────────────

CREATE POLICY IF NOT EXISTS "Anyone can view investment categories"
  ON public.investment_categories FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage investment categories"
  ON public.investment_categories FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_instruments: enabled = public read, admin = read all + write ─

CREATE POLICY IF NOT EXISTS "Anyone can view enabled instruments"
  ON public.investment_instruments FOR SELECT
  USING (enabled = true);

CREATE POLICY IF NOT EXISTS "Admins can view all instruments"
  ON public.investment_instruments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY IF NOT EXISTS "Admins can manage instruments"
  ON public.investment_instruments FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_price_history: public read ─────────────────────────────────

CREATE POLICY IF NOT EXISTS "Anyone can view price history"
  ON public.investment_price_history FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage price history"
  ON public.investment_price_history FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_holdings ───────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users can view own holdings"
  ON public.investment_holdings FOR SELECT TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "System can insert/update holdings"
  ON public.investment_holdings FOR INSERT TO authenticated
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "System can update own holdings"
  ON public.investment_holdings FOR UPDATE TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can view all holdings"
  ON public.investment_holdings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY IF NOT EXISTS "Admins can manage all holdings"
  ON public.investment_holdings FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_transactions ───────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users can view own investment transactions"
  ON public.investment_transactions FOR SELECT TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can create own investment transactions"
  ON public.investment_transactions FOR INSERT TO authenticated
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can cancel own pending transactions"
  ON public.investment_transactions FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
  )
  WITH CHECK (status = 'cancelled');

CREATE POLICY IF NOT EXISTS "Admins can view all investment transactions"
  ON public.investment_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY IF NOT EXISTS "Admins can manage all investment transactions"
  ON public.investment_transactions FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_orders ──────────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users can view own investment orders"
  ON public.investment_orders FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can create own investment orders"
  ON public.investment_orders FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can cancel own open orders"
  ON public.investment_orders FOR UPDATE TO authenticated
  USING (
    status = 'open'
    AND portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Admins can view all investment orders"
  ON public.investment_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY IF NOT EXISTS "Admins can manage all investment orders"
  ON public.investment_orders FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_dividends ───────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users can view own dividends"
  ON public.investment_dividends FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can manage all dividends"
  ON public.investment_dividends FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── investment_watchlist ──────────────────────────────────────────────────

CREATE POLICY IF NOT EXISTS "Users can manage own investment watchlist"
  ON public.investment_watchlist FOR ALL TO authenticated
  USING   (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));


-- ============================================================================
-- 11. REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_instruments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_dividends;


-- ============================================================================
-- 12. ADMIN HELPER FUNCTIONS (RPCs)
-- ============================================================================

-- ── fn_invest_buy: place a buy order ─────────────────────────────────────
-- Validates cash balance, creates investment_transaction (pending),
-- records in main transactions table, deducts cash from portfolio.
-- Settlement is handled by fn_admin_settle_investment.

CREATE OR REPLACE FUNCTION fn_invest_buy(
  p_portfolio_id  uuid,
  p_instrument_id text,
  p_amount_usd    numeric   -- gross investment amount in USD
)
RETURNS uuid             -- returns the new investment_transaction.id
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_portfolio      public.portfolios%ROWTYPE;
  v_instrument     public.investment_instruments%ROWTYPE;
  v_fee_pct        numeric;
  v_fee            numeric;
  v_total_cost     numeric;
  v_units          numeric;
  v_inv_tx_id      uuid;
  v_main_tx_id     uuid;
BEGIN
  -- 1. Auth check: caller must own the portfolio
  SELECT * INTO v_portfolio FROM public.portfolios
  WHERE id = p_portfolio_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found or access denied';
  END IF;

  -- 2. Instrument must exist and be enabled
  SELECT * INTO v_instrument FROM public.investment_instruments
  WHERE id = p_instrument_id AND enabled = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instrument % not found or not available', p_instrument_id;
  END IF;

  -- 3. Validate minimum investment
  IF p_amount_usd < v_instrument.min_investment THEN
    RAISE EXCEPTION 'Amount $% is below the minimum investment of $%',
      p_amount_usd, v_instrument.min_investment;
  END IF;

  -- 4. Fetch platform fee (default 0.5%)
  SELECT COALESCE((value::text)::numeric, 0.5) / 100 INTO v_fee_pct
  FROM public.platform_settings WHERE key = 'investment_trading_fee_percent'
  LIMIT 1;
  IF NOT FOUND THEN v_fee_pct := 0.005; END IF;

  v_fee       := ROUND(p_amount_usd * v_fee_pct, 2);
  v_total_cost := p_amount_usd + v_fee;

  -- 5. Check sufficient cash balance
  IF v_portfolio.cash_balance < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient cash balance. Required: $%, Available: $%',
      v_total_cost, v_portfolio.cash_balance;
  END IF;

  -- 6. Calculate units
  IF v_instrument.price <= 0 THEN
    RAISE EXCEPTION 'Instrument price is zero — cannot calculate units';
  END IF;
  v_units := ROUND(p_amount_usd / v_instrument.price, 8);

  -- 7. Deduct cash balance immediately (held pending settlement)
  UPDATE public.portfolios
  SET cash_balance = cash_balance - v_total_cost,
      updated_at   = now()
  WHERE id = p_portfolio_id;

  -- 8. Insert into investment_transactions
  INSERT INTO public.investment_transactions (
    portfolio_id, instrument_id, symbol, category_id,
    transaction_type, units, price_per_unit,
    gross_amount, fee_amount, net_amount,
    status, notes
  ) VALUES (
    p_portfolio_id, p_instrument_id, v_instrument.symbol, v_instrument.category_id,
    'BUY', v_units, v_instrument.price,
    p_amount_usd, v_fee, v_total_cost,
    'pending',
    'Buy ' || v_units || ' × ' || v_instrument.name || ' @ $' || v_instrument.price
  )
  RETURNING id INTO v_inv_tx_id;

  -- 9. Mirror in main transactions table for unified history
  INSERT INTO public.transactions (
    portfolio_id, type, symbol,
    quantity, price_per_unit, total_amount,
    fee_amount, status, notes,
    investment_instrument_id, investment_category
  ) VALUES (
    p_portfolio_id, 'INVESTMENT_BUY', v_instrument.symbol,
    v_units, v_instrument.price, v_total_cost,
    v_fee, 'pending',
    'Buy ' || v_units || ' × ' || v_instrument.name,
    p_instrument_id, v_instrument.category_id
  )
  RETURNING id INTO v_main_tx_id;

  -- Link the two records
  UPDATE public.investment_transactions
  SET main_transaction_id = v_main_tx_id
  WHERE id = v_inv_tx_id;

  RETURN v_inv_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_invest_buy TO authenticated;


-- ── fn_invest_sell: place a sell order ──────────────────────────────────

CREATE OR REPLACE FUNCTION fn_invest_sell(
  p_portfolio_id  uuid,
  p_instrument_id text,
  p_units         numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_portfolio    public.portfolios%ROWTYPE;
  v_instrument   public.investment_instruments%ROWTYPE;
  v_holding      public.investment_holdings%ROWTYPE;
  v_fee_pct      numeric;
  v_gross        numeric;
  v_fee          numeric;
  v_net          numeric;
  v_inv_tx_id    uuid;
  v_main_tx_id   uuid;
BEGIN
  -- 1. Auth
  SELECT * INTO v_portfolio FROM public.portfolios
  WHERE id = p_portfolio_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found or access denied';
  END IF;

  -- 2. Instrument
  SELECT * INTO v_instrument FROM public.investment_instruments
  WHERE id = p_instrument_id AND enabled = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instrument % not available', p_instrument_id;
  END IF;

  -- 3. Holding check
  SELECT * INTO v_holding FROM public.investment_holdings
  WHERE portfolio_id = p_portfolio_id AND instrument_id = p_instrument_id;
  IF NOT FOUND OR v_holding.units < p_units THEN
    RAISE EXCEPTION 'Insufficient units. Held: %, Requested: %',
      COALESCE(v_holding.units, 0), p_units;
  END IF;

  -- 4. Calculate proceeds
  v_gross := ROUND(p_units * v_instrument.price, 2);

  SELECT COALESCE((value::text)::numeric, 0.5) / 100 INTO v_fee_pct
  FROM public.platform_settings WHERE key = 'investment_trading_fee_percent' LIMIT 1;
  IF NOT FOUND THEN v_fee_pct := 0.005; END IF;

  v_fee := ROUND(v_gross * v_fee_pct, 2);
  v_net := v_gross - v_fee;

  -- 5. Insert sell transaction (pending settlement)
  INSERT INTO public.investment_transactions (
    portfolio_id, instrument_id, symbol, category_id,
    transaction_type, units, price_per_unit,
    gross_amount, fee_amount, net_amount,
    status, notes
  ) VALUES (
    p_portfolio_id, p_instrument_id, v_instrument.symbol, v_instrument.category_id,
    'SELL', p_units, v_instrument.price,
    v_gross, v_fee, v_net,
    'pending',
    'Sell ' || p_units || ' × ' || v_instrument.name || ' @ $' || v_instrument.price
  )
  RETURNING id INTO v_inv_tx_id;

  -- 6. Mirror in main transactions table
  INSERT INTO public.transactions (
    portfolio_id, type, symbol,
    quantity, price_per_unit, total_amount,
    fee_amount, status, notes,
    investment_instrument_id, investment_category
  ) VALUES (
    p_portfolio_id, 'INVESTMENT_SELL', v_instrument.symbol,
    p_units, v_instrument.price, v_gross,
    v_fee, 'pending',
    'Sell ' || p_units || ' × ' || v_instrument.name,
    p_instrument_id, v_instrument.category_id
  )
  RETURNING id INTO v_main_tx_id;

  UPDATE public.investment_transactions SET main_transaction_id = v_main_tx_id WHERE id = v_inv_tx_id;

  RETURN v_inv_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_invest_sell TO authenticated;


-- ── fn_admin_settle_investment: approve or reject an investment order ─────

CREATE OR REPLACE FUNCTION fn_admin_settle_investment(
  p_tx_id         uuid,
  p_action        text,          -- 'settle' | 'reject'
  p_admin_notes   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx         public.investment_transactions%ROWTYPE;
  v_instrument public.investment_instruments%ROWTYPE;
  v_holding    public.investment_holdings%ROWTYPE;
  v_realized   numeric;
BEGIN
  -- Admin only
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Fetch transaction
  SELECT * INTO v_tx FROM public.investment_transactions WHERE id = p_tx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction % not found', p_tx_id; END IF;
  IF v_tx.status NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'Transaction is already %', v_tx.status;
  END IF;

  SELECT * INTO v_instrument FROM public.investment_instruments WHERE id = v_tx.instrument_id;

  IF p_action = 'settle' THEN
    -- ── SETTLE ────────────────────────────────────────────────────────────

    IF v_tx.transaction_type = 'BUY' THEN
      -- Upsert holding
      INSERT INTO public.investment_holdings (
        portfolio_id, instrument_id, symbol, category_id,
        units, avg_cost_per_unit, total_invested, current_price,
        first_bought_at, last_transaction_at
      ) VALUES (
        v_tx.portfolio_id, v_tx.instrument_id, v_tx.symbol, v_tx.category_id,
        v_tx.units, v_tx.price_per_unit, v_tx.gross_amount, v_tx.price_per_unit,
        now(), now()
      )
      ON CONFLICT (portfolio_id, instrument_id) DO UPDATE
        SET units             = investment_holdings.units + EXCLUDED.units,
            avg_cost_per_unit = (
              (investment_holdings.total_invested + EXCLUDED.total_invested)
              / NULLIF(investment_holdings.units + EXCLUDED.units, 0)
            ),
            total_invested    = investment_holdings.total_invested + EXCLUDED.total_invested,
            current_price     = EXCLUDED.current_price,
            last_transaction_at = now(),
            updated_at        = now();

    ELSIF v_tx.transaction_type = 'SELL' THEN
      -- Get current holding
      SELECT * INTO v_holding FROM public.investment_holdings
      WHERE portfolio_id = v_tx.portfolio_id AND instrument_id = v_tx.instrument_id;

      IF NOT FOUND OR v_holding.units < v_tx.units THEN
        RAISE EXCEPTION 'Insufficient units to settle sell order';
      END IF;

      -- Realized P&L: net proceeds - avg cost of units sold
      v_realized := v_tx.net_amount - (v_tx.units * v_holding.avg_cost_per_unit);

      -- Update holding (deduct units)
      UPDATE public.investment_holdings
      SET
        units               = units - v_tx.units,
        total_invested      = GREATEST(0, total_invested - (v_tx.units * avg_cost_per_unit)),
        total_realized_pnl  = total_realized_pnl + v_realized,
        last_transaction_at = now(),
        updated_at          = now()
      WHERE portfolio_id = v_tx.portfolio_id AND instrument_id = v_tx.instrument_id;

      -- Remove zero-unit holdings
      DELETE FROM public.investment_holdings
      WHERE portfolio_id = v_tx.portfolio_id
        AND instrument_id = v_tx.instrument_id
        AND units <= 0.000000001;

      -- Credit net proceeds to cash balance
      UPDATE public.portfolios
      SET cash_balance = cash_balance + v_tx.net_amount,
          updated_at   = now()
      WHERE id = v_tx.portfolio_id;
    END IF;

    -- Mark settled in investment_transactions
    UPDATE public.investment_transactions
    SET status      = 'settled',
        admin_notes = p_admin_notes,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        settled_at  = now(),
        updated_at  = now()
    WHERE id = p_tx_id;

    -- Mirror in main transactions table
    UPDATE public.transactions
    SET status = 'completed', settled_at = now()
    WHERE id = v_tx.main_transaction_id;

  ELSIF p_action = 'reject' THEN
    -- ── REJECT ────────────────────────────────────────────────────────────

    IF v_tx.transaction_type = 'BUY' THEN
      -- Refund the deducted cash (gross + fee)
      UPDATE public.portfolios
      SET cash_balance = cash_balance + v_tx.net_amount,
          updated_at   = now()
      WHERE id = v_tx.portfolio_id;
    END IF;
    -- Sell rejections: no cash was moved yet, nothing to refund

    -- Mark rejected
    UPDATE public.investment_transactions
    SET status           = 'rejected',
        rejection_reason = p_admin_notes,
        admin_notes      = p_admin_notes,
        reviewed_by      = auth.uid(),
        reviewed_at      = now(),
        updated_at       = now()
    WHERE id = p_tx_id;

    UPDATE public.transactions
    SET status = 'failed'
    WHERE id = v_tx.main_transaction_id;

  ELSE
    RAISE EXCEPTION 'Unknown action %. Use ''settle'' or ''reject''', p_action;
  END IF;

  -- Audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'investment_order_' || p_action,
    'investment_transaction',
    p_tx_id::text,
    jsonb_build_object(
      'action',          p_action,
      'transaction_type',v_tx.transaction_type,
      'symbol',          v_tx.symbol,
      'units',           v_tx.units,
      'amount',          v_tx.gross_amount,
      'admin_notes',     p_admin_notes
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_admin_settle_investment TO authenticated;


-- ── fn_admin_update_instrument_price: update price + record history ──────

CREATE OR REPLACE FUNCTION fn_admin_update_instrument_price(
  p_instrument_id  text,
  p_price          numeric,
  p_change_pct_24h numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_price numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT price INTO v_prev_price FROM public.investment_instruments WHERE id = p_instrument_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instrument % not found', p_instrument_id; END IF;

  -- Update instrument
  UPDATE public.investment_instruments
  SET price            = p_price,
      change_24h       = ROUND(p_price * p_change_pct_24h / 100, 6),
      change_pct_24h   = p_change_pct_24h,
      price_updated_at = now(),
      updated_by       = auth.uid(),
      updated_at       = now()
  WHERE id = p_instrument_id;

  -- Record in price history (daily candle)
  INSERT INTO public.investment_price_history
    (instrument_id, symbol, recorded_at, open, high, low, close, interval, source)
  SELECT
    p_instrument_id,
    symbol,
    now(),
    COALESCE(v_prev_price, p_price),
    GREATEST(COALESCE(v_prev_price, p_price), p_price),
    LEAST(COALESCE(v_prev_price, p_price), p_price),
    p_price,
    '1d',
    'admin'
  FROM public.investment_instruments WHERE id = p_instrument_id
  ON CONFLICT (instrument_id, interval, recorded_at) DO UPDATE
    SET close = p_price, updated_at = now()
  RETURNING *;

  -- Refresh current_value and unrealized P&L in all holdings of this instrument
  UPDATE public.investment_holdings h
  SET
    current_price      = p_price,
    current_value      = ROUND(h.units * p_price, 2),
    unrealized_pnl     = ROUND(h.units * p_price - h.total_invested, 2),
    unrealized_pnl_pct = CASE
      WHEN h.total_invested > 0
        THEN ROUND(((h.units * p_price - h.total_invested) / h.total_invested) * 100, 4)
      ELSE 0
    END,
    updated_at         = now()
  WHERE instrument_id = p_instrument_id;

  -- Audit
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(), 'investment_price_updated', 'investment_instrument', p_instrument_id,
    jsonb_build_object('old_price', v_prev_price, 'new_price', p_price, 'change_pct', p_change_pct_24h)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_admin_update_instrument_price TO authenticated;


-- ── fn_admin_pay_dividend: credit a dividend to all holders ───────────────

CREATE OR REPLACE FUNCTION fn_admin_pay_dividend(
  p_instrument_id   text,
  p_amount_per_unit numeric,
  p_dividend_type   text DEFAULT 'cash',
  p_ex_date         date DEFAULT CURRENT_DATE,
  p_payment_date    date DEFAULT CURRENT_DATE
)
RETURNS integer    -- returns number of portfolios credited
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instrument  public.investment_instruments%ROWTYPE;
  v_count       integer := 0;
  v_holding     RECORD;
  v_gross       numeric;
  v_net         numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_instrument FROM public.investment_instruments WHERE id = p_instrument_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instrument % not found', p_instrument_id; END IF;

  FOR v_holding IN
    SELECT * FROM public.investment_holdings
    WHERE instrument_id = p_instrument_id AND units > 0
  LOOP
    v_gross := ROUND(v_holding.units * p_amount_per_unit, 2);
    v_net   := v_gross;  -- no withholding tax in this simplified version

    -- Record dividend
    INSERT INTO public.investment_dividends (
      portfolio_id, instrument_id, symbol,
      amount_per_unit, units_held, gross_amount, tax_withheld, net_amount,
      dividend_type, ex_dividend_date, payment_date, status, paid_at, created_by
    ) VALUES (
      v_holding.portfolio_id, p_instrument_id, v_instrument.symbol,
      p_amount_per_unit, v_holding.units, v_gross, 0, v_net,
      p_dividend_type, p_ex_date, p_payment_date, 'paid', now(), auth.uid()
    );

    -- Credit cash balance (for cash dividends)
    IF p_dividend_type = 'cash' OR p_dividend_type = 'interest' OR p_dividend_type = 'coupon' THEN
      UPDATE public.portfolios SET cash_balance = cash_balance + v_net WHERE id = v_holding.portfolio_id;

      -- Record in main transactions table
      INSERT INTO public.transactions (portfolio_id, type, symbol, total_amount, status, notes)
      VALUES (v_holding.portfolio_id, 'INVESTMENT_DIVIDEND', v_instrument.symbol, v_net, 'completed',
              'Dividend: ' || p_amount_per_unit || ' per unit × ' || v_holding.units || ' units');
    END IF;

    -- Update realized P&L
    UPDATE public.investment_holdings
    SET total_realized_pnl = total_realized_pnl + v_net, updated_at = now()
    WHERE id = v_holding.id;

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(), 'investment_dividend_paid', 'investment_instrument', p_instrument_id,
    jsonb_build_object('amount_per_unit', p_amount_per_unit, 'type', p_dividend_type, 'credited_portfolios', v_count)
  );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_admin_pay_dividend TO authenticated;


-- ── fn_get_investment_portfolio_summary: user's investment summary ────────

CREATE OR REPLACE FUNCTION fn_get_investment_portfolio_summary(p_portfolio_id uuid)
RETURNS TABLE (
  total_holdings         integer,
  total_invested         numeric,
  total_current_value    numeric,
  total_unrealized_pnl   numeric,
  total_unrealized_pnl_pct numeric,
  total_realized_pnl     numeric,
  categories             jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE id = p_portfolio_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::integer,
    SUM(h.total_invested),
    SUM(h.current_value),
    SUM(h.unrealized_pnl),
    CASE WHEN SUM(h.total_invested) > 0
      THEN ROUND((SUM(h.unrealized_pnl) / SUM(h.total_invested)) * 100, 4)
      ELSE 0
    END,
    SUM(h.total_realized_pnl),
    jsonb_object_agg(
      h.category_id,
      jsonb_build_object(
        'invested', SUM(h.total_invested) OVER (PARTITION BY h.category_id),
        'value',    SUM(h.current_value)  OVER (PARTITION BY h.category_id),
        'count',    COUNT(*) OVER (PARTITION BY h.category_id)
      )
    )
  FROM public.investment_holdings h
  WHERE h.portfolio_id = p_portfolio_id AND h.units > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_investment_portfolio_summary TO authenticated;


-- ============================================================================
-- 13. SEED: CATEGORIES
-- ============================================================================

INSERT INTO public.investment_categories
  (id, label, icon, color, bg_class, text_class, border_class, description, sort_order)
VALUES
  ('stocks',       'Stocks',       'TrendingUp', 'blue',    'bg-blue-500/10',    'text-blue-500',    'border-blue-500/30',    'Shares of publicly listed companies',                       1),
  ('etfs',         'ETFs',         'BarChart3',  'violet',  'bg-violet-500/10',  'text-violet-500',  'border-violet-500/30',  'Exchange-traded funds tracking indices & sectors',           2),
  ('bonds',        'Bonds',        'Shield',     'emerald', 'bg-emerald-500/10', 'text-emerald-500', 'border-emerald-500/30', 'Government & sovereign fixed-income securities',             3),
  ('fixed_income', 'Fixed Income', 'Percent',    'cyan',    'bg-cyan-500/10',    'text-cyan-500',    'border-cyan-500/30',    'Corporate bonds, T-bills & structured products',             4),
  ('commodities',  'Commodities',  'Flame',      'orange',  'bg-orange-500/10',  'text-orange-500',  'border-orange-500/30',  'Raw materials traded on global exchanges',                   5),
  ('futures',      'Futures',      'Clock',      'yellow',  'bg-yellow-500/10',  'text-yellow-500',  'border-yellow-500/30',  'Derivative contracts for future delivery',                   6),
  ('options',      'Options',      'Layers',     'pink',    'bg-pink-500/10',    'text-pink-500',    'border-pink-500/30',    'Rights to buy or sell assets at a strike price',             7),
  ('metals',       'Metals',       'Gem',        'amber',   'bg-amber-500/10',   'text-amber-500',   'border-amber-500/30',   'Precious & industrial metals spot markets',                  8),
  ('nfts',         'NFTs',         'Palette',    'purple',  'bg-purple-500/10',  'text-purple-500',  'border-purple-500/30',  'Curated non-fungible token collections',                     9)
ON CONFLICT (id) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      updated_at = now();


-- ============================================================================
-- 14. SEED: INSTRUMENTS
-- ============================================================================

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h,
   market_cap_display, volume_24h_display, exchange, min_investment, currency, description, sort_order)
VALUES
  -- ── STOCKS ────────────────────────────────────────────────────────────────
  ('AAPL',  'stocks', 'Apple Inc.',            'AAPL',  '🍎', 187.15, 1.23,  0.66,  '$2.86T', '$52.3B', 'NASDAQ', 1,   'USD', 'Apple designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories.',   1),
  ('MSFT',  'stocks', 'Microsoft Corp.',       'MSFT',  '⊞',  378.80, 2.40,  0.64,  '$2.82T', '$24.1B', 'NASDAQ', 1,   'USD', 'Microsoft develops software, services, devices and cloud solutions worldwide, led by Azure.',                     2),
  ('TSLA',  'stocks', 'Tesla Inc.',            'TSLA',  '⚡',  175.34,-3.21, -1.80, '$557B',  '$18.7B', 'NASDAQ', 1,   'USD', 'Tesla designs and manufactures electric vehicles, energy storage systems and solar panels.',                       3),
  ('GOOGL', 'stocks', 'Alphabet Inc.',         'GOOGL', 'G',  160.55, 0.88,  0.55,  '$2.01T', '$21.5B', 'NASDAQ', 1,   'USD', 'Alphabet operates Google Search, YouTube, Android, Chrome and Google Cloud.',                                     4),
  ('AMZN',  'stocks', 'Amazon.com Inc.',       'AMZN',  'A',  183.30, 1.55,  0.85,  '$1.91T', '$35.8B', 'NASDAQ', 1,   'USD', 'Amazon operates e-commerce, AWS cloud computing, digital streaming and AI businesses.',                           5),
  ('NVDA',  'stocks', 'NVIDIA Corp.',          'NVDA',  'N',  875.40,12.80,  1.48,  '$2.16T', '$44.2B', 'NASDAQ', 1,   'USD', 'NVIDIA designs GPUs for gaming, professional visualization, data center and automotive. Dominates AI chips.',      6),
  ('META',  'stocks', 'Meta Platforms Inc.',   'META',  'M',  485.20, 3.10,  0.64,  '$1.24T', '$16.3B', 'NASDAQ', 1,   'USD', 'Meta operates Facebook, Instagram, WhatsApp and Messenger reaching billions of users worldwide.',                  7),
  ('BRKB',  'stocks', 'Berkshire Hathaway B',  'BRK-B', 'B',  410.65, 0.55,  0.13,  '$908B',  '$3.2B',  'NYSE',   1,   'USD', 'Berkshire Hathaway conglomerate led by Warren Buffett — insurance, utilities, railways and consumer brands.',       8),
  ('NFLX',  'stocks', 'Netflix Inc.',          'NFLX',  'N',  628.10,-2.30, -0.36, '$274B',  '$4.8B',  'NASDAQ', 1,   'USD', 'Netflix is the world''s leading streaming entertainment service with 260M+ paid subscribers.',                      9),
  ('JPM',   'stocks', 'JPMorgan Chase & Co.',  'JPM',   'J',  198.45, 0.95,  0.48,  '$571B',  '$8.1B',  'NYSE',   1,   'USD', 'JPMorgan Chase is the largest US bank — investment banking, commercial banking and asset management.',             10),

  -- ── ETFs ──────────────────────────────────────────────────────────────────
  ('SPY',     'etfs', 'SPDR S&P 500 ETF',       'SPY',   'S',  521.30, 2.10,  0.40,  '$508B',  '$28.4B', 'NYSE',   1, 'USD', 'Tracks the S&P 500 index — 500 of the largest US companies. Most traded ETF in the world.',                        1),
  ('QQQ',     'etfs', 'Invesco QQQ Trust',       'QQQ',   'Q',  439.55, 3.20,  0.73,  '$245B',  '$19.8B', 'NASDAQ', 1, 'USD', 'Tracks NASDAQ-100 — heavily weighted toward large-cap technology stocks. Popular for growth investors.',            2),
  ('VTI',     'etfs', 'Vanguard Total Market',   'VTI',   'V',  238.70, 1.05,  0.44,  '$380B',  '$5.6B',  'NYSE',   1, 'USD', 'Covers the entire US stock market across large-, mid-, small- and micro-cap stocks.',                              3),
  ('VOO',     'etfs', 'Vanguard S&P 500 ETF',    'VOO',   'V',  479.20, 1.95,  0.41,  '$436B',  '$6.3B',  'NYSE',   1, 'USD', 'Vanguard''s S&P 500 ETF with a 0.03% expense ratio — ideal for long-term passive investors.',                      4),
  ('ARKK',    'etfs', 'ARK Innovation ETF',      'ARKK',  'K',  48.35, -0.75, -1.53, '$6.8B',  '$1.2B',  'NYSE',   1, 'USD', 'Actively managed ETF focused on disruptive innovation — genomics, AI, fintech, autonomous tech.',                   5),
  ('IWM',     'etfs', 'iShares Russell 2000',    'IWM',   'I',  201.15, 0.60,  0.30,  '$62B',   '$4.7B',  'NYSE',   1, 'USD', 'Tracks the Russell 2000 index of small-cap US stocks. Exposure to the smaller end of US equities.',                 6),
  ('EEM',     'etfs', 'iShares MSCI Emerging',   'EEM',   'E',  42.80,  0.25,  0.59,  '$22B',   '$1.5B',  'NYSE',   1, 'USD', 'Emerging market equities — China, India, Brazil, Taiwan and South Korea.',                                         7),
  ('XLE',     'etfs', 'Energy Select Sector',    'XLE',   'E',  89.45,  1.20,  1.36,  '$38B',   '$1.8B',  'NYSE',   1, 'USD', 'Tracks energy companies in the S&P 500 including oil, gas and energy services.',                                    8),
  ('GLDETF',  'etfs', 'SPDR Gold Shares ETF',    'GLD',   'G',  214.60, 0.80,  0.37,  '$64B',   '$2.1B',  'NYSE',   1, 'USD', 'Backed by physical gold in vaults. Provides gold exposure without storing physical metal.',                         9),
  ('SLVETF',  'etfs', 'iShares Silver Trust',    'SLV',   'S',  23.15,  0.35,  1.54,  '$9.2B',  '$0.8B',  'NYSE',   1, 'USD', 'Backed by physical silver. Offers exposure to silver spot price through a simple ETF.',                            10),

  -- ── BONDS ─────────────────────────────────────────────────────────────────
  ('US10Y',  'bonds', 'US 10-Year Treasury',  'US10Y',  '$',  98.20,  0.05, 0.05,  NULL, NULL, 'US Treasury',       100, 'USD', 'Benchmark US government bond maturing in 10 years. Risk-free global safe-haven asset.', 1),
  ('US30Y',  'bonds', 'US 30-Year Treasury',  'US30Y',  '$',  93.40, -0.10,-0.11, NULL, NULL, 'US Treasury',       100, 'USD', 'Long-duration US government bond. Higher yield with greater interest rate sensitivity.', 2),
  ('US2Y',   'bonds', 'US 2-Year Treasury',   'US2Y',   '$',  99.85,  0.02, 0.02,  NULL, NULL, 'US Treasury',       100, 'USD', 'Short-term US government note. Sensitive to Fed policy. Used as near-term rate proxy.',  3),
  ('UKGILT', 'bonds', 'UK 10Y Gilt',          'UKT10',  '£',  96.10, -0.08,-0.08, NULL, NULL, 'UK DMO',            100, 'GBP', 'UK government bond. Very low risk, denominated in GBP.',                                 4),
  ('BUND',   'bonds', 'German 10Y Bund',      'DBR10',  '€',  97.65,  0.03, 0.03,  NULL, NULL, 'Deutsche Finance', 100, 'EUR', 'German government bond — the euro area benchmark. Safest EUR-denominated sovereign.',     5)

  ON CONFLICT (id) DO UPDATE
    SET price          = EXCLUDED.price,
        change_24h     = EXCLUDED.change_24h,
        change_pct_24h = EXCLUDED.change_pct_24h,
        updated_at     = now();

-- ── Bond-specific metadata ────────────────────────────────────────────────

UPDATE public.investment_instruments SET yield_rate = '4.52%', maturity = '10 Years', credit_rating = 'AAA' WHERE id = 'US10Y';
UPDATE public.investment_instruments SET yield_rate = '4.75%', maturity = '30 Years', credit_rating = 'AAA' WHERE id = 'US30Y';
UPDATE public.investment_instruments SET yield_rate = '4.90%', maturity = '2 Years',  credit_rating = 'AAA' WHERE id = 'US2Y';
UPDATE public.investment_instruments SET yield_rate = '4.28%', maturity = '10 Years', credit_rating = 'AA'  WHERE id = 'UKGILT';
UPDATE public.investment_instruments SET yield_rate = '2.50%', maturity = '10 Years', credit_rating = 'AAA' WHERE id = 'BUND';

-- ── Fixed income ──────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, exchange, min_investment, currency, description, yield_rate, maturity, credit_rating, sort_order)
VALUES
  ('TBILL3M', 'fixed_income', 'US T-Bill 3-Month',    'TBILL3M', '$',  99.92,  0.01, 0.01, 'US Treasury', 100,  'USD', 'Short-term US government obligation. Near-zero default risk. Popular cash management instrument.', '5.28%', '3 Months', 'AAA', 1),
  ('IGBOND',  'fixed_income', 'IG Corporate Bond',    'IGBOND',  'IG', 97.30,  0.10, 0.10, 'OTC',         500,  'USD', 'Investment-grade corporate bond basket. Yield premium over Treasuries with strong credit ratings.',   '5.45%', '5 Years',  'BBB', 2),
  ('HYBOND',  'fixed_income', 'High-Yield Corp Bond', 'HYBOND',  'HY', 95.10, -0.20,-0.21, 'OTC',         500,  'USD', 'Below-investment-grade bonds with higher yields in exchange for greater credit risk.',              '7.80%', '5 Years',  'BB',  3),
  ('MUNI',    'fixed_income', 'Municipal Bond',       'MUNI',    'M',  98.50,  0.05, 0.05, 'OTC',         500,  'USD', 'US state & municipal debt. Interest typically exempt from federal income tax.',                     '3.80%', '10 Years', 'AA',  4),
  ('AGMBS',   'fixed_income', 'Agency MBS',           'AGMBS',   'AG', 96.40,  0.08, 0.08, 'OTC',         1000, 'USD', 'Mortgage-backed securities guaranteed by Fannie Mae / Freddie Mac / Ginnie Mae.',                   '5.65%', '30 Years', 'AAA', 5)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- ── Commodities ───────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, volume_24h_display, exchange, min_investment, currency, unit, description, sort_order)
VALUES
  ('WTICRUDE', 'commodities', 'WTI Crude Oil', 'WTI', '🛢',  82.45,  1.10,  1.35, '$22B',  'NYMEX', 10, 'USD', 'per barrel', 'West Texas Intermediate — US benchmark crude oil. Affected by OPEC, US inventories and global demand.',   1),
  ('NATGAS',   'commodities', 'Natural Gas',   'NG',  '🔥',   1.95, -0.05, -2.50, '$4.5B', 'NYMEX', 10, 'USD', 'per MMBtu',  'Henry Hub natural gas. Highly seasonal commodity driven by weather and LNG exports.',                    2),
  ('WHEAT',    'commodities', 'Wheat',         'ZW',  '🌾', 545.25,  4.75,  0.88, '$1.2B', 'CBOT',  10, 'USD', 'per bushel', 'CBOT wheat futures. Affected by weather, geopolitics and global food supply dynamics.',                  3),
  ('CORN',     'commodities', 'Corn',          'ZC',  '🌽', 435.50,  2.25,  0.52, '$1.8B', 'CBOT',  10, 'USD', 'per bushel', 'CBOT corn. Used for food, animal feed and ethanol. Sensitive to US planting and SA harvests.',          4),
  ('COFFEE',   'commodities', 'Coffee',        'KC',  '☕', 190.35, -1.20, -0.63, '$0.8B', 'ICE',   10, 'USD', 'per lb',     'ICE Arabica coffee futures. Affected by weather in Brazil/Colombia and global demand.',               5),
  ('COTTON',   'commodities', 'Cotton',        'CT',  '🌿',  79.85,  0.55,  0.69, '$0.5B', 'ICE',   10, 'USD', 'per lb',     'ICE cotton futures. Key textile input. Driven by weather, global supply and trade policy.',           6),
  ('SOYBEANS', 'commodities', 'Soybeans',      'ZS',  '🫘',1132.50,  6.25,  0.55, '$2.2B', 'CBOT',  10, 'USD', 'per bushel', 'CBOT soybean futures. Crushed into oil and animal feed. Sensitive to South American weather.',        7)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- ── Futures ───────────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, volume_24h_display, exchange, min_investment, currency, expiry_date, contract_size, description, sort_order)
VALUES
  ('ES',  'futures', 'S&P 500 E-Mini',      'ES',  'ES', 5215.50, 18.25, 0.35, '$280B', 'CME',   50, 'USD', 'Jun 2025', '$50×index',       'Most liquid equity index futures. Used to hedge S&P 500 exposure and for speculative trading.',    1),
  ('NQ',  'futures', 'NASDAQ E-Mini',       'NQ',  'NQ',18440.25, 95.50, 0.52, '$180B', 'CME',   50, 'USD', 'Jun 2025', '$20×index',       'E-mini futures tracking NASDAQ-100. Popular with tech sector traders and hedge funds.',           2),
  ('CL',  'futures', 'Crude Oil Futures',   'CL',  'CL',   82.80,  1.15, 1.41, '$45B',  'NYMEX', 50, 'USD', 'May 2025', '1,000 bbl',       'WTI crude oil futures — benchmark for US oil pricing. Massive daily volumes from traders.',       3),
  ('GCF', 'futures', 'Gold Futures',        'GC',  'GC', 2315.80, 12.40, 0.54, '$35B',  'COMEX', 50, 'USD', 'Jun 2025', '100 troy oz',     'COMEX gold futures. Used for hedging inflation and geopolitical risk.',                          4),
  ('SIF', 'futures', 'Silver Futures',      'SI',  'SI',   27.45,  0.38, 1.40, '$8B',   'COMEX', 50, 'USD', 'May 2025', '5,000 troy oz',   'COMEX silver futures. More volatile than gold with significant industrial demand.',               5),
  ('NGF', 'futures', 'Natural Gas Futures', 'NGF', 'NG',    1.98, -0.04,-1.98, '$6B',   'NYMEX', 50, 'USD', 'May 2025', '10,000 MMBtu',    'Henry Hub natural gas futures. Highly volatile due to weather seasonality.',                      6)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- ── Options ───────────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, exchange, min_investment, currency, option_type, strike_price, option_expiry, underlying, description, sort_order)
VALUES
  ('AAPL-CALL-200', 'options', 'AAPL Call $200',  'AAPL $200C', 'C',  4.80, 0.35,  7.87, 'CBOE', 10, 'USD', 'Call', '$200', 'Jun 20, 2025', 'AAPL', 'Call on Apple stock. Profitable if AAPL rises above $200 before expiry.',       1),
  ('SPY-PUT-500',   'options', 'SPY Put $500',    'SPY $500P',  'P',  8.25,-0.50, -5.71, 'CBOE', 10, 'USD', 'Put',  '$500', 'Jun 20, 2025', 'SPY',  'Put on SPY. Provides downside protection or short S&P 500 exposure.',           2),
  ('TSLA-CALL-200', 'options', 'TSLA Call $200',  'TSLA $200C', 'C',  6.15,-0.80,-11.50, 'CBOE', 10, 'USD', 'Call', '$200', 'Jun 20, 2025', 'TSLA', 'Call on Tesla. High IV makes options expensive but potentially rewarding.',     3),
  ('NVDA-CALL-900', 'options', 'NVDA Call $900',  'NVDA $900C', 'C', 22.50, 3.10, 15.97, 'CBOE', 10, 'USD', 'Call', '$900', 'Jun 20, 2025', 'NVDA', 'Call on NVIDIA. AI demand makes NVDA one of the most traded option contracts.', 4),
  ('QQQ-PUT-420',   'options', 'QQQ Put $420',    'QQQ $420P',  'P',  5.40, 0.20,  3.85, 'CBOE', 10, 'USD', 'Put',  '$420', 'Jun 20, 2025', 'QQQ',  'Put on QQQ — bearish exposure to NASDAQ-100 tech stocks.',                     5)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- ── Metals ────────────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, market_cap_display, volume_24h_display, exchange, min_investment, currency, unit, description, sort_order)
VALUES
  ('XAUUSD', 'metals', 'Gold Spot',      'XAU/USD', 'Au', 2318.50, 14.20,  0.62, '~$14T',  '$220B', 'OTC Spot', 10, 'USD', 'per troy oz', 'World''s premier safe-haven asset. Inversely correlated with USD and real interest rates.',  1),
  ('XAGUSD', 'metals', 'Silver Spot',    'XAG/USD', 'Ag',   27.55,  0.42,  1.55, '~$1.7T', '$15B',  'OTC Spot', 10, 'USD', 'per troy oz', 'Dual role: precious metal and industrial commodity (solar panels, electronics).',          2),
  ('XPTUSD', 'metals', 'Platinum Spot',  'XPT/USD', 'Pt',  985.30,  8.15,  0.84, '~$230B', '$1.2B', 'OTC Spot', 10, 'USD', 'per troy oz', 'Rarer than gold. Strong auto-catalyst demand (catalytic converters). SA supply focus.',   3),
  ('XPDUSD', 'metals', 'Palladium Spot', 'XPD/USD', 'Pd', 1045.80, -5.60, -0.53, '~$80B',  '$0.5B', 'OTC Spot', 10, 'USD', 'per troy oz', 'Rarest major precious metal. Used in petrol catalytic converters. Russia/SA supply.',     4),
  ('XCUUSD', 'metals', 'Copper Spot',    'XCU/USD', 'Cu',    4.28,  0.06,  1.42, '~$800B', '$12B',  'LME',      10, 'USD', 'per lb',      'The "PhD in economics" metal. Critical for EVs, renewable energy and electrification.',  5)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();

-- ── NFTs ──────────────────────────────────────────────────────────────────

INSERT INTO public.investment_instruments
  (id, category_id, name, symbol, icon, price, change_24h, change_pct_24h, market_cap_display, volume_24h_display, exchange, min_investment, currency, blockchain, nft_supply, floor_price, description, sort_order)
VALUES
  ('PUNKS',   'nfts', 'CryptoPunks',          'PUNKS',  '👾', 48500,   850,  1.79, '$1.5B', '$3.2M', 'Ethereum', 100, 'USD', 'Ethereum', '10,000',  '48.5 ETH', 'One of the first NFT projects on Ethereum. 10,000 pixel-art characters — iconic OG status.',           1),
  ('BAYC',    'nfts', 'Bored Ape Yacht Club',  'BAYC',   '🦍', 32500,  -500, -1.52, '$1.2B', '$1.8M', 'Ethereum', 100, 'USD', 'Ethereum', '10,000',  '32.5 ETH', '10,000 unique Bored Ape NFTs. Holder membership grants exclusive access and commercial rights.',         2),
  ('AZUKI',   'nfts', 'Azuki',                'AZUKI',  '🎴',  8900,   120,  1.37, '$220M', '$0.9M', 'Ethereum', 100, 'USD', 'Ethereum', '10,000',  '8.9 ETH',  'Brand for the metaverse by anime and streetwear enthusiasts. High-quality art and strong community.', 3),
  ('DOODLES', 'nfts', 'Doodles',              'DOODLE', '🌈',  4200,    85,  2.07, '$105M', '$0.5M', 'Ethereum', 100, 'USD', 'Ethereum', '10,000',  '4.2 ETH',  'Community-driven colorful NFT collection known for active governance and events.',                      4),
  ('CLONEX',  'nfts', 'Clone X',              'CLONEX', '🤖',  3800,  -120, -3.07, '$95M',  '$0.6M', 'Ethereum', 100, 'USD', 'Ethereum', '19,000',  '3.8 ETH',  'RTFKT × Takashi Murakami 3D avatars designed for the metaverse and virtual worlds.',                    5)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, updated_at = now();


-- ============================================================================
-- 15. PLATFORM SETTINGS — investment defaults
-- ============================================================================

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('investment_trading_fee_percent',  '0.5',  'Fee charged on investment buy/sell orders as a percentage (0.5 = 0.5%)'),
  ('investment_min_buy_usd',          '1',    'Global minimum investment amount in USD across all instruments'),
  ('investment_settlement_days',      '1',    'Business days before investment orders are settled by the admin team'),
  ('investment_max_single_order_usd', '500000', 'Maximum single investment order amount in USD'),
  ('investment_daily_limit_usd',      '1000000', 'Maximum total investment orders per user per day in USD'),
  ('investment_catalog_overrides',    '{}',   'JSON object of per-instrument admin overrides: price, change, enabled, custom instruments')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to confirm everything was created correctly:
--
--   SELECT COUNT(*) FROM public.investment_categories;   -- should be 9
--   SELECT COUNT(*) FROM public.investment_instruments;  -- should be 47+
--   SELECT id, label, enabled FROM public.investment_categories ORDER BY sort_order;
--   SELECT id, category_id, name, price FROM public.investment_instruments LIMIT 20;
--   SELECT * FROM public.platform_settings WHERE key LIKE 'investment%';
--
-- To test the buy function (replace UUIDs with real values from your DB):
--   SELECT fn_invest_buy(
--     'YOUR_PORTFOLIO_ID'::uuid,
--     'AAPL',
--     100.00
--   );
--
-- To settle an investment order as admin:
--   SELECT fn_admin_settle_investment(
--     'INVESTMENT_TRANSACTION_ID'::uuid,
--     'settle',
--     'Order verified and settled'
--   );
--
-- To reject an order and refund:
--   SELECT fn_admin_settle_investment(
--     'INVESTMENT_TRANSACTION_ID'::uuid,
--     'reject',
--     'Rejected: insufficient documentation'
--   );
--
-- To update an instrument price:
--   SELECT fn_admin_update_instrument_price('AAPL', 190.25, 1.65);
--
-- To pay a dividend to all AAPL holders:
--   SELECT fn_admin_pay_dividend('AAPL', 0.25, 'cash', CURRENT_DATE, CURRENT_DATE);
--
-- ============================================================================
-- HOW TO MAKE A USER AN ADMIN:
--   UPDATE public.users SET is_admin = true WHERE email = 'admin@yourdomain.com';
-- ============================================================================
