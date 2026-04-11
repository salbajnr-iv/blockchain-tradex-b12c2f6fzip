# BlockTrade - Project Documentation

## Project Summary

**BlockTrade** is a full-featured cryptocurrency trading dashboard, portfolio management, and multi-asset investment platform built with React 18, Vite, and Tailwind CSS. Uses Supabase for authentication and PostgreSQL database, CoinGecko API for live market data.

## Investment System (Latest)

### User-facing: Investments Hub (`/invest`)
- Accessible via "Markets → Invest" in the main sidebar nav
- **12 investment categories**: Stocks, ETFs, Bonds, Fixed Income, Commodities, Futures, Options, Metals, NFTs, REITs, Private Equity, Alternatives/Crowdfunding
- **120+ pre-seeded instruments** across all categories with realistic prices, 24h changes, market caps, and metadata
- **International market coverage**: US, UK, Europe, Japan, China, India, Canada, Australia, South Korea, Brazil, Singapore
- **Region filter bar**: Globe / US / UK / EU / JP / CN / IN / CA / AU / KR / BR / GLOBAL chips for regional filtering
- **Multi-currency display**: 10-currency picker (USD/EUR/GBP/JPY/CAD/AUD/CNY/INR/BRL/KRW) — prices converted via static exchange rates; preference persisted to localStorage
- **Fractional investing**: instruments with minInvestment ≤ $10 show "Fractional" badge; BuyFlow shows scissors icon + fractional info; fraction % shown when units < 1
- Category chips (horizontal scroll) for filtering; full-text search; 6 sort options (name, price asc/desc, change, held first)
- **Summary bar**: Cash Available, Invested Value (in display currency), Total Instruments shown, Asset Classes count (12)
- **Global Expansion Banner**: country flags, instrument count and currency name displayed
- **Feature Banner row**: Fractional Shares, Multi-Currency, Alt Assets
- **Instrument cards**: icon, name, symbol, category badge, region flag, fractional badge, price (in display currency), 24h change %, "Held" badge and position details
- **InstrumentSheet slide-up modal** on instrument click — shows all metadata (yield, maturity, rating, region, exchange, etc.); BuyFlow/SellFlow propagate display currency
- **Buy Flow (2-step)**: USD amount input, currency conversion note when non-USD, fractional indicator, 0.5% fee → review → confirm
- **Sell Flow (2-step)**: held position in display currency, fractional indicator, net proceeds → review → confirm
- Positions derived live from transaction history (INVESTMENT_BUY - INVESTMENT_SELL)
- Regulatory disclaimer with currency rate note

### Admin: Investment Catalog Management (`/admin/investments`)
- Accessible via "Investments" in admin sidebar
- **Stats bar**: Total instruments, Active, Disabled, Custom Added
- **Category filter tabs** with per-category instrument counts (now 12 categories)
- **Instrument table**: icon, name, symbol (mono), category badge, price, 24h change, min investment, status badge, actions
- **Edit Price modal**: update price + 24h change % for any instrument
- **Toggle Enable/Disable**: single-click to show/hide any instrument
- **Add New Instrument modal**: name, symbol, category (12 options), region selector, icon, price, 24h change, min investment, exchange, market cap, yield, bond-specific fields (maturity, rating), description
- **Edit / Delete**: for admin-created custom instruments only
- All changes stored in `platform_settings` table under key `investment_catalog_overrides` (JSON)

### Data Architecture
- Static catalog in `src/lib/investmentCatalog.js` (12 categories, 120+ instruments, REGIONS array, region field per instrument)
- Exchange rates in `src/lib/exchangeRates.js` (18 currencies, RATES map, CURRENCIES list, formatPrice/formatAmount, localStorage persistence)
- API layer in `src/lib/api/investments.js`
- Admin overrides in `platform_settings.investment_catalog_overrides`
- User transactions in existing `transactions` table using types `INVESTMENT_BUY` / `INVESTMENT_SELL`
- Positions derived client-side from transaction history
- SQL seeds: `sql/investment-extension.sql` (base) + `sql/investment-international.sql` (70 new instruments)

