# BlockTrade — Server-Side Work Required

> Everything in this file is **server-only** work that the React/Vite client cannot do
> on its own. The companion client guards (idle timeout, email-verified check, KYC tier
> gates, whitelist enforcement, etc.) are already in place and reference this file via
> `// SERVER TODO:` comments.
>
> Last reviewed: April 24, 2026

---

## Why this file exists

The client now does the right thing for the happy-path UX:
feature flags block the UI, idle sessions sign out, withdrawals validate against the
whitelist, KYC tiers gate amounts, and admin pages can mark / freeze / revoke.

But every one of those checks runs in the browser and can be bypassed by a determined
user calling Supabase directly. **None of these are real security boundaries until
they exist at the database (RLS / RPC) or Edge Function layer.**

This file lists each gap with: required schema, the server code, the client wiring
that already exists, and acceptance criteria so any future agent can pick one item
up and ship it independently.

---

## 1. Email verification gate (server-enforced)

**Status:** Client-side check added in `src/pages/auth/Login.jsx` (signs out unconfirmed
users with a toast). Anyone calling `supabase.auth.signInWithPassword` directly still
gets a valid JWT.

**Required:**

- **Supabase Auth Settings → Email Auth** — turn on **"Confirm email"**. With this on,
  `signInWithPassword` itself returns `email_not_confirmed` instead of a session.
- **Edge Function `send-verification-email`** (optional) if you want a custom branded
  verification email instead of Supabase's default template. Triggers on `auth.users`
  insert via a database webhook.
- **RLS** — once Auth confirms emails server-side, no app code changes needed; the
  client-side guard in `Login.jsx` becomes a redundant defense-in-depth check.

**Acceptance:** Sign-up, then attempt sign-in before clicking the verification link →
Supabase returns `AuthApiError: Email not confirmed` and no session is issued.

---

## 2. TOTP / 2FA enforcement at sign-in

**Status:** Users can enroll in TOTP via `src/pages/settings/Security.jsx`
(`MfaSetupModal` → `supabase.auth.mfa.enroll`). On next sign-in, however, the client
**does not** run the MFA challenge step, so an enrolled user can still sign in with
just their password. Supabase JS does not auto-challenge.

**Required:**

