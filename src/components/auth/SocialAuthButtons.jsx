import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.24.74 3.01.8.92-.19 1.8-.89 2.98-.96 1.73-.1 3.02.67 3.86 1.84-3.51 2.02-2.69 6.54.59 7.9-.57 1.53-1.29 3.05-2.44 4.3zM12.03 7.3c-.16-2.54 1.93-4.68 4.28-4.88.32 2.92-2.64 5.08-4.28 4.88z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const PROVIDERS = [
  { id: 'google',   label: 'Google',   Icon: GoogleIcon },
  { id: 'apple',    label: 'Apple',    Icon: AppleIcon  },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon },
];

export default function SocialAuthButtons({ mode = 'signin' }) {
  const { signInWithOAuth } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState(null);

  const handleOAuth = async (provider) => {
    setLoadingProvider(provider);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      toast.error(err.message || `Failed to sign in with ${provider}`);
      setLoadingProvider(null);
    }
  };

  const verbLabel = mode === 'signup' ? 'Sign up' : 'Continue';

  return (
    <div className="space-y-2.5">
      {PROVIDERS.map(({ id, label, Icon }) => {
        const isLoading = loadingProvider === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleOAuth(id)}
            disabled={!!loadingProvider}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-border transition-all text-sm font-medium text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Icon />
            )}
            {verbLabel} with {label}
          </button>
        );
      })}
    </div>
  );
}
