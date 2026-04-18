-- ============================================================
-- BlockTrade Live Support Chat System
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Conversations table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email       TEXT,
  user_name        TEXT,
  status           TEXT        DEFAULT 'open'
                               CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  unread_admin     INTEGER     DEFAULT 0,
  unread_user      INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Messages table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID        REFERENCES public.support_conversations(id)
                               ON DELETE CASCADE NOT NULL,
  sender_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role      TEXT        DEFAULT 'user'
                               CHECK (sender_role IN ('user', 'admin')),
  content          TEXT,
  file_url         TEXT,
  file_name        TEXT,
  file_type        TEXT,
  file_size        INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id
  ON public.support_conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status
  ON public.support_conversations (status);

CREATE INDEX IF NOT EXISTS idx_support_conversations_last_msg
  ON public.support_conversations (last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conv_id
  ON public.support_messages (conversation_id, created_at ASC);

-- ── 4. Enable Realtime ────────────────────────────────────────────────────────
-- (Skip if you encounter "already added" errors — that just means it's already enabled)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages      ENABLE ROW LEVEL SECURITY;

-- Conversations: user can see / create / update their own
DROP POLICY IF EXISTS "sc_user_select" ON public.support_conversations;
CREATE POLICY "sc_user_select" ON public.support_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sc_user_insert" ON public.support_conversations;
CREATE POLICY "sc_user_insert" ON public.support_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sc_user_update" ON public.support_conversations;
CREATE POLICY "sc_user_update" ON public.support_conversations
  FOR UPDATE USING (auth.uid() = user_id);

-- Conversations: admin full access
DROP POLICY IF EXISTS "sc_admin_all" ON public.support_conversations;
CREATE POLICY "sc_admin_all" ON public.support_conversations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Messages: user can see messages in their own conversations
DROP POLICY IF EXISTS "sm_user_select" ON public.support_messages;
CREATE POLICY "sm_user_select" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- Messages: user can send messages to their own conversations
DROP POLICY IF EXISTS "sm_user_insert" ON public.support_messages;
CREATE POLICY "sm_user_insert" ON public.support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.support_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- Messages: admin full access
DROP POLICY IF EXISTS "sm_admin_all" ON public.support_messages;
CREATE POLICY "sm_admin_all" ON public.support_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── 6. Storage bucket for attachments ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  TRUE,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
DROP POLICY IF EXISTS "sa_auth_upload" ON storage.objects;
CREATE POLICY "sa_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-attachments' AND
    auth.role() = 'authenticated'
  );

-- Storage RLS: anyone can view (public bucket)
DROP POLICY IF EXISTS "sa_public_read" ON storage.objects;
CREATE POLICY "sa_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'support-attachments');

-- Storage RLS: user can delete their own uploads
DROP POLICY IF EXISTS "sa_owner_delete" ON storage.objects;
CREATE POLICY "sa_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'support-attachments' AND
    auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ── Done ──────────────────────────────────────────────────────────────────────
-- After running this script:
-- 1. Go to Supabase → Storage → ensure "support-attachments" bucket is created.
-- 2. No further configuration needed — real-time and RLS are set up above.
