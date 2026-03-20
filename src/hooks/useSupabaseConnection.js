import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const useSupabaseConnection = () => {
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test 1: Check if Supabase client is initialized
        if (!supabase) {
          throw new Error('Supabase client not initialized')
        }

        // Test 2: Try to fetch public data (market_data table is public)
        const { data, error: fetchError } = await supabase
          .from('market_data')
          .select('symbol, current_price')
          .limit(1)

        if (fetchError) {
          throw new Error(`Database query failed: ${fetchError.message}`)
        }

        setStatus('connected')
        console.log('✅ Supabase connection successful')
      } catch (err) {
        console.error('❌ Supabase connection failed:', err.message)
        setError(err.message)
        setStatus('error')
      }
    }

    testConnection()
  }, [])

  return { status, error }
}
