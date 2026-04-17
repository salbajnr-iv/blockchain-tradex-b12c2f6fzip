import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabaseMisconfigured } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, TrendingUp, ShieldCheck, Zap, BarChart2, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';
import ThemeToggle from '@/components/ThemeToggle';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

const FEATURES = [
  { icon: TrendingUp,   title: "Real-time Markets",    desc: "Live prices for 100+ cryptocurrencies updated every 30 seconds." },
  { icon: ShieldCheck,  title: "Bank-grade Security",  desc: "256-bit SSL encryption protects every transaction you make." },
  { icon: Zap,          title: "Instant Execution",    desc: "Buy and sell at market price with zero delays." },
  { icon: BarChart2,    title: "Advanced Analytics",   desc: "Portfolio tracking, P&L analysis, and custom price alerts." },
];

function BrandPanel() {
  return (
    <div className="hidden lg:flex w-[460px] shrink-0 sticky top-0 h-screen bg-white items-center justify-center overflow-hidden">
      <img
        src="/loginpagephoto.svg"
        alt="BlockTrade"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <BrandPanel />

      <div className="flex-1 flex flex-col bg-background min-h-screen">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Mobile logo */}
          <div className="flex items-center lg:hidden">
            <img
              src="/logo.svg"
              alt="BlockTrade"
              className="h-8 w-auto invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen"
            />
          </div>
          <div className="lg:hidden" />
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-sm">
            {supabaseMisconfigured && (
              <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl p-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  <strong>Configuration missing.</strong> Supabase environment variables are not set. Sign-in and sign-up will not work until <code className="font-mono text-xs bg-amber-500/20 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono text-xs bg-amber-500/20 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> are configured.
                </p>
              </div>
            )}

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
              <p className="text-muted-foreground text-sm mt-1">Sign in to your BlockTrade account</p>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/40 border-border/60 h-11 focus:border-primary/50"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-secondary/40 border-border/60 pr-10 h-11 focus:border-primary/50"
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 mt-2 text-primary-foreground">
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Sign In
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-xs text-muted-foreground">or continue with</span>
                </div>
              </div>

              <SocialAuthButtons mode="signin" />

              <p className="text-center text-sm text-muted-foreground mt-5">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Create account
                </Link>
              </p>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              By signing in you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