- **Client (`Login.jsx`)** — after `signInWithPassword`, call
  `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If `nextLevel === 'aal2'` and
  `currentLevel === 'aal1'`, render a 6-digit-code prompt and call
  `supabase.auth.mfa.challengeAndVerify({ factorId, code })` before navigating.
- **Server (RLS)** — to make 2FA an actual security boundary, gate sensitive tables
  with `auth.jwt() ->> 'aal' = 'aal2'` instead of just `auth.uid() = user_id`. At
  minimum: `withdrawals`, `withdrawal_whitelist`, `device_fingerprints` (delete),
  `users.password` updates.
- **Edge Function `mfa-required-after-deposit-threshold`** (optional) — flip a
  `users.mfa_required = true` row when cumulative deposits cross e.g. $10k.

**Acceptance:** A user with a verified TOTP factor signing in is forced through the
6-digit code prompt; calling Supabase REST without an `aal2` JWT and trying to
`POST /rest/v1/withdrawals` returns 403.

---

## 3. IP / geo recheck on every authenticated request

**Status:** `src/lib/api/platform.js → checkSignInRestrictions()` runs only at sign-in.
Existing sessions from a now-blocked IP/country keep working until the JWT expires
(default: 1 hour).

**Required:**

- **Edge Function `enforce-geo-block`** — invoked from a Postgres `BEFORE INSERT`
  trigger on `withdrawals`, `trades`, and any other sensitive table. Reads the
  caller's IP from the request headers (Edge Function `req.headers.get('x-real-ip')`),
  looks it up against `ip_blocklist` and `country_blocklist`, raises
  `RAISE EXCEPTION 'geo_blocked'` if matched.
- **Postgres trigger** wiring:
  ```sql
  create or replace function public.fn_geo_gate() returns trigger
    language plpgsql security definer as $$
  declare
    blocked boolean;
  begin
    select net.http_post(
      url := current_setting('app.geo_edge_url'),
      headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.geo_edge_key'))
    ) into blocked;
    if blocked then raise exception 'geo_blocked'; end if;
    return new;
  end $$;
  create trigger trg_withdrawals_geo before insert on withdrawals
    for each row execute function public.fn_geo_gate();
  ```
- **Cron** — pg_cron job every 60s that revokes JWTs for users whose last-known IP is
  now in `ip_blocklist`. Use `auth.users.banned_until = now() + interval '1 day'`.

**Acceptance:** Add the user's current IP to `ip_blocklist` while they have an open
session → next attempt to insert into `withdrawals` returns `geo_blocked`.

---

## 4. Scoped impersonation (read-only "view as user")

**Status:** `src/pages/admin/AdminUsers.jsx` logs `admin_impersonation_started` to the
audit log and shows `ImpersonationBanner`, but it doesn't actually swap the JWT —
admins still see their own admin views. There is no real read-only mode.

**Required:**

- **Edge Function `mint-impersonation-jwt`** — `POST { target_user_id }`. Verifies
  caller `is_admin = true`, then signs a JWT with custom claims:
  ```json
  {
    "sub": "<target_user_id>",
    "role": "authenticated",
    "app_metadata": { "impersonating": true, "actor_id": "<admin_id>" },
    "exp": now + 600
  }
  ```
  Use `service_role_key` to sign. TTL **must** be short (≤10 minutes).
- **RLS guards** — every write policy needs
  `((auth.jwt() -> 'app_metadata' ->> 'impersonating')::boolean is not true)`
  appended so impersonated sessions are read-only at the DB level.
  Apply to: `trades`, `withdrawals`, `transactions`, `holdings`, `withdrawal_whitelist`,
  `users` updates, `device_fingerprints` deletes.
- **Audit log** — Edge Function logs the mint with both `admin_id` and
  `target_user_id`. Every write that the impersonated session attempts and is denied
  should also be logged via a Postgres exception handler.
- **Client** — store impersonation JWT in `sessionStorage` under a *different* key
  than the normal session, swap into `supabase.auth.setSession()`, and on banner
  "End impersonation" click, restore the saved admin session.

**Acceptance:** Admin clicks "Impersonate" → routed to `/` with the target user's
data → any attempt to POST a trade returns 403 → "End impersonation" restores the
admin session without re-login.

---

## 5. Deposit chain-confirmation tracking

**Status:** Crypto deposit addresses are admin-managed in `platform_settings`. There
is no on-chain poller, so deposits are credited only when an admin manually approves.

**Required:**

- **Schema** — new table:
  ```sql
  create table public.deposit_watches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    asset text not null,                 -- 'BTC' | 'ETH' | 'USDT-TRC20' …
    address text not null,
    expected_amount numeric,             -- nullable; if set, only credit exact match ±tolerance
    tx_hash text,                        -- filled in once detected
    confirmations int default 0,
    required_confirmations int not null, -- 3 for BTC, 12 for ETH, 1 for L2s
    status text not null default 'pending',  -- pending | seen | confirmed | credited | expired
    created_at timestamptz default now(),
    expires_at timestamptz default now() + interval '24 hours',
    credited_at timestamptz
  );
  create index on deposit_watches (status, address);
  ```
- **Edge Function `poll-deposits`** invoked by pg_cron every 60s. For each `pending`
  / `seen` row: query the chain RPC (Bitcoin Core REST, Etherscan, TronGrid, etc.)
  for incoming txs to `address`. Update `tx_hash`, `confirmations`. When
  `confirmations >= required_confirmations`, atomically mark `credited` and call
  `fn_admin_adjust_balance(portfolio_id, 'add', expected_amount, 'on-chain deposit')`.
- **Secrets** — `BITCOIN_RPC_URL`, `ETHERSCAN_API_KEY`, `TRONGRID_API_KEY`.
- **Client** — `src/pages/Deposit.jsx` should `insert` into `deposit_watches` when
  the user clicks "I've sent it" so the poller knows what to look for. Then poll
  `select status, confirmations from deposit_watches where id = ?` every 10s and
  show progress (e.g. "2 / 3 confirmations").

**Acceptance:** User generates a deposit, sends actual on-chain tx → within 1
confirmation cycle of the chain, balance updates without admin intervention.

---

## 6. Mirror every client guard at the DB level

The client now blocks these actions; the database does **not**. Each guard below
needs a server-side sibling.

### 6a. Maintenance mode + feature flags

**Client guard:** `src/hooks/useActionGuard.js` checks `feature_flags.maintenance_mode`,
`trading_enabled`, `withdrawals_enabled`, `deposits_enabled`, `registrations_enabled`.

**Server work:** Add a `BEFORE INSERT` trigger on `trades`, `withdrawals`,
`transactions`, and `users`:
```sql
create or replace function public.fn_check_feature_flag(p_flag text) returns void
  language plpgsql as $$
