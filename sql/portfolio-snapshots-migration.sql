-- Portfolio Snapshots Migration
-- Run this in the Supabase SQL Editor to enable the Portfolio History chart in Analytics.
--
-- This creates a daily snapshot table that stores the user's total portfolio value,
-- cash balance, and crypto value once per day. The Analytics page writes a snapshot
-- on every visit and reads them back to power the Portfolio History chart.

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date    date NOT NULL,
  total_value      numeric(18, 4) NOT NULL DEFAULT 0,
  cash_balance     numeric(18, 4) NOT NULL DEFAULT 0,
  crypto_value     numeric(18, 4) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT portfolio_snapshots_unique UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_portfolio_id_idx
  ON portfolio_snapshots (portfolio_id, snapshot_date DESC);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own snapshots"
  ON portfolio_snapshots FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );
