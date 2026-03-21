-- ============================================================================
-- BLOCKCHAIN TRADEX - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This SQL script creates the complete database schema for Blockchain Tradex
-- including all tables, relationships, RLS policies, and real-time subscriptions
-- 
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================================

-- ============================================================================
-- 1. ENABLE REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CREATE USERS TABLE (extends Base44 auth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  kyc_verified boolean DEFAULT false,
  kyc_tier text DEFAULT 'basic' CHECK (kyc_tier IN ('basic', 'intermediate', 'pro')),
  phone_number text,
  country text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Create index on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- ============================================================================
-- 3. CREATE PORTFOLIOS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text DEFAULT 'My Portfolio',
  total_value decimal(20,2) DEFAULT 0,
  initial_investment decimal(20,2) DEFAULT 0,
  cash_balance decimal(20,2) DEFAULT 0,
  total_invested decimal(20,2) DEFAULT 0,
  realized_gains decimal(20,2) DEFAULT 0,
  unrealized_gains decimal(20,2) DEFAULT 0,
  roi_percentage decimal(6,2) DEFAULT 0,
  is_public boolean DEFAULT false,
  description text,
  currency text DEFAULT 'USD',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_trade_at timestamp with time zone,
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_created_at ON public.portfolios(created_at);
CREATE INDEX IF NOT EXISTS idx_portfolios_updated_at ON public.portfolios(updated_at);

-- ============================================================================
-- 4. CREATE HOLDINGS TABLE (current assets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  amount decimal(20,8) NOT NULL,
  average_cost decimal(20,2) NOT NULL,
  current_price decimal(20,2),
  total_cost decimal(20,2) GENERATED ALWAYS AS (amount * average_cost) STORED,
  current_value decimal(20,2),
  gain_loss decimal(20,2),
  gain_loss_percentage decimal(8,4),
  allocation_percentage decimal(6,2),
  updated_at timestamp with time zone DEFAULT now(),
  price_updated_at timestamp with time zone,
  UNIQUE (portfolio_id, symbol),
  CONSTRAINT amount_positive CHECK (amount > 0),
  CONSTRAINT average_cost_positive CHECK (average_cost > 0)
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON public.holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON public.holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_holdings_updated_at ON public.holdings(updated_at);

-- ============================================================================
-- 5. CREATE TRADES TABLE (transaction history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity decimal(20,8) NOT NULL,
  unit_price decimal(20,2) NOT NULL,
  total_value decimal(20,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  fees decimal(20,2) DEFAULT 0,
  net_value decimal(20,2),
  notes text,
  trade_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT unit_price_positive CHECK (unit_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio_id ON public.trades(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_trade_date ON public.trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_type ON public.trades(type);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at);

-- ============================================================================
-- 6. CREATE PRICE ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  condition text NOT NULL CHECK (condition IN ('ABOVE', 'BELOW')),
  target_price decimal(20,2) NOT NULL,
  current_price decimal(20,2),
  is_active boolean DEFAULT true,
  triggered_at timestamp with time zone,
  triggered_price decimal(20,2),
  notification_sent boolean DEFAULT false,
  alert_type text DEFAULT 'email' CHECK (alert_type IN ('email', 'sms', 'push', 'in_app')),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT target_price_positive CHECK (target_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_portfolio_id ON public.price_alerts(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON public.price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_is_active ON public.price_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created_at ON public.price_alerts(created_at);

-- ============================================================================
-- 7. CREATE MARKET DATA TABLE (cached price data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text,
  current_price decimal(20,2),
  market_cap decimal(25,2),
  market_cap_rank integer,
  volume_24h decimal(20,2),
  price_change_24h decimal(20,2),
  price_change_percentage_24h decimal(8,4),
  circulating_supply decimal(20,2),
  total_supply decimal(20,2),
  max_supply decimal(20,2),
  ath decimal(20,2),
  ath_change_percentage decimal(8,4),
  atl decimal(20,2),
  atl_change_percentage decimal(8,4),
  last_updated timestamp with time zone DEFAULT now(),
  data_source text DEFAULT 'coingecko',
  CONSTRAINT price_positive CHECK (current_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON public.market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_last_updated ON public.market_data(last_updated);

-- ============================================================================
-- 8. CREATE TRANSACTIONS TABLE (all transactions including deposits/withdrawals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'DIVIDEND', 'FEE')),
  symbol text,
  quantity decimal(20,8),
  price_per_unit decimal(20,2),
  total_amount decimal(20,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  payment_method text,
  reference_number text UNIQUE,
  notes text,
  transaction_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT amount_positive CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON public.transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON public.transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- ============================================================================
-- 9. CREATE WATCHLIST TABLE (favorite assets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  added_at timestamp with time zone DEFAULT now(),
  notes text,
  UNIQUE (portfolio_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_portfolio_id ON public.watchlist(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON public.watchlist(added_at);

-- ============================================================================
-- 10. CREATE PRICE HISTORY TABLE (for charting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  open decimal(20,2),
  high decimal(20,2),
  low decimal(20,2),
  close decimal(20,2) NOT NULL,
  volume decimal(20,2),
  interval text DEFAULT '1h' CHECK (interval IN ('1m', '5m', '15m', '1h', '4h', '1d', '1w', '1mo')),
  CONSTRAINT close_positive CHECK (close > 0)
);

CREATE INDEX IF NOT EXISTS idx_price_history_symbol_timestamp ON public.price_history(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_interval ON public.price_history(symbol, interval);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON public.price_history(timestamp);

-- ============================================================================
-- 11. CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('alert_triggered', 'trade_executed', 'price_update', 'system', 'info')),
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- ============================================================================
-- 12. CREATE AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ============================================================================
-- 13. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: market_data, price_history are public read-only

-- ============================================================================
-- 14. CREATE RLS POLICIES - USERS TABLE
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public can view limited user info (for portfolios shared publicly)
CREATE POLICY "Public can view user info for public portfolios" ON public.users
  FOR SELECT
  USING (true);

-- ============================================================================
-- 15. CREATE RLS POLICIES - PORTFOLIOS TABLE
-- ============================================================================

-- Users can view their own portfolios
CREATE POLICY "Users can view own portfolios" ON public.portfolios
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public portfolios
CREATE POLICY "Public can view public portfolios" ON public.portfolios
  FOR SELECT
  USING (is_public = true);

-- Users can insert portfolios for themselves
CREATE POLICY "Users can create own portfolios" ON public.portfolios
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own portfolios
CREATE POLICY "Users can update own portfolios" ON public.portfolios
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own portfolios
CREATE POLICY "Users can delete own portfolios" ON public.portfolios
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 16. CREATE RLS POLICIES - HOLDINGS TABLE
-- ============================================================================

-- Users can view holdings of their own portfolios
CREATE POLICY "Users can view own holdings" ON public.holdings
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can view holdings of public portfolios
CREATE POLICY "Public can view holdings of public portfolios" ON public.holdings
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE is_public = true
    )
  );

-- Users can insert holdings to their portfolios
CREATE POLICY "Users can create holdings in own portfolios" ON public.holdings
  FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can update holdings in their portfolios
CREATE POLICY "Users can update holdings in own portfolios" ON public.holdings
  FOR UPDATE
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

-- Users can delete holdings from their portfolios
CREATE POLICY "Users can delete holdings from own portfolios" ON public.holdings
  FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 17. CREATE RLS POLICIES - TRADES TABLE
-- ============================================================================

-- Users can view trades from their portfolios
CREATE POLICY "Users can view own trades" ON public.trades
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can view trades from public portfolios
CREATE POLICY "Public can view trades of public portfolios" ON public.trades
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE is_public = true
    )
  );

-- Users can create trades in their portfolios
CREATE POLICY "Users can create trades in own portfolios" ON public.trades
  FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can update trades in their portfolios
CREATE POLICY "Users can update trades in own portfolios" ON public.trades
  FOR UPDATE
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

-- Users can delete trades from their portfolios
CREATE POLICY "Users can delete trades from own portfolios" ON public.trades
  FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 18. CREATE RLS POLICIES - PRICE ALERTS TABLE
-- ============================================================================

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts" ON public.price_alerts
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can create alerts for their portfolios
CREATE POLICY "Users can create alerts in own portfolios" ON public.price_alerts
  FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can update their own alerts
CREATE POLICY "Users can update own alerts" ON public.price_alerts
  FOR UPDATE
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

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts" ON public.price_alerts
  FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 19. CREATE RLS POLICIES - TRANSACTIONS TABLE
-- ============================================================================

-- Users can view transactions from their portfolios
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can view transactions from public portfolios
CREATE POLICY "Public can view transactions of public portfolios" ON public.transactions
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE is_public = true
    )
  );

-- Users can create transactions in their portfolios
CREATE POLICY "Users can create transactions in own portfolios" ON public.transactions
  FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can update transactions in their portfolios
CREATE POLICY "Users can update transactions in own portfolios" ON public.transactions
  FOR UPDATE
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

-- ============================================================================
-- 20. CREATE RLS POLICIES - WATCHLIST TABLE
-- ============================================================================

-- Users can view their own watchlist
CREATE POLICY "Users can view own watchlist" ON public.watchlist
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can add to their watchlist
CREATE POLICY "Users can add to own watchlist" ON public.watchlist
  FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Users can remove from their watchlist
CREATE POLICY "Users can remove from own watchlist" ON public.watchlist
  FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 21. CREATE RLS POLICIES - NOTIFICATIONS TABLE
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 22. CREATE RLS POLICIES - AUDIT LOGS TABLE
-- ============================================================================

-- Only admins can view audit logs (disabled for now, can be enabled with proper role)
-- Users cannot directly access audit logs

-- ============================================================================
-- 23. PUBLIC READ ACCESS - MARKET DATA & PRICE HISTORY
-- ============================================================================

-- Everyone can read market data (no RLS needed, or all can read)
CREATE POLICY "Everyone can read market data" ON public.market_data
  FOR SELECT
  USING (true);

-- Everyone can read price history (no RLS needed, or all can read)
CREATE POLICY "Everyone can read price history" ON public.price_history
  FOR SELECT
  USING (true);

-- ============================================================================
-- 24. SETUP REAL-TIME SUBSCRIPTIONS (Realtime Publication)
-- ============================================================================

-- Enable replication for real-time changes
BEGIN;
  -- Drop existing publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  
  -- Create publication for real-time events
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.portfolios,
    public.holdings,
    public.trades,
    public.price_alerts,
    public.transactions,
    public.market_data,
    public.price_history,
    public.notifications,
    public.watchlist;
COMMIT;

-- ============================================================================
-- 25. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to update portfolio value
CREATE OR REPLACE FUNCTION public.update_portfolio_value(portfolio_id uuid)
RETURNS decimal
LANGUAGE plpgsql
AS $$
DECLARE
  total_value decimal := 0;
BEGIN
  SELECT COALESCE(SUM(current_value), 0) INTO total_value
  FROM public.holdings
  WHERE holdings.portfolio_id = update_portfolio_value.portfolio_id;
  
  UPDATE public.portfolios
  SET 
    total_value = total_value,
    updated_at = now()
  WHERE id = portfolio_id;
  
  RETURN total_value;
END;
$$;

-- Function to update holding current value
CREATE OR REPLACE FUNCTION public.update_holding_values(holding_id uuid, price decimal)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.holdings
  SET 
    current_price = price,
    current_value = amount * price,
    gain_loss = (amount * price) - total_cost,
    gain_loss_percentage = CASE 
      WHEN total_cost = 0 THEN 0 
      ELSE ((amount * price - total_cost) / total_cost) * 100 
    END,
    price_updated_at = now()
  WHERE id = holding_id;
END;
$$;

-- Function to calculate portfolio allocation
CREATE OR REPLACE FUNCTION public.update_allocation_percentages(portfolio_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  portfolio_total decimal;
BEGIN
  SELECT total_value INTO portfolio_total
  FROM public.portfolios
  WHERE id = update_allocation_percentages.portfolio_id;
  
  IF portfolio_total > 0 THEN
    UPDATE public.holdings
    SET allocation_percentage = (current_value / portfolio_total) * 100
    WHERE holdings.portfolio_id = update_allocation_percentages.portfolio_id;
  END IF;
END;
$$;

-- Function to handle new trade
CREATE OR REPLACE FUNCTION public.handle_new_trade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalculate portfolio value after trade
  PERFORM public.update_portfolio_value(NEW.portfolio_id);
  PERFORM public.update_allocation_percentages(NEW.portfolio_id);
  
  -- Update last_trade_at timestamp
  UPDATE public.portfolios
  SET last_trade_at = now()
  WHERE id = NEW.portfolio_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for trades
DROP TRIGGER IF EXISTS trigger_handle_new_trade ON public.trades;
CREATE TRIGGER trigger_handle_new_trade
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_trade();

-- Function to update user timestamp on profile change
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for users table
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_updated_at();

-- Function to update portfolio timestamp on changes
CREATE OR REPLACE FUNCTION public.update_portfolios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for portfolios table
DROP TRIGGER IF EXISTS trigger_update_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER trigger_update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_portfolios_updated_at();

-- ============================================================================
-- 26. GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant table permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Grant read-only permissions for public data
GRANT SELECT ON public.market_data TO authenticated, anon;
GRANT SELECT ON public.price_history TO authenticated, anon;

-- Grant function execution
GRANT EXECUTE ON FUNCTION public.update_portfolio_value TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_holding_values TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_allocation_percentages TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_trade TO authenticated;

-- ============================================================================
-- 27. CREATE SAMPLE DATA (OPTIONAL - Comment out in production)
-- ============================================================================

-- Note: Uncomment the following to add sample data for testing

/*
-- Note: You need to create a test user first in Supabase Auth
-- Then use the user ID in the INSERT statements below

-- Insert sample market data
INSERT INTO public.market_data (symbol, name, current_price, market_cap, market_cap_rank, volume_24h, price_change_24h, price_change_percentage_24h)
VALUES
  ('BTC', 'Bitcoin', 70102.04, 1378800000000, 1, 42500000000, 742.14, 1.41),
  ('ETH', 'Ethereum', 3850.25, 462500000000, 2, 18900000000, 89.50, 2.38),
  ('SOL', 'Solana', 178.45, 65200000000, 5, 2850000000, 3.25, 1.85),
  ('XRP', 'Ripple', 2.45, 135600000000, 6, 3250000000, 0.12, 0.05),
  ('AVAX', 'Avalanche', 38.90, 16500000000, 12, 850000000, 1.23, 3.26)
ON CONFLICT (symbol) DO NOTHING;
*/

-- ============================================================================
-- 28. AUTO-CREATE USER PROFILE AND PORTFOLIO ON SIGNUP
-- ============================================================================

-- Function triggered when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_portfolio_id uuid;
  username_val text;
BEGIN
  -- Generate a unique username from email prefix + part of UUID
  username_val := split_part(NEW.email, '@', 1) || '_' || substring(replace(NEW.id::text, '-', ''), 1, 6);

  -- Create the user profile row
  INSERT INTO public.users (id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    username_val,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create a default portfolio with $10,000 starting cash balance
  INSERT INTO public.portfolios (user_id, name, cash_balance, initial_investment)
  VALUES (NEW.id, 'My Portfolio', 10000.00, 10000.00)
  RETURNING id INTO new_portfolio_id;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users so it fires on every new registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Grant execution rights
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user TO authenticated, service_role;

-- ============================================================================
-- DATABASE SCHEMA COMPLETE
-- ============================================================================
-- All tables, relationships, RLS policies, and real-time subscriptions are now set up
-- The database is ready for use with the Blockchain Tradex application
-- ============================================================================
