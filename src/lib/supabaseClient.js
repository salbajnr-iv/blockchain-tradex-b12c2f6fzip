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

// Use sessionStorage so the auth token is wiped automatically when the
// browser (or last tab) is closed — forcing re-authentication next launch.
// Persists across in-tab reloads but not across browser restarts.
const browserStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      storage: browserStorage,
      storageKey: 'sb-blocktrade-auth',
      persistSession: true,        // persist within the session
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// One-time migration: clear any legacy localStorage Supabase tokens so
// returning users with stale persistent sessions are forced to re-authenticate.
if (typeof window !== 'undefined') {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('sb-') || k.includes('supabase.auth'))
      .forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