declare enabled boolean;
begin
  select ff.enabled into enabled from feature_flags ff where ff.key = p_flag;
  if coalesce(enabled, true) = false then
    raise exception 'feature_disabled: %', p_flag using errcode = 'P0001';
  end if;
  if exists(select 1 from feature_flags where key='maintenance_mode' and enabled=true) then
    raise exception 'maintenance_mode' using errcode = 'P0001';
  end if;
end $$;

create trigger trg_trades_flag before insert on trades
  for each row execute function public.fn_check_feature_flag('trading_enabled');
-- repeat for withdrawals_enabled, deposits_enabled
```

### 6b. Withdrawal whitelist

**Client guard:** `src/pages/Withdrawal.jsx` lines ~683–693 reject addresses not in
the whitelist when `users.withdrawal_whitelist_only = true`.

**Server work:** RLS policy on `withdrawals`:
```sql
create policy "withdrawals_whitelist" on withdrawals for insert
with check (
  not (select withdrawal_whitelist_only from users where id = auth.uid())
  or destination_address in (
    select address from withdrawal_whitelist where user_id = auth.uid()
  )
);
```

### 6c. KYC tier limits

**Client guard:** `src/lib/kyc_tiers.js → checkWithdrawalAmount(tier, usd)` is called
in `Withdrawal.jsx` and `Trade.jsx`.

**Server work:** Move the tier table into Postgres (`kyc_tiers` table with
`tier int primary key, max_withdrawal_usd_daily numeric, max_trade_usd_daily numeric,
can_trade_derivatives boolean`) and add a `BEFORE INSERT` trigger that aggregates
the past 24h of withdrawals/trades for the user and rejects if over limit:
```sql
create function public.fn_check_withdrawal_limit() returns trigger language plpgsql as $$
declare
  daily_total numeric;
  user_tier int;
  tier_limit numeric;
begin
  select kyc_tier into user_tier from users where id = new.user_id;
  select max_withdrawal_usd_daily into tier_limit from kyc_tiers where tier = user_tier;
  select coalesce(sum(usd_amount),0) into daily_total
    from withdrawals
    where user_id = new.user_id
      and created_at > now() - interval '24 hours'
      and status in ('pending','approved','completed');
  if daily_total + new.usd_amount > tier_limit then
    raise exception 'kyc_tier_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_withdrawals_tier_limit before insert on withdrawals
  for each row execute function public.fn_check_withdrawal_limit();
```

### 6d. Custom fee bps

**Client guard:** `src/pages/Trade.jsx` uses `users.custom_fee_bps` (or global default)
to compute the fee shown to the user.

**Server work:** Move fee calculation entirely into the trade RPC:
```sql
create or replace function public.fn_create_trade(
  p_portfolio_id uuid, p_symbol text, p_side text, p_qty numeric, p_price numeric
) returns uuid language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
  fee_bps int;
  fee numeric;
  trade_id uuid;
begin
  select coalesce(custom_fee_bps, (select (value->>'default')::int from platform_settings where key='trade_fee_bps'))
    into fee_bps from users where id = uid;
  fee := (p_qty * p_price) * fee_bps / 10000.0;
  insert into trades (...) values (...) returning id into trade_id;
  return trade_id;
end $$;
```
Then revoke INSERT on `trades` from authenticated and force the client to call
`supabase.rpc('fn_create_trade', {...})`.

### 6e. Force password reset / KYC renewal

**Client guard:** `src/components/AccountStateGate.jsx` redirects to `/reset-password`
or `/kyc` when `force_password_reset` / `force_kyc_renewal` is set.

**Server work:** Add an RLS policy that blocks every write except the password update
RPC when `force_password_reset = true`:
```sql
create policy "block_writes_when_password_reset_required" on trades for insert
with check (not coalesce((select force_password_reset from users where id = auth.uid()), false));
-- repeat for withdrawals, withdrawal_whitelist, etc.
```

---

## 7. Idle timeout — server side

**Client guard:** `src/hooks/useIdleTimeout.js` signs out after 15 min idle.

**Server work:** Reduce the JWT TTL so even a kept-alive token expires within the
idle window.
- Supabase Dashboard → Auth → JWT Expiry → set to **900** (15 min).
- Refresh token expiry can stay at 7 days; the client's idle hook plus `signOut`
  handles the active-session case.

**Acceptance:** Open dev tools, paste an old JWT into a `fetch` to `/rest/v1/users` →
returns 401 within 15 min of issuance regardless of client behavior.

---

## 8. Multi-account workflow — bulk freeze RLS

**Client guard:** `src/pages/admin/AdminMultiAccount.jsx` calls
`setUserStatus(user_id, 'suspended')` in a loop. Relies on
`users.update where is_admin` RLS already being permissive.

**Server work:** Add an explicit admin RLS policy and an audit hook so a freeze can
**never** be issued by a non-admin:
```sql
create policy "admins_can_set_status" on users for update
using ((select is_admin from users where id = auth.uid()) = true)
with check ((select is_admin from users where id = auth.uid()) = true);

