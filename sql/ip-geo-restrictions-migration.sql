-- ============================================================================
-- IP / GEO RESTRICTIONS MIGRATION
-- Block specific IPs (CIDR optional) and ISO-2 country codes from sign-in.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ip_blocklist (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address  text        NOT NULL UNIQUE,
  reason      text,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.country_blocklist (
  country_code text        PRIMARY KEY,
  reason       text,
  created_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_blocklist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ip_blocklist"      ON public.ip_blocklist;
DROP POLICY IF EXISTS "Anyone can read country_blocklist" ON public.country_blocklist;
DROP POLICY IF EXISTS "Admins manage ip_blocklist"        ON public.ip_blocklist;
DROP POLICY IF EXISTS "Admins manage country_blocklist"   ON public.country_blocklist;

-- Read-side: clients need to check their own IP / country at sign-in
CREATE POLICY "Anyone can read ip_blocklist"
  ON public.ip_blocklist FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can read country_blocklist"
  ON public.country_blocklist FOR SELECT TO anon, authenticated USING (true);

-- Only admins can write
CREATE POLICY "Admins manage ip_blocklist"
  ON public.ip_blocklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins manage country_blocklist"
  ON public.country_blocklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));