## Leaderboard System (Latest)

### Public Leaderboard (`/leaderboard`)
- 100 deterministic mock traders generated in `src/lib/api/leaderboard.js` with realistic names, portfolio values, profits, win rates, trade counts, avatars, badges, and country flags
- Top 3 displayed as a visual podium with gold/silver/bronze medals; crown icon on 1st place
- Time tabs: All Time / 30 Days / 7 Days (scales profit/portfolio values proportionally)
- Full sortable table for ranks 4–100: sort by rank, portfolio, profit, win rate, trades
- Search bar to filter by name or username
- Injected entries are visually marked as "★ Featured"
- Accessible via "Community → Leaderboard" in the main sidebar nav

### Admin Leaderboard Control (`/admin/leaderboard`)
- Full table of all 100 board entries with live override indicators (pinned 📌, edited ✏️, injected ➕, hidden)
- **Pin to position**: enter any rank 1–100 and pin an entry there; unpin any time
- **Edit stats**: full modal to change display name, username, avatar, badge, country, portfolio value, total profit, win rate, trades
- **Hide/show**: toggle any entry off the public board
- **Inject entry**: full modal to add a new admin-crafted entry to the board
- **Remove injected**: delete any admin-created entry
- **Reset all**: clear all overrides in one click (with confirmation)
- Overrides stored in `platform_settings` table under key `leaderboard_overrides` as JSON
- Stats row shows counts: Pinned / Hidden / Edited / Injected
- Changes are live instantly on the public leaderboard

## Assets System (Latest)

### Assets List Page (`/assets`)
- **Route**: `/assets` — redesigned list page with two tabs: Crypto Assets (24 coins) + Fiat Currencies (24 currencies)
- Shows live price + 24h change for crypto, user balances highlighted in primary color
- Search bar filters both lists simultaneously
- Clicking any asset navigates to `/assets/:type/:id` (e.g. `/assets/crypto/BTC` or `/assets/fiat/USD`)
- Summary cards show total fiat balance (USD) and total crypto value in USD

### Asset Detail Page (`/assets/:type/:id`)
- **Route**: `/assets/crypto/:symbol` or `/assets/fiat/:currency`
- Shows asset header (name, icon, live price + 24h change for crypto, balance)
- **4 action buttons**: Deposit, Withdraw, Transfer, Convert — each opens its own slide-up modal with multi-step flow

#### Deposit Flow (Crypto)
- **Step 1**: Shows master wallet address with copy button, network warning, and instructions
- **Step 2**: Upload proof (amount, TX hash, screenshot/PDF) → calls `submitCryptoDeposit`
- If no wallet address configured yet → shows "Coming soon" message

#### Deposit Flow (Fiat)
- **Step 1**: Enter amount + choose method (Bank Transfer, Wire Transfer, Debit Card)
- **Step 2**: Shows bank details with reference code (copy buttons on each field)
- **Step 3**: Optional payment proof upload → calls `createTransaction` with type=DEPOSIT

#### Withdraw Flow
- **Step 1**: Enter amount + select method (bank/wire/paypal for fiat; crypto wallet for crypto)
- **Step 2**: Fill destination details (account number, address, etc.)
- **Step 3**: Review summary + confirm → calls `createTransaction` with type=WITHDRAWAL

#### Transfer Flow
- **Step 1**: Enter amount + recipient email/ID + optional note
- **Step 2**: Review + confirm → calls `createTransaction`

#### Convert Flow
- **Step 1**: Select from/to asset pair, enter amount, see live exchange rate preview
- **Step 2**: Review (rate, fee 0.5%) + confirm → calls `createTransaction`

### Crypto Deposit History
- Shown inline on the Asset Detail page (not the action sheet) as a second tab
- Filtered to show only deposits for the specific asset

### Supported Crypto Assets (24)
BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, DOT, MATIC, LINK, LTC, ATOM, UNI, USDT, USDC, TRX, TON, NEAR, BCH, SHIB, APT, ARB, OP

