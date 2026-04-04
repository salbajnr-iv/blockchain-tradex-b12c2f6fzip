# Blockchain Tradex - Project Documentation

## Project Summary

**Blockchain Tradex** is a full-featured cryptocurrency trading dashboard and portfolio management application built with React 18, Vite, and Tailwind CSS. Uses Supabase for authentication and PostgreSQL database, CoinGecko API for live market data.

## Withdrawal System (Latest)

### Professional Withdrawal Page (`/withdrawal`)
- **Route**: `/withdrawal` — full-page, protected route inside the Layout
- **Navigation**: Sidebar "Withdraw" button + Transactions page "Withdraw" button both navigate to this page
- **KYC Gate**: Fetches `kyc_submissions` table; blocks withdrawal if not `approved`, shows CTA to `/settings/kyc`
- **Balance Check**: Reads `cashBalance` from PortfolioContext; disables submit if amount exceeds balance
- **Country-aware Bank Fields**: Reads `user.user_metadata.country`; shows localized bank fields:
  - US: Routing Number + Account Number + Account Type
  - UK: Sort Code + Account Number
  - Australia/NZ: BSB + Account Number
  - Canada: Transit + Institution + Account Number
  - EU countries: IBAN + BIC/SWIFT
  - International/default: IBAN + SWIFT/BIC
- **Method-specific forms**: Bank Transfer, Crypto Wallet (coin + network + address), PayPal (email + confirm + name), Wire Transfer (full international fields)
- **"Proceed Withdrawal" button**: Only enabled when KYC approved + valid amount ≤ balance + method details filled
- **Submission**: Creates a `WITHDRAWAL` transaction with `status: 'pending'` and `withdrawal_details` JSONB
- **Status Tracker**: After submit, shows real-time step tracker (Submitted → Pending → Reviewed → Final Decision) via Supabase Realtime subscription on `transactions` table
- **Admin Message**: Displays message from admin team when `admin_message` field is set on the transaction

### Database Migration (`withdrawal-migration.sql`)
Run this script in Supabase SQL Editor to enable the new withdrawal system:
- `transactions.withdrawal_details jsonb` — stores method-specific fields
- `transactions.admin_message text` — admin message sent back to user
- `transactions.reviewed_at timestamp` — when admin reviewed
- `transactions.reviewed_by uuid` — which admin reviewed
- `users.is_admin boolean` — admin flag; set `is_admin = true` for admin users
- RLS policies for admin to view and update all transactions
- `fn_admin_update_withdrawal(transaction_id, status, message)` RPC function for admin console

### Admin Console (Pending)
Not yet developed. To use admin features:
1. Run `withdrawal-migration.sql`
2. `UPDATE public.users SET is_admin = true WHERE email = 'admin@yourdomain.com';`
3. Admin can call `fn_admin_update_withdrawal` via Supabase client to update status + send message

### Transaction List Enhancements
- `admin_message` field now displayed in Transactions page under withdrawal entries
- Old broker terminal animation removed; withdrawal now navigates to the full page

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

### ✅ Phase 6 — Auth Redesign + System Notifications + Live Markets

**Auth Pages (Full Redesign):**
- All 4 auth pages (Login, Register, ForgotPassword, ResetPassword) redesigned with professional split-panel layout
- Left panel: fixed dark brand panel (`#080d14`) with grid pattern, logo, taglines, feature bullets, social proof stats
- Right panel: adapts to light/dark theme via CSS variables
- `ThemeToggle` added to all auth pages — users can switch theme before logging in
- Register page has numbered section headers (1 Personal, 2 Contact, 3 Security) for clearer UX
- ForgotPassword shows a step-by-step guide after sending the reset email

**Light Theme:**
- `ThemeContext` was already fully wired; now the auth pages expose the toggle button so it's accessible pre-login
- CSS variables already fully define both `:root` (light) and `.dark` (dark) themes

**System Notifications:**
- New `src/hooks/useSystemNotifications.js` — global event emitter for system-level notifications
  - Auto-fires "Markets are live" welcome message on first load (2s delay)
  - Auto-detects coins with ≥5% 24h movement and emits market mover alerts (deduplicated per hour per coin)
  - Monitors portfolio total for ≥2% changes and emits portfolio gain/loss alerts
- `NotificationCenter.jsx` updated to handle both price alert toasts AND system notification toasts
- **Notification bell** added to the main header with a live unread badge count
  - Dropdown panel shows full notification history (system + alert-triggered) with dismiss/clear-all
  - Link to the Alerts page for configured price alerts

