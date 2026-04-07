import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(true);
        setError('');
      }
      setCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setHasRecoverySession(true);
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthColor = ["", "bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-primary", "bg-primary"][passwordStrength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">BT</span>
            </div>
            <span className="font-bold text-foreground">Block<span className="text-primary">Trade</span></span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Invalid or expired link</h1>
              <p className="text-muted-foreground text-sm mt-2">
                This password reset link is invalid or has already expired. Please request a new one.
              </p>
            </div>
            <Link to="/forgot-password">
              <Button className="w-full bg-primary hover:bg-primary/90 h-11 text-primary-foreground">
                Request new reset link
              </Button>
            </Link>
            <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">BT</span>
          </div>
          <span className="font-bold text-foreground">Block<span className="text-primary">Trade</span></span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {done ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Password updated!</h1>
                <p className="text-muted-foreground text-sm mt-2">Your password has been changed successfully. Redirecting you to sign in…</p>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-[shrink_2.5s_linear_forwards]" style={{ animation: "width 2.5s linear forwards", width: "100%" }} />
              </div>
              <Link to="/login">
                <Button className="w-full bg-primary hover:bg-primary/90 h-11 text-primary-foreground">Go to Sign In</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
                <p className="text-muted-foreground text-sm mt-1">Choose a strong, unique password for your account.</p>
              </div>

              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3.5 py-3 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">New Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-secondary/40 border-border/60 pr-10 h-11 focus:border-primary/50"
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="flex gap-1 mt-1">
                        {[1,2,3,4,5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? strengthColor : "bg-secondary"}`} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Confirm Password</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`bg-secondary/40 border-border/60 h-11 focus:border-primary/50 ${confirmPassword && confirmPassword !== password ? "border-destructive/50" : ""}`}
                      autoComplete="new-password"
                      required
                    />
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>

                  <Button type="submit" disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 mt-1 text-primary-foreground">
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Update Password
                  </Button>

                  <Link to="/login" className="flex items-center justify-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-1">
                    Back to Sign In
                  </Link>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
