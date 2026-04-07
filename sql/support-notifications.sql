-- ============================================================
-- BlockTrade: Support tickets + Admin notifications
-- Run this in your Supabase SQL editor
-- ============================================================

-- ── Support Tickets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  user_name       TEXT,
  subject         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  priority        TEXT NOT NULL DEFAULT 'normal',
  status          TEXT NOT NULL DEFAULT 'open',
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  admin_reply     TEXT,
  replied_at      TIMESTAMPTZ,
  replied_by      UUID REFERENCES auth.users(id)
);

-- ── Admin Notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'announcement',
  icon            TEXT DEFAULT '📢',
  target_type     TEXT NOT NULL DEFAULT 'all',        -- 'all' | 'individual'
  target_user_ids UUID[] DEFAULT NULL,                -- NULL = all users
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Support tickets: users manage their own
DROP POLICY IF EXISTS "Users manage own tickets" ON public.support_tickets;
CREATE POLICY "Users manage own tickets" ON public.support_tickets
  FOR ALL USING (user_id = auth.uid());

-- Support tickets: admins manage all
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins manage all tickets" ON public.support_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin notifications: admins can insert/update/delete
DROP POLICY IF EXISTS "Admins manage notifications" ON public.admin_notifications;
CREATE POLICY "Admins manage notifications" ON public.admin_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin notifications: users can read notifications targeted at them or everyone
DROP POLICY IF EXISTS "Users read notifications" ON public.admin_notifications;
CREATE POLICY "Users read notifications" ON public.admin_notifications
  FOR SELECT USING (
    is_active = true
    AND (
      target_type = 'all'
      OR (target_type = 'individual' AND auth.uid() = ANY(target_user_ids))
    )
  );

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- Add tables to realtime publication (if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
END $$;
