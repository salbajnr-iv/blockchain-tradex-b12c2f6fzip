import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email address'); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">BT</span>
          </div>
          <span className="font-bold text-foreground">Block<span className="text-primary">Trade</span></span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">

          {sent ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Check your inbox</h1>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  We sent a password reset link to{' '}
                  <span className="font-semibold text-foreground">{email}</span>.
                  It may take a minute to arrive.
                </p>
              </div>
              <div className="bg-card border border-border/60 rounded-2xl p-5 text-left space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next steps</p>
                {[
                  "Open the email from BlockTrade",
                  "Click the password reset link",
                  "Set your new password",
                ].map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <p className="text-sm text-foreground">{step}</p>
                  </div>
                ))}
              </div>
              <Link to="/login">
                <Button variant="outline" className="w-full h-11 border-border/60">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Enter your email and we'll send you a recovery link.
                </p>
              </div>

              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email address</label>
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

                  <Button type="submit" disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 text-primary-foreground">
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Send Reset Link
                  </Button>
                </form>

                <div className="flex items-center gap-2 mt-4 bg-secondary/40 rounded-xl px-3.5 py-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">The link expires in 1 hour for your security.</p>
                </div>
              </div>

              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-6">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
