import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const FeatureFlagsContext = createContext({ flags: {}, isFlagOn: () => true, refresh: () => {} });

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState({});

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.from('feature_flags').select('key, enabled');
      const map = {};
      (data || []).forEach((f) => { map[f.key] = f.enabled; });
      setFlags(map);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const isFlagOn = useCallback(
    (key, defaultValue = true) => (key in flags ? flags[key] : defaultValue),
    [flags]
  );

  const isMaintenance = !!flags.maintenance_mode;

  return (
    <FeatureFlagsContext.Provider value={{ flags, isFlagOn, isMaintenance, refresh }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