create function public.fn_freeze_audit() returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into admin_audit_log(admin_id, action, target_type, target_id, details)
    values (auth.uid(), 'user_status_changed_db', 'user', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger trg_users_status_audit after update on users
  for each row execute function public.fn_freeze_audit();
```

---

## 9. Device fingerprints — RLS for self-service revoke

**Client guard:** `src/pages/settings/Security.jsx` "My Devices" panel reads/deletes
the user's own `device_fingerprints` rows.

**Server work:** Add the two policies (already documented in `replit.md`):
```sql
create policy "users_read_own_devices" on device_fingerprints for select
  using (auth.uid() = user_id);
create policy "users_delete_own_devices" on device_fingerprints for delete
  using (auth.uid() = user_id);
```
**Without these the My Devices panel shows empty for normal users.**

---

## 10. Background engines that currently die when the tab closes

`useAlertEngine`, `usePendingOrderEngine`, `useRecurringOrderEngine` (mounted in
`Layout.jsx`) all run only while a tab is open. For real reliability:

**Required:**

- **Edge Function `engine-tick`** invoked by pg_cron every 30s.
- For **price alerts**: scan `alerts where active and last_checked_at < now()-30s`,
  fetch current prices via CoinGecko, fire `notifications.insert` rows when
  conditions are met.
- For **limit orders**: scan `orders where status='open'`, check current price vs.
  trigger price, call `fn_create_trade` when crossed.
- For **DCA**: scan `recurring_orders where next_run_at <= now()`, call
  `fn_create_trade`, update `next_run_at`.

**Acceptance:** Close all tabs, wait, set a price alert for a coin currently above
target → alert fires (and `notifications` row appears) without anyone having the app
open.

---

## 11. Rate limiting on admin actions

**Required:** Add `admin_action_rate_limit` table:
```sql
create table public.admin_action_rate_limit (
  admin_id uuid not null,
  action text not null,
  ts timestamptz default now()
);
create index on admin_action_rate_limit (admin_id, action, ts);
```
Trigger `BEFORE INSERT` on `admin_audit_log` raises if more than N of the same action
in M seconds (e.g. >20 freezes/min).

---

## 12. Webhook signing for external callbacks

If you add Stripe / on-chain webhooks later, every webhook handler Edge Function must:
1. Verify HMAC signature against a `WEBHOOK_SECRET` env var.
2. Reject requests with timestamp drift > 5 min.
3. Use idempotency keys keyed on the provider's event ID to avoid double-credit.

---

## Cross-cutting reminders

- **`SUPABASE_SERVICE_ROLE_KEY` must never be in client code.** Only Edge Functions
  and migrations should see it.
- **`net.http_post` in triggers requires the `pg_net` extension.** Enable in the
  Supabase dashboard if you implement #3 (geo gate) or #6a (feature flag triggers).
- **`pg_cron`** is needed for #5 (deposit poller), #7 (token revocation), #10
  (engine ticker). Enable in Database → Extensions.
- **Reset-password redirect URL** — `Security.jsx` and admin force-reset use
  `${window.location.origin}/reset-password`. Add every preview / production origin
  to **Auth → URL Configuration → Redirect URLs**, or the email link 404s.

---

## Suggested order

1. Items #1, #2 (email + 2FA) — fastest wins, mostly Auth-dashboard config.
2. Item #6 (mirror client guards) — closes the biggest hole; everything else assumes
   the DB is the source of truth.
3. Item #5 (deposit confirmations) — unlocks self-service deposits, biggest UX win.
4. Item #4 (scoped impersonation) — needed before any non-founding-team member is
   given admin access.
5. Item #10 (engines on cron) — required for production reliability.
6. Items #3, #7, #8, #9, #11, #12 — hardening once the core is solid.
