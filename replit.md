# Blockchain Tradex - Project Documentation

## Project Summary

**Blockchain Tradex** is a full-featured cryptocurrency trading dashboard and portfolio management application built with React 18, Vite, and Tailwind CSS. Uses Supabase for authentication and PostgreSQL database, CoinGecko API for live market data.

## Current Status

### ✅ Phase 1 — Supabase Connection + DB Schema + RLS
- Supabase auth (email/password) fully wired — Base44 removed
- `database.sql` contains the complete schema with RLS + auto-create trigger
- Trigger auto-creates `public.users` profile + `portfolios` row ($0 cash) on signup

### ✅ Phase 3 — Trade Execution + Realtime Feed

- **Default balance is $0** — new users start with no cash; they must fund their account first
- **Deposit flow** — `DepositDialog` with preset amounts ($100, $500, $1k, $5k, $10k) + custom input
  - Accessible from: sidebar "Fund" button, TradePanel "Fund Account" CTA, Transactions page
  - Calls `depositFunds()` → updates `portfolios.cash_balance` + logs to `transactions` table
- **TradePanel fully wired**:
  - Buy validates cash balance; shows red warning and shortfall amount when insufficient
  - Sell validates holdings; "Max" button fills the max sellable amount
  - "Fund Account" CTA appears when balance is $0
  - Disabled button shows "Insufficient Funds" / "Insufficient Holdings" instead of trade action
- **Supabase Realtime** — `RecentTrades` subscribes to `trades` INSERT events via `postgres_changes`; updates without page refresh. Same subscription also active in Transactions page for both tables.
- **Transaction filters** (Transactions page):
  - Symbol search (type BTC, ETH, etc.)
  - Type filter: All / Buy / Sell / Deposit / Withdrawal
  - Date range: All Time / Today / This Week / This Month
  - Live result count shown
- **Layout sidebar** — shows Portfolio Value + Cash Balance; "Fund" + "Withdraw" buttons side by side

### ✅ Phase 2 — Real Per-User Portfolio Data
- `PortfolioContext` provides `portfolioId`, `cashBalance`, `holdings`, `holdingsMap` app-wide
- `PortfolioProvider` wraps the entire app inside `AuthProvider`
- `executeTrade()` atomically updates: creates trade → upserts holding → debits/credits cash
- All hardcoded holdings replaced with real Supabase data
- Cash balance shown in TradePanel; available holdings shown when selling
- RecentTrades reads from `trades` table (not `transactions`)
- PortfolioStats shows real trade count + cash balance from Supabase
- AlertManager creates alerts scoped to `portfolio_id`
- Transactions page shows both trades and withdrawal/deposit history
- WithdrawalSidebar stores withdrawals in `transactions` table with `portfolio_id`

### ✅ Phase 4 — UI/UX Polish + Realtime Subscriptions

- **NotificationCenter moved to Layout.jsx** — price alert toasts fire on every page, not just Alerts page
  - Alerts fetched via `useQuery` with 30s refetch interval; `triggeredRef` persists across navigation
  - Layout reads `portfolioId` from `usePortfolio()` and `cryptoList` from `useLivePrices()`
- **Alerts page** — removed duplicate `NotificationCenter` mount; added Supabase realtime subscription on `price_alerts` table so the list updates instantly when an alert is triggered
- **Analytics page** — fully rewritten:
  - New **Portfolio Allocation** donut chart (inner radius/outer radius) with holdings from `useLivePrices()` + cash balance; bar legend with percentage bars
  - Summary stats row: Portfolio Value, Total Withdrawals, Trading Volume, Total Activity
  - Monthly Activity bar chart, Withdrawal Methods pie, Cumulative Withdrawals area chart
  - Empty-state messages for each chart; animated entry with `framer-motion`
- **PortfolioContext** — added Supabase realtime subscriptions on `portfolios` (UPDATE) and `holdings` (*) tables so cash balance and holdings sync automatically when DB changes without needing explicit `refetch()`

### ⚠️ One-time Manual Step Required
The user must run `database.sql` in the Supabase SQL Editor before the app fully works. This creates all tables, RLS policies, and the auto-signup trigger.

## Project Structure

