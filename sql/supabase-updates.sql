-- ============================================================
-- BlockTrade — Schema updates (safe to run on existing DBs)
-- ============================================================

-- user_preferences: stores per-user theme and notification settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme         text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  notif_prefs   jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_preferences_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_preferences_updated_at
      BEFORE UPDATE ON public.user_preferences
      FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
  END IF;
END $$;
