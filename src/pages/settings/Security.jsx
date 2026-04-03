import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Shield, Lock, Key, AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, LogOut } from "lucide-react";

export default function SecuritySettings() {
  const { user, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const passwordStrength = (() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (newPassword.length >= 10) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][passwordStrength];
  const strengthColor = ["", "bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-primary", "bg-primary"][passwordStrength];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSavingPw(true);
    try {
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

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="space-y-6">
      {/* Security overview */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Security Overview</h2>
        <div className="space-y-3">
          {[
            { label: "Email Verified",   ok: !!user?.email_confirmed_at,         note: user?.email_confirmed_at ? "Verified" : "Not verified" },
            { label: "Password",         ok: true,                                note: "Set" },
            { label: "Last Sign-In",     ok: true,                                note: lastSignIn },
            { label: "2FA / MFA",        ok: false,                               note: "Not enabled (coming soon)" },
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

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Change Password</h2>
        </div>

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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Confirm New Password</label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className={`bg-secondary/50 border-border/50 pr-10 ${confirmPassword && confirmPassword !== newPassword ? "border-destructive/50" : ""}`}
            />
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={savingPw || !newPassword} className="bg-primary hover:bg-primary/90 gap-2">
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Update Password
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
            onClick={signOut}
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out All Sessions
          </Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-destructive/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5" disabled>
          Delete Account (contact support)
        </Button>
      </div>
    </div>
  );
}