### Supported Fiat Currencies (24)
USD, EUR, GBP, AUD, CAD, CHF, JPY, SGD, AED, INR, BRL, MXN, KRW, HKD, NOK, SEK, DKK, NZD, ZAR, NGN, TRY, CNY, THB, MYR

### New Files
- `src/pages/Assets.jsx` — rewritten as list page; exports `CRYPTO_ASSETS` and `FIAT_CURRENCIES` arrays used by AssetDetail
- `src/pages/AssetDetail.jsx` — new detail page with all 4 action flows inline

---

## Crypto Deposit System (Legacy Docs)

### Assets Page (Old) (`/assets`)
- **Route**: `/assets` — full-page, protected route inside the Layout
- **Navigation**: Sidebar "Assets" item under the Portfolio section
- **Features**:
  - Displays all active master wallet addresses (BTC, ETH, SOL, BNB, USDT, USDC)
  - Each asset card shows the deposit address with a one-click copy button
  - User crypto balances (from `user_balances` table) shown per asset
  - "Submit Deposit Proof" flow: enter amount, optional TX hash, upload proof file (image/PDF)
  - Proof files uploaded to Supabase Storage bucket `deposit-proofs` under `<user_id>/` path
  - Deposit History tab: shows all deposits with status badges, admin notes, proof viewer
  - Status filter: all / pending / under_review / completed / rejected

### Admin Deposits Page (`/admin/deposits`)
- **Route**: `/admin/deposits` — inside AdminLayout, linked in admin sidebar
- **Features**:
  - Lists all deposits across all users with search (email, asset, tx hash)
  - Status filter tabs with pending count badge
  - Summary stats (total, pending, under review, completed)
  - Detail modal per deposit: view user info, tx hash, proof file (signed URL), admin note input
  - Mark Under Review → Approve & Credit Balance → Reject (with reason) actions
  - Approval calls `fn_approve_deposit` RPC (atomic, double-credit protected)
  - Rejection calls `fn_reject_deposit` RPC
  - All actions logged to `admin_audit_log` via `logAdminAction`

### SQL Migration (`sql/wallet-deposit-migration.sql`) ← USE THIS ONE
Run this comprehensive all-in-one script in the Supabase SQL Editor:
- `master_wallets` table — global wallet addresses per asset/network (seeded with 6 coins)
- `user_balances` table — per-user, per-asset crypto balances
- `deposits` table — manual deposit submissions with status enum
- `admin_notifications` table — broadcast/targeted admin notifications
- `support_tickets` table — user support ticket system
- RLS policies for all five tables
- Storage bucket instructions for `deposit-proofs` (manual step in Supabase Dashboard)
- `fn_approve_deposit(deposit_id, admin_note)` — atomic approval + balance credit
- `fn_reject_deposit(deposit_id, admin_note)` — rejection without balance change
- `fn_set_deposit_under_review(deposit_id)` — marks pending → under_review
- `fn_admin_adjust_crypto_balance(user_id, asset, operation, amount)` — add/deduct/set/delete
- `fn_admin_adjust_balance(portfolio_id, operation, amount)` — cash balance management
- `fn_admin_lock_balance(portfolio_id, locked, reason)` — lock/unlock user balance
- `fn_admin_update_withdrawal(transaction_id, status, message)` — withdrawal approval

### API Layer (`src/lib/api/cryptoDeposits.js`)
- `getMasterWallets()` — fetch active wallet addresses
- `getUserCryptoBalances(userId)` — fetch user's per-asset balances
- `submitCryptoDeposit({userId, asset, network, amount, txHash, proofFile})` — upload proof + insert deposit
- `getUserDeposits(userId)` — user's deposit history
- `adminGetAllDeposits({status, limit})` — admin: all deposits with user info
- `adminApproveDeposit(id, note)` — calls fn_approve_deposit RPC
- `adminRejectDeposit(id, note)` — calls fn_reject_deposit RPC
- `adminSetUnderReview(id)` — calls fn_set_deposit_under_review RPC
- `getDepositProofUrl(path)` — generate signed URL for proof file

