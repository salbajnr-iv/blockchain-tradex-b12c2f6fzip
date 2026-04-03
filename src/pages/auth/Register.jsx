import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Eye, EyeOff, CheckCircle2, User, Mail, Lock,
  Phone, Globe, Calendar, ShieldCheck, TrendingUp, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

const COUNTRIES = [
  "Algeria","Angola","Australia","Benin","Botswana","Brazil","Burkina Faso","Burundi","Cabo Verde","Cameroon",
  "Canada","Central African Republic","Chad","Comoros","Congo (Republic)","Congo (Democratic Republic)","Denmark",
  "Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","France","Gabon","Gambia","Germany",
  "Ghana","Guinea","Guinea-Bissau","Hong Kong","India","Israel","Ivory Coast","Japan","Kenya","Lesotho",
  "Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia",
  "Netherlands","New Zealand","Niger","Nigeria","Norway","Rwanda","São Tomé and Príncipe","Senegal","Seychelles",
  "Sierra Leone","Singapore","Somalia","South Africa","South Korea","South Sudan","Spain","Sudan","Sweden",
  "Switzerland","Tanzania","Togo","Tunisia","Uganda","United Arab Emirates","United Kingdom","United States",
  "Zambia","Zimbabwe",
];

const BRAND_BULLETS = [
  { icon: TrendingUp,  text: "Live prices for 100+ crypto assets" },
  { icon: ShieldCheck, text: "256-bit SSL encrypted & fully secure" },
  { icon: Zap,         text: "Instant trade execution at market price" },
];

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col w-[400px] shrink-0 bg-[#080d14] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-transparent to-emerald-900/20" />
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-emerald-500/6 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }}
      />
      <div className="relative z-10 flex flex-col h-full p-10">
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-emerald-400 font-bold text-sm">BT</span>
          </div>
          <span className="text-xl font-bold text-white">Block<span className="text-emerald-400">Trade</span></span>
        </div>

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3">Join BlockTrade Today</p>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">Start trading in minutes</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Create a free account and get access to real-time markets, portfolio tracking, and advanced analytics.
          </p>
        </div>

        <div className="space-y-5 flex-1">
          {BRAND_BULLETS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-gray-300 text-sm">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-8 border-t border-white/8">
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-4">
            <p className="text-emerald-400 font-semibold text-sm mb-1">"The cleanest crypto dashboard I've used."</p>
            <p className="text-gray-500 text-xs">— BlockTrade user, 2024</p>
          </div>
        </div>
      </div>
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
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">BT</span>
            </div>
            <span className="font-bold text-foreground">Block<span className="text-primary">Trade</span></span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Already have an account?</span>
            <Link to="/login" className="text-sm text-primary font-semibold hover:text-primary/80 transition-colors">Sign in</Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 pb-10 pt-4 overflow-y-auto">
          <div className="w-full max-w-lg">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
              <p className="text-muted-foreground text-sm mt-1">Join thousands of traders worldwide</p>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">
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
                    I agree to the <span className="text-primary font-medium hover:underline">Terms of Service</span> and{' '}
                    <span className="text-primary font-medium hover:underline">Privacy Policy</span>. I confirm I am at least 18 years old.
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
