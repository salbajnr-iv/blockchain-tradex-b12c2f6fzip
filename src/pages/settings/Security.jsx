import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { toast } from '@/lib/toast';
import {
  Shield, Lock, Key, AlertTriangle, CheckCircle2, Eye, EyeOff,
  Loader2, LogOut, Smartphone, QrCode, Trash2, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Delete Account Confirmation Modal ─────────────────────────────────────────
function DeleteAccountModal({ onClose, onConfirm, loading }) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-destructive/30 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Delete Account</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          This will permanently delete all your portfolio data, holdings, trades, and transactions. <strong className="text-foreground">This cannot be undone.</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm.
        </p>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="mb-4 border-destructive/30 focus:border-destructive"
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm()}
            disabled={typed !== "DELETE" || loading}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? "Deleting…" : "Delete My Account"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── MFA / 2FA Setup Modal ─────────────────────────────────────────────────────
function MfaSetupModal({ onClose, onEnabled }) {
  const [step, setStep] = useState("qr"); // qr | verify | done
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);

  useEffect(() => {
    const enroll = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
        if (error) throw error;
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      } catch (err) {
        toast.error(err.message || "Failed to set up 2FA");
        onClose();
      } finally {
        setEnrolling(false);
      }
    };
    enroll();
  }, [onClose]);

  const handleVerify = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code from your authenticator app"); return; }
    setLoading(true);
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (error) throw error;
      setStep("done");
      toast.success("Two-factor authentication enabled!");
      onEnabled();
    } catch (err) {
      toast.error(err.message || "Invalid code — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Set Up 2FA</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {enrolling ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : step === "qr" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.).
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <div
                  className="bg-white p-3 rounded-xl"
                  dangerouslySetInnerHTML={{ __html: qrCode }}
                />
              </div>
            )}
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
              <p className="font-mono text-xs text-foreground break-all select-all">{secret}</p>
            </div>
            <Button onClick={() => setStep("verify")} className="w-full gap-2">
              I've scanned it — Next
            </Button>
          </div>
        ) : step === "verify" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to activate 2FA.
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-[0.4em] h-14"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
            />
            <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {loading ? "Verifying…" : "Activate 2FA"}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="text-foreground font-semibold">2FA is now active!</p>
            <p className="text-sm text-muted-foreground">You'll be asked for your authenticator code on every sign-in.</p>
            <Button onClick={onClose} className="w-full">Done</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SecuritySettings() {
  const { user, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loadingSignOutAll, setLoadingSignOutAll] = useState(false);

  // Check current MFA status
  useEffect(() => {
    const checkMfa = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const active = data?.all?.some((f) => f.status === "verified");
        setMfaEnabled(!!active);
      } catch {}
    };
    checkMfa();
  }, []);

  const passwordStrength = (() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6)  score++;
    if (newPassword.length >= 10) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][passwordStrength];
  const strengthColor  = ["", "bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-primary", "bg-primary"][passwordStrength];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) { toast.error("Enter your current password"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword === currentPassword) { toast.error("New password must be different from current"); return; }
    setSavingPw(true);
    try {
      // Verify current password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error("Current password is incorrect");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSavingPw(false);
    }
  };

  const handleSignOutAll = async () => {
    setLoadingSignOutAll(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Signed out of all sessions");
    } catch (err) {
      toast.error(err.message || "Failed to sign out all sessions");
    } finally {
      setLoadingSignOutAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // Delete all user data via Supabase (portfolio data is cascade-deleted)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        // Remove holdings and portfolio data (cascade deletes handles related tables)
        const { data: portfolio } = await supabase
          .from("portfolios")
          .select("id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (portfolio) {
          await supabase.from("holdings").delete().eq("portfolio_id", portfolio.id);
          await supabase.from("trades").delete().eq("portfolio_id", portfolio.id);
          await supabase.from("transactions").delete().eq("portfolio_id", portfolio.id);
          await supabase.from("portfolios").delete().eq("id", portfolio.id);
        }

        await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", currentUser.id);
      }

      toast.success("Account data removed. Signing you out…");
      setTimeout(() => signOut(), 1500);
    } catch (err) {
      toast.error(err.message || "Failed to delete account data");
      setDeletingAccount(false);
    }
  };

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <>
      <div className="space-y-6">
        {/* Security overview */}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Security Overview</h2>
          <div className="space-y-3">
            {[
              { label: "Email Verified", ok: !!user?.email_confirmed_at, note: user?.email_confirmed_at ? "Verified" : "Not verified" },
              { label: "Password",       ok: true,                        note: "Set" },
              { label: "Last Sign-In",   ok: true,                        note: lastSignIn },
              { label: "2FA / MFA",      ok: mfaEnabled,                  note: mfaEnabled ? "Enabled" : "Not enabled" },
            ].map(({ label, ok, note }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2.5">
                  {ok
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  <span className="text-sm text-foreground">{label}</span>
                </div>
                <span className={`text-xs font-medium ${ok ? "text-primary" : "text-yellow-400"}`}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2FA */}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Two-Factor Authentication</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {mfaEnabled
              ? "2FA is active. Your account requires an authenticator code on every sign-in."
              : "Add an extra layer of security. Use an authenticator app to generate one-time codes."}
          </p>
          {mfaEnabled ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Two-factor authentication is enabled</span>
            </div>
          ) : (
            <Button onClick={() => setShowMfaModal(true)} variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
              <QrCode className="w-4 h-4" />
              Enable 2FA
            </Button>
          )}
        </div>

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Change Password</h2>
          </div>

          {/* Current password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Your current password"
                className="bg-secondary/50 border-border/50 pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="bg-secondary/50 border-border/50 pr-10"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor : "bg-secondary"}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${["","text-destructive","text-orange-400","text-yellow-400","text-primary","text-primary"][passwordStrength]}`}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Confirm New Password</label>
            <Input
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className={`bg-secondary/50 border-border/50 ${confirmPassword && confirmPassword !== newPassword ? "border-destructive/50" : ""}`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savingPw || !newPassword || !currentPassword} className="bg-primary hover:bg-primary/90 gap-2">
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {savingPw ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </form>

        {/* Active sessions */}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Active Sessions</h2>
          <div className="flex items-center justify-between py-3 border border-primary/20 bg-primary/5 rounded-xl px-4">
            <div>
              <p className="text-sm font-medium text-foreground">Current Session</p>
              <p className="text-xs text-muted-foreground mt-0.5">Last active: {lastSignIn} · This browser</p>
            </div>
            <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">Active</span>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleSignOutAll}
              disabled={loadingSignOutAll}
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 gap-2"
            >
              {loadingSignOutAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {loadingSignOutAll ? "Signing out…" : "Sign Out All Sessions"}
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-card border border-destructive/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently deletes all your portfolio data, holdings, trades, and transaction history. The auth account is then flagged for removal.
          </p>
          <Button
            variant="outline"
            onClick={() => setShowDeleteModal(true)}
            className="border-destructive/40 text-destructive hover:bg-destructive/5 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete My Account
          </Button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteAccountModal
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteAccount}
            loading={deletingAccount}
          />
        )}
        {showMfaModal && (
          <MfaSetupModal
            onClose={() => setShowMfaModal(false)}
            onEnabled={() => { setMfaEnabled(true); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