---

## Withdrawal System

### Professional Withdrawal Page (`/withdrawal`)
- **Route**: `/withdrawal` — full-page, protected route inside the Layout
- **Navigation**: Sidebar "Withdraw" button redirects to this page (via WithdrawalSidebar gateway), can also pre-fill `?method=bank_transfer` etc. via query param
- **KYC Gate**: Fetches `kyc_submissions` table; blocks withdrawal if not `approved`, shows CTA to `/settings/kyc`
- **Balance Check**: Reads `cashBalance` from PortfolioContext; validates that USD equivalent of chosen amount ≤ balance
- **Multi-Currency Support (Latest)**:
  - **Fiat tab**: USD, EUR, GBP, AUD, CAD, CHF, JPY, SGD, AED, INR — live exchange rates from `frankfurter.app` (refreshed every 5 min)
  - **Crypto tab**: BTC, ETH, USDT, USDC, BNB, SOL, XRP, ADA, DOGE, AVAX — live prices from `cryptoList` in LivePricesContext (USDT/USDC hardcoded at $1)
  - User enters amount in the selected currency; USD equivalent is computed in real-time and deducted from balance
  - Summary shows: currency amount sent, USD equivalent, 2% fee in USD, currency amount received
  - Selecting a crypto currency auto-locks method to "Crypto Wallet" and pre-fills the coin field
  - withdrawal_details JSONB includes: `withdrawCurrency`, `withdrawCurrencyType`, `withdrawAmount`, `withdrawUsdEquivalent`
- **Country-aware Bank Fields**: Reads `user.user_metadata.country`; shows localized bank fields:
  - US: Routing Number + Account Number + Account Type
  - UK: Sort Code + Account Number
  - Australia/NZ: BSB + Account Number
  - Canada: Transit + Institution + Account Number
  - EU countries: IBAN + BIC/SWIFT
  - International/default: IBAN + SWIFT/BIC
- **Method-specific forms**: Bank Transfer, Crypto Wallet (coin + network + address), PayPal (email + confirm + name), Wire Transfer (full international fields)
- **Submit**: Only enabled when KYC approved + valid amount + method details filled + rate available
- **Submission**: Creates a `WITHDRAWAL` transaction with `status: 'pending'`, `total_amount` = USD equivalent, and full `withdrawal_details` JSONB
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

### Admin Console (Built)
Full admin panel at `/admin` with login at `/admin/login`.

**To enable admin access:**
1. Run `database.sql`, `withdrawal-migration.sql`, `sql/admin-balance-management.sql` in Supabase
2. `UPDATE public.users SET is_admin = true WHERE email = 'admin@yourdomain.com';`

**Admin panel pages:**
- `/admin` — Dashboard with 4 stat cards + 4 recharts time-series charts (signups/day, volume/day, revenue/day, withdrawal trends)
- `/admin/withdrawals` — Approve/reject withdrawals, with rejection reason form
- `/admin/kyc` — Review KYC submissions with document viewer, approve/reject
- `/admin/users` — User management: cash balance adjust/set/deduct, balance lock/unlock, admin flag toggle, suspend/reactivate
- `/admin/settings` — Fee & Limit Management: trading fee %, deposit min, withdrawal min/max/daily limit (persisted in `platform_settings` table)
- `/admin/audit-log` — Audit Log: chronological log of every admin action with admin name, email, action type, target, and details; searchable + filterable + paginated

**New SQL migration (`sql/admin-features-migration.sql`):**
- `platform_settings` table — key/value store for fee and limit configuration
- `admin_audit_log` table — append-only log of every admin action with full details
- RLS policies for both tables (admin-only read/write)
- Default seeds: trading_fee_percent=0.25, deposit_minimum_usd=10, withdrawal_minimum/maximum/daily limits

