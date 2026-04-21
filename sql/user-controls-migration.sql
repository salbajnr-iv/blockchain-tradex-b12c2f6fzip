-- ============================================================================
-- USER CONTROLS MIGRATION (Phases 6-9)
-- Per-user fees & limits, withdrawal whitelist, tiered KYC, notes, tags,
-- impersonation audit, direct messages, announcement banners.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- ── Phase 6: per-user fees, limits, withdrawal whitelisting ─────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_fee_bps        integer,            -- override fee in basis points (e.g. 25 = 0.25%)
  ADD COLUMN IF NOT EXISTS daily_withdrawal_limit numeric(20, 2),    -- USD/asset value
  ADD COLUMN IF NOT EXISTS daily_trade_limit      numeric(20, 2),
  ADD COLUMN IF NOT EXISTS withdrawal_whitelist_only boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.withdrawal_whitelist (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  asset       text        NOT NULL,
  address     text        NOT NULL,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset, address)
);

ALTER TABLE public.withdrawal_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own whitelist" ON public.withdrawal_whitelist;
DROP POLICY IF EXISTS "Users manage own whitelist" ON public.withdrawal_whitelist;
DROP POLICY IF EXISTS "Admins manage all whitelist" ON public.withdrawal_whitelist;

CREATE POLICY "Users read own whitelist"
  ON public.withdrawal_whitelist FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own whitelist"
  ON public.withdrawal_whitelist FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all whitelist"
  ON public.withdrawal_whitelist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── Phase 7: tiered KYC + notes + tags ──────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kyc_tier integer NOT NULL DEFAULT 0;  -- 0=none, 1=basic, 2=advanced, 3=institutional

CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_tags (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag         text        NOT NULL,
  color       text,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage user_notes" ON public.user_notes;
DROP POLICY IF EXISTS "Admins manage user_tags"  ON public.user_tags;
DROP POLICY IF EXISTS "Users read own tags"      ON public.user_tags;

CREATE POLICY "Admins manage user_notes"
  ON public.user_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins manage user_tags"
  ON public.user_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── Phase 8: impersonation audit + direct messages ──────────────────────────
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason        text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read impersonation_sessions"  ON public.impersonation_sessions;
DROP POLICY IF EXISTS "Admins write impersonation_sessions" ON public.impersonation_sessions;

CREATE POLICY "Admins read impersonation_sessions"
  ON public.impersonation_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins write impersonation_sessions"
  ON public.impersonation_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  subject     text,
  body        text        NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipient reads admin_messages"  ON public.admin_messages;
DROP POLICY IF EXISTS "Recipient updates admin_messages" ON public.admin_messages;
DROP POLICY IF EXISTS "Admins manage admin_messages"     ON public.admin_messages;

CREATE POLICY "Recipient reads admin_messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Recipient updates admin_messages"
  ON public.admin_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage admin_messages"
  ON public.admin_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── Phase 9: announcement banners ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  body        text,
  severity    text        NOT NULL DEFAULT 'info',  -- info | warning | critical | success
  active      boolean     NOT NULL DEFAULT true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads announcements"   ON public.announcements;
DROP POLICY IF EXISTS "Admins manage announcements"  ON public.announcements;

CREATE POLICY "Anyone reads announcements"
  ON public.announcements FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));