```
├── .env.local                         # Supabase + CoinGecko env vars
├── database.sql                       # Full schema + RLS + auto-create trigger
├── ROADMAP.md                         # 7-phase implementation plan
├── vite.config.js                     # Vite config (port 5000)
└── src/
    ├── App.jsx                        # Root: AuthProvider > PortfolioProvider > Router
    ├── contexts/
    │   └── PortfolioContext.jsx        # PortfolioProvider + usePortfolio hook
    ├── hooks/
    │   └── useLivePrices.js           # Live prices merged with real Supabase holdings
    ├── lib/
    │   ├── AuthContext.jsx            # Supabase auth provider
    │   ├── supabaseClient.js          # Supabase client instance
    │   ├── query-client.js            # TanStack Query config
    │   └── api/
    │       ├── portfolio.js           # Portfolio, holdings, trades CRUD + executeTrade
    │       ├── transactions.js        # Withdrawals/deposits (requires portfolioId)
    │       └── alerts.js             # Price alerts + frontend↔DB field adapter
    ├── pages/
    │   ├── Dashboard.jsx
    │   ├── Trade.jsx
    │   ├── Markets.jsx
    │   ├── Alerts.jsx                 # Passes portfolioId to AlertManager
    │   ├── Transactions.jsx           # Shows trades + withdrawals combined
    │   ├── Card.jsx
    │   └── Analytics.jsx
    └── components/
        ├── Layout.jsx
        ├── ProtectedRoute.jsx
        └── crypto/
            ├── TradePanel.jsx         # Uses executeTrade; shows cash balance
            ├── RecentTrades.jsx       # Reads from trades table via portfolioId
            ├── PortfolioStats.jsx     # Real trade count + cash balance
            ├── AlertManager.jsx       # Creates alerts scoped to portfolioId
            ├── WithdrawalSidebar.jsx  # Stores withdrawals with portfolioId
            └── NotificationCenter.jsx # Alert trigger detector (no changes needed)
```

## Key Architecture Notes

### PortfolioContext
- Loaded once on auth, provides `portfolioId`, `cashBalance`, `holdings[]`, `holdingsMap{}`
- `refetch()` called after every trade to sync state
- Sits inside `AuthProvider` but outside `QueryClientProvider` and `Router`

### DB Schema Mapping (alerts)
- DB: `symbol` / `condition` (ABOVE|BELOW) / `target_price`
- Frontend: `crypto_symbol` / `alert_type` / `threshold_value`
- `alerts.js` adapter (`toDbAlert` / `toFrontendAlert`) translates between them

### Trade Flow
1. `TradePanel` calls `executeTrade(portfolioId, cashBalance, { symbol, name, type, quantity, unitPrice })`
2. `executeTrade` → creates row in `trades` table → upserts `holdings` row → updates `portfolios.cash_balance`
3. `refetch()` updates `PortfolioContext` → `useLivePrices` re-renders with new holdings

### Withdrawal Flow
- `WithdrawalSidebar` → `createTransaction(portfolioId, { type: "WITHDRAWAL", ... })`
- Stored in `transactions` table (distinct from `trades`)
- `Transactions.jsx` combines both tables sorted by date

## DB Tables Used
- `public.users` — user profiles (auto-created on signup)
- `portfolios` — one per user, has `cash_balance`
- `holdings` — per portfolio, per symbol
- `trades` — BUY/SELL history
- `transactions` — WITHDRAWAL/DEPOSIT history
- `price_alerts` — per portfolio

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
(Set in Replit Secrets pane, not .env.local file)

## Running the Application

```bash
npm run dev   # Runs on port 5000
```

## Dependencies (Key)

- **react** 18 + **vite** 6 + **tailwindcss** 3
- **@supabase/supabase-js** — auth + DB
- **@tanstack/react-query** 5 — data fetching
- **framer-motion** — animations
- **recharts** — charts
- **lucide-react** — icons
- **sonner** — toast notifications
- **date-fns** — date formatting

## Recent UI Changes (April 2026)

- **Sidebar redesign** — Grouped navigation sections (Overview, Portfolio, Markets, History) with collapsible toggles, user profile card at top (avatar, name, email, active dot), inline feature search, gradient balance card, rounded icon badges per nav item, and a dedicated Sign Out row at the bottom.
- **Register form expanded** — Now includes Full Name, Date of Birth, Email, Phone Number, Country (dropdown), Password (with 5-level strength meter), Confirm Password, and a Terms of Service / Privacy Policy checkbox. Organized into labelled sections: Personal Information, Contact Information, Security.
- **Deposit loading state** — Replaced the terminal/console style with a professional animated UI: spinning circular icon, live progress bar with percentage, step-by-step list with completed/active/pending states, and a security notice banner at the bottom.

## Last Updated
April 3, 2026