**Audit logging:** Every admin action in `src/lib/api/admin.js` now calls `logAdminAction()` automatically:
- withdrawal_approved / withdrawal_rejected (adminUpdateWithdrawal)
- kyc_approved / kyc_rejected (adminReviewKyc)
- balance_adjusted (adminAdjustBalance)
- balance_locked / balance_unlocked (adminLockBalance)
- user_status_changed (setUserStatus)
- user_promoted_to_admin / user_demoted_from_admin (setUserAdminFlag)
- setting_updated (updatePlatformSetting)

**RPCs required (from SQL migration files):**
- `fn_admin_update_withdrawal(p_transaction_id, p_status, p_admin_message)`
- `fn_admin_review_kyc(p_submission_id, p_status, p_reviewer_notes)`
- `fn_admin_adjust_balance(p_portfolio_id, p_operation, p_amount, p_note)`
- `fn_admin_lock_balance(p_portfolio_id, p_locked, p_reason)`

**Key technical note:** The Supabase queries in `src/lib/api/admin.js` use explicit FK column hints (e.g. `portfolios!portfolio_id`, `users!user_id`) to avoid "ambiguous relationship" errors when tables have multiple FK paths.

### Mobile Responsiveness (Admin + User)
All admin pages (AdminLayout, AdminDashboard, AdminUsers, AdminKyc, AdminWithdrawals) are fully responsive:
- AdminLayout: hamburger menu with overlay sidebar for mobile; static sidebar for lg+
- AdminDashboard: responsive stat cards grid (1→2→4 columns)
- AdminUsers/AdminKyc/AdminWithdrawals: mobile card view (`lg:hidden`) + desktop table (`hidden lg:block`)
- All modals are bottom-sheets on mobile (`items-end` + `rounded-t-2xl`)

### KYC Draft Saving
Per-step progress is saved to `localStorage` under key `kyc_draft_${userId}`:
- `saveKycDraft(userId, draft)` / `loadKycDraft(userId)` / `clearKycDraft(userId)` in `src/lib/api/kyc.js`
- Draft stores: `step`, `personal`, `docInfo`, `savedAt`
- File uploads (idFront, idBack, selfie, address) are NOT saved (File objects can't be serialized)
- Draft banner shown on page load with "Continue" (restores step + data) and "Start over" (clears draft)
- "Save & Exit" button available on steps 1+
- Draft auto-cleared on successful submission

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

## Admin Panel (April 2026)

### Separate Admin Login (`/admin/login`)
- Completely isolated from the regular user login at `/login`
- Dark split-panel design: left brand panel lists admin capabilities, right panel has the form
- After sign-in, checks `is_admin` from the `users` table; if not admin, signs the user out immediately with an error toast
- If already authenticated as an admin, redirects directly to `/admin`
- `AdminRoute` now redirects unauthenticated users to `/admin/login` (not `/login`)
- Admin sign-out also returns to `/admin/login`

### Balance Management (`/admin/users`)
- Users table now includes a **Cash Balance** column with live lock indicator
- **Manage Balance** button opens a modal for each user with:
  - Current balance + holdings overview + lock status
  - Three operation modes: **Add Funds**, **Deduct Funds**, **Set Balance**
  - Live preview of resulting balance (red warning if it goes negative)
  - Required reason/note field — all operations are logged to the `transactions` table
  - **Lock / Unlock Balance** section: locking prevents user transactions, stores reason + timestamp
- New SQL migration: `sql/admin-balance-management.sql`
  - `balance_locked`, `balance_locked_reason`, `balance_locked_at`, `balance_locked_by` columns on `portfolios`
  - `fn_admin_adjust_balance(portfolio_id, operation, amount, note)` — SECURITY DEFINER RPC
  - `fn_admin_lock_balance(portfolio_id, locked, reason)` — SECURITY DEFINER RPC
  - Admin RLS policies for `portfolios` UPDATE and `transactions` INSERT

## Last Updated
April 6, 2026
  # next major priority
  - implementation of real time purchase of crypto using external api
  - implementation of live chat functionality between user and admin
  - 