**Markets Page — Live CoinGecko Data:**
- Completely rebuilt `Markets.jsx` — no longer uses old `MarketTable.jsx`
- New `src/hooks/useMarketCoins.js` fetches top 100 coins from CoinGecko `/coins/markets` every 60 seconds
- Features: search bar, filter tabs (All/Top Gainers/Top Losers/Top 10), sortable columns (all 7 columns)
- Shows coin image from CoinGecko, rank, name, price, 24h %, 7d %, volume, market cap, holdings
- Watchlist toggle (⭐) saved to localStorage per coin
- Hover shows "Trade →" button for coins not in portfolio
- Pagination: 25 coins per page with prev/next + page number controls
- Summary stats strip: total coins, top gainer, top loser, gainers/losers ratio

### ✅ Phase 5 — KYC Verification + Trade Page Upgrade

**KYC System (End-to-End):**
- `src/lib/api/kyc.js` — API layer: fetch submission, upload files, submit application, get signed URLs, realtime subscription
- `src/pages/settings/Kyc.jsx` — Full multi-step KYC flow (5 steps): Personal Info → Document Info → Upload ID → Selfie → Review & Submit
- Drag-and-drop file upload zones for ID front/back, selfie, proof of address
- Files uploaded to Supabase Storage buckets: `kyc-documents` (10MB, images+PDF), `kyc-selfies` (5MB, images)
- Real-time status tracking via `subscribeToKycStatus()` — Supabase `postgres_changes` subscription
- Status badge shows: pending / under_review / approved / rejected / more_info_needed
- Submission timeline shows progress; reviewer notes and rejection reasons displayed live
- Users can resubmit after rejection or when more info is needed
- KYC nav item added to Settings sidebar

**Signup + Profile Sync Fix:**
- `AuthContext.signUp()` now passes phone, country, date_of_birth as auth metadata options
- `Register.jsx` passes all collected fields (phone, country, dateOfBirth) to signUp
- `Profile.jsx` handleSave now calls `fn_sync_user_profile()` RPC to sync changes to `public.users`

**Trade Page Full Redesign:**
- Coin selector strip at the top with colored icons + 24h change
- Live stats bar showing price, 24h change badge, volume, market cap, holdings
- Full-width price chart section
- Live order book with bid/ask visualization (depth bars)
- Trade panel with Market/Limit order types, 25%/50%/75%/Max quick-fill buttons
- Position card showing current holding, avg cost, market value, unrealized P&L
- Market info panel (fee rate, min order, volume, etc.)
- Trade history with real-time Supabase subscription

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

- **Sidebar redesign** — Grouped navigation sections (Overview, Portfolio, Markets, History, Account) with collapsible toggles, user profile card at top, inline feature search, gradient balance card, and a Settings nav item linking to /settings.
- **Register form expanded** — Full Name, DOB, Email, Phone, Country dropdown, password strength meter, Terms checkbox.
- **Deposit loading state** — Professional animated progress bar with step checklist and security notice.
- **Theme system** — Full light/dark theme support via `ThemeContext` + Tailwind `darkMode: ["class"]`. Default is dark. Toggle button in header. Theme persisted to `localStorage`. Flash-free via inline script in `index.html`.
- **Settings pages** — Full `/settings` route with sub-pages: Profile, Security, Appearance, Notifications, Payments. Settings layout has a sidebar sub-nav.
- **Notifications hub** — `/alerts` page now shows all account activity: price alerts, trades, deposits, withdrawals. Filterable by category. Collapsible Alert Manager panel.
- **Dashboard rebuilt** — Live Market Ticker (top 4 coins), Quick Actions grid (Trade, Deposit, Withdraw, Alerts, Markets, Analytics), Top Gainers/Losers panel, Recent Activity feed, Holdings Summary. All sections use `useOutletContext` for deposit/withdraw actions.
- **Outlet context** — Layout.jsx passes `onDepositOpen` and `onWithdrawOpen` via outlet context to child pages.

## New Files (April 2026)

- `src/contexts/ThemeContext.jsx` — ThemeProvider + useTheme hook
- `src/components/ThemeToggle.jsx` — sun/moon toggle button
- `src/pages/settings/Layout.jsx` — settings wrapper with sidebar sub-nav
- `src/pages/settings/Profile.jsx` — profile editing (name, phone, country, bio)
- `src/pages/settings/Security.jsx` — password change + session management
- `src/pages/settings/Appearance.jsx` — light/dark theme selector
- `src/pages/settings/NotificationPrefs.jsx` — per-category notification toggles
- `src/pages/settings/Payments.jsx` — saved payment methods manager
- `supabase-updates.sql` — `user_preferences` table (optional, for future cloud sync)

## Last Updated
April 3, 2026
