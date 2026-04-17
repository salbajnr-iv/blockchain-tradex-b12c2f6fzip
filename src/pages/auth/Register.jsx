import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabaseMisconfigured } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Eye, EyeOff, CheckCircle2, User, Mail, Lock,
  Phone, Globe, Calendar, ShieldCheck, TrendingUp, Zap, AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import ThemeToggle from '@/components/ThemeToggle';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';
import { COUNTRIES } from '@/lib/countries';

const BRAND_BULLETS = [
  { icon: TrendingUp,  text: "Live prices for 100+ crypto assets" },
  { icon: ShieldCheck, text: "256-bit SSL encrypted & fully secure" },
  { icon: Zap,         text: "Instant trade execution at market price" },
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

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

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
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][passwordStrength];
  const strengthColor = ["", "bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-primary", "bg-primary"][passwordStrength];
  const strengthText = ["", "text-destructive", "text-orange-400", "text-yellow-400", "text-primary", "text-primary"][passwordStrength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword || !country) {
      toast.error('Please fill in all required fields'); return;
    }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (passwordStrength < 2) { toast.error('Password is too weak — add uppercase letters, numbers, or symbols'); return; }
    if (!agreeTerms) { toast.error('Please agree to the Terms of Service'); return; }
    setLoading(true);
    try {
      const result = await signUp(email, password, fullName, { phone, country, dateOfBirth });
      if (result.session) navigate('/');
      else setRegistered(true);
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="text-muted-foreground text-sm mt-2">
              We sent a confirmation link to{' '}
              <span className="font-semibold text-foreground">{email}</span>.
              Please verify your email to activate your account.
            </p>
          </div>
          <Link to="/login">
            <Button className="w-full bg-primary hover:bg-primary/90 h-11 mt-2">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <BrandPanel />

      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center px-6 py-4">
          <div className="flex items-center lg:hidden">
            <img src="/logo.svg" alt="BlockTrade" className="h-8 w-auto invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Already have an account?</span>
            <Link to="/login" className="text-sm text-primary font-semibold hover:text-primary/80 transition-colors">Sign in</Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 pb-10 pt-4 overflow-y-auto">
          <div className="w-full max-w-lg">
            {supabaseMisconfigured && (
              <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl p-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  <strong>Configuration missing.</strong> Supabase environment variables are not set. Sign-up will not work until <code className="font-mono text-xs bg-amber-500/20 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono text-xs bg-amber-500/20 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> are configured.
                </p>
              </div>
            )}

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
              <p className="text-muted-foreground text-sm mt-1">Join thousands of traders worldwide</p>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">

              {/* Social sign-up */}
              <SocialAuthButtons mode="signup" />

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-xs text-muted-foreground">or sign up with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Personal Information */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                    Personal Information
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        Full Name <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="John Doe" value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-secondary/40 border-border/60 h-10 focus:border-primary/50" autoComplete="name" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        Date of Birth
                      </label>
                      <Input type="date" value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="bg-secondary/40 border-border/60 h-10 focus:border-primary/50"
                        max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                    Contact Information
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        Email Address <span className="text-destructive">*</span>
                      </label>
                      <Input type="email" placeholder="you@example.com" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-secondary/40 border-border/60 h-10 focus:border-primary/50" autoComplete="email" required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          Phone Number
                        </label>
                        <Input type="tel" placeholder="+1 (555) 000-0000" value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="bg-secondary/40 border-border/60 h-10 focus:border-primary/50" autoComplete="tel" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                          Country <span className="text-destructive">*</span>
                        </label>
                        <select value={country} onChange={(e) => setCountry(e.target.value)} required
                          className="w-full h-10 rounded-md border border-border/60 bg-secondary/40 px-3 text-sm text-foreground outline-none focus:border-primary/50 transition-colors">
                          <option value="">Select country</option>
                          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                    Security
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        Password <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-secondary/40 border-border/60 pr-10 h-10 focus:border-primary/50" autoComplete="new-password" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {password && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? strengthColor : "bg-secondary"}`} />
                            ))}
                          </div>
                          <p className={`text-xs font-medium ${strengthText}`}>{strengthLabel}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        Confirm Password <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat your password" value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`bg-secondary/40 border-border/60 pr-10 h-10 focus:border-primary/50 ${confirmPassword && confirmPassword !== password ? "border-destructive/50" : ""}`}
                          autoComplete="new-password" required />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center shrink-0 mt-0.5 transition-all ${agreeTerms ? "bg-primary border-primary" : "border-border/60 bg-secondary/40"}`}
                  >
                    {agreeTerms && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <label className="text-xs text-muted-foreground leading-relaxed cursor-pointer" onClick={() => setAgreeTerms(!agreeTerms)}>
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>Terms of Service</Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>.{' '}
                    I confirm I am at least 18 years old.
                  </label>
                </div>

                {/* Security badge */}
                <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-2.5">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">Your data is encrypted with 256-bit SSL. We never store payment details.</p>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 text-primary-foreground">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</> : "Create Account"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
