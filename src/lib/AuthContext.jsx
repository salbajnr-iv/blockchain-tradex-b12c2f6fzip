import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchAvatarUrl(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      fetchAvatarUrl(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
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
