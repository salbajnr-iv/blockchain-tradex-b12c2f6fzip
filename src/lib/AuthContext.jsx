import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { captureFingerprint } from '@/lib/fingerprint';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const fetchAvatarUrl = useCallback(async (currentUser) => {
    const path = currentUser?.user_metadata?.avatar_path;
    if (!path) { setAvatarUrl(null); return; }
    try {
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);
      else setAvatarUrl(null);
    } catch {
      setAvatarUrl(null);
    }
  }, []);

  useEffect(() => {
    const checkEnforcement = async (sess) => {
      if (!sess?.user?.id) return;
      const { data } = await supabase
        .from('users')
        .select('force_logout_at, status')
        .eq('id', sess.user.id)
        .single();
      if (!data) return;
      const sessionStartMs = new Date(sess.user?.last_sign_in_at || sess.expires_at * 1000 - 3600 * 1000).getTime();
      const forceLogoutMs = data.force_logout_at ? new Date(data.force_logout_at).getTime() : 0;
      if (forceLogoutMs && forceLogoutMs > sessionStartMs) {
        await supabase.auth.signOut();
      } else if (data.status === 'suspended') {
        await supabase.auth.signOut();
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchAvatarUrl(session?.user ?? null);
      setIsLoadingAuth(false);
      if (session?.user?.id) {
        captureFingerprint(session.user.id);
        checkEnforcement(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchAvatarUrl(session?.user ?? null);
      setIsLoadingAuth(false);
      if (session?.user?.id) {
        captureFingerprint(session.user.id);
        checkEnforcement(session);
      }
    });

    // Periodic enforcement check (every 60s) so live users get kicked out
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) checkEnforcement(session);
    }, 60_000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchAvatarUrl]);

  const refreshAvatar = useCallback(() => {
    supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
      setUser(freshUser);
      fetchAvatarUrl(freshUser);
    }).catch(() => {});
  }, [fetchAvatarUrl]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, fullName, extra = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: extra.phone || null,
          country: extra.country || null,
          date_of_birth: extra.dateOfBirth || null,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const signInWithOAuth = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoadingAuth,
      isAuthenticated: !!session,
      avatarUrl,
      refreshAvatar,
      signIn,
      signUp,
      signOut,
      resetPassword,
      signInWithOAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
