import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseMisconfigured = !supabaseUrl || !supabaseKey ||
  supabaseUrl === 'https://placeholder.supabase.co'

if (supabaseMisconfigured) {
  console.error(
    '[BlockTrade] Missing Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment.\n' +
    'On Vercel: Project Settings → Environment Variables.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)
