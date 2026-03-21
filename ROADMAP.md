# Blockchain Tradex — Site Completion Roadmap

## Current State
The frontend shell is fully built and running. Auth pages, routing, and UI components are in place.
Live crypto prices already pull from CoinGecko every 30 seconds.
The app needs Supabase wired up to become a fully functional product.

---

## Phase 1 — Connect Supabase (Foundation)
**Goal:** Make auth and data actually work end-to-end.

### 1.1 Add Environment Credentials
- [ ] Create a free project at https://supabase.com
- [ ] Copy your Project URL and anon key into `.env.local`
- [ ] Restart the dev server after saving

### 1.2 Apply the Database Schema
- [ ] Go to Supabase → SQL Editor
- [ ] Run the contents of `database.sql` to create all tables
- [ ] Tables needed: `transactions`, `price_alerts`, `portfolios`, `holdings`

### 1.3 Row Level Security (RLS)
- [ ] Enable RLS on every table (Supabase → Table Editor → RLS)
- [ ] Add policy: users can only read/write their own rows (`auth.uid() = user_id`)

### 1.4 Test Auth Flow
- [ ] Register a new account
- [ ] Confirm email (Supabase sends a confirmation link)
- [ ] Log in and verify redirect to Dashboard
- [ ] Test Forgot Password email flow

---

## Phase 2 — Real Portfolio Data
**Goal:** Replace hardcoded holdings with real per-user data from Supabase.

### 2.1 Portfolio Table
- [ ] Create `portfolios` table: `user_id`, `coin_symbol`, `quantity`, `avg_buy_price`
- [ ] Seed one row per coin per user on first login

### 2.2 Wire up useLivePrices Hook
- [ ] Fetch holdings from Supabase instead of the hardcoded `HOLDINGS` object in `src/hooks/useLivePrices.js`
- [ ] Merge live prices with real user holdings to compute real portfolio value

### 2.3 Dashboard Stats
- [ ] `PortfolioStats` component shows real total value and 24h change
- [ ] Portfolio chart reflects real balances over time

---

## Phase 3 — Trade Execution
**Goal:** Trades actually execute and persist.

### 3.1 Trade Panel Logic
- [ ] `TradePanel` currently shows a UI — wire the Buy/Sell button to `createTransaction()`
- [ ] On buy: deduct from virtual cash balance, add to holdings in `portfolios` table
- [ ] On sell: remove from holdings, add to virtual cash balance
- [ ] Validate user has enough balance before allowing trade

### 3.2 Transaction History
- [ ] `Transactions` page already fetches from Supabase — confirm data appears after trades
- [ ] Add filter by coin, type (buy/sell), and date range

### 3.3 Real-time Trade Feed
- [ ] Subscribe to `transactions` table changes via Supabase Realtime
- [ ] `RecentTrades` component updates without a page refresh

---

## Phase 4 — Price Alerts
**Goal:** Alerts fire when a target price is crossed.

### 4.1 Create & List Alerts
- [ ] `Alerts` page already has create/delete wired to Supabase — confirm it works after Phase 1
- [ ] Show alert status: Active / Triggered

### 4.2 Alert Trigger Logic
- [ ] In `useLivePrices`, compare live prices against the user's alerts on each 30-second tick
- [ ] When a price crosses the target, mark alert as `triggered` in Supabase
- [ ] Show a toast/notification in the UI when an alert fires

---

## Phase 5 — Analytics
**Goal:** Meaningful charts from real trade history.

### 5.1 Portfolio Value Over Time
- [ ] Record a daily snapshot of portfolio value in a `portfolio_snapshots` table
- [ ] Chart the historical value on the Analytics page

### 5.2 Profit / Loss Breakdown
- [ ] Calculate P&L per coin: `(current price − avg buy price) × quantity`
- [ ] Display as a bar chart grouped by coin

### 5.3 Trading Activity
- [ ] Volume traded per day/week
- [ ] Win rate: trades where sell price > buy price

---

## Phase 6 — Virtual Card
**Goal:** Upgrade from localStorage to Supabase persistence.

- [ ] Move card data from `localStorage` to a `cards` table in Supabase
- [ ] Card is created once per user on first login and persists across devices
- [ ] Show real spending calculated from `transactions` (sum of sells)
- [ ] Add card freeze/unfreeze toggle that saves to DB

---

## Phase 7 — Polish & Production Readiness
**Goal:** App is ready to ship.

### 7.1 UX Improvements
- [ ] Add loading skeletons for all data-fetching components
- [ ] Add empty states (no trades yet, no alerts set, etc.)
- [ ] Mobile responsiveness audit across all pages
- [ ] Dark/light theme toggle (next-themes is already installed)

### 7.2 Error Handling
- [ ] Wrap all Supabase calls in try/catch with user-facing error toasts
- [ ] Handle CoinGecko rate limit (429) gracefully — show cached data

### 7.3 Security
- [ ] Confirm all tables have RLS enabled
- [ ] Ensure no sensitive data is stored in localStorage
- [ ] Review Supabase auth settings (disable email enumeration, etc.)

### 7.4 Deploy
- [ ] Add production env vars to Replit Secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Click Publish in Replit to deploy to a `.replit.app` domain
- [ ] Test the full flow in production (register → trade → view analytics)

---

## Quick Reference: Key Files

| What | File |
|---|---|
| Supabase client | `src/lib/supabaseClient.js` |
| Auth context | `src/lib/AuthContext.jsx` |
| Live prices hook | `src/hooks/useLivePrices.js` |
| Transactions API | `src/lib/api/transactions.js` |
| Alerts API | `src/lib/api/alerts.js` |
| Card logic | `src/lib/api/cards.js` |
| Database schema | `database.sql` |
| Environment vars | `.env.local` |
