import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { User, Mail, Phone, Globe, Save, Loader2, Camera, Trash2 } from "lucide-react";

const COUNTRIES = [
  "Algeria", "Angola", "Australia", "Benin", "Botswana", "Brazil",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Comoros", "Congo (Republic)",
  "Congo (Democratic Republic)", "Denmark", "Djibouti", "Egypt",
  "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "France",
  "Gabon", "Gambia", "Germany", "Ghana", "Guinea", "Guinea-Bissau",
  "Hong Kong", "India", "Israel", "Ivory Coast", "Japan", "Kenya",
  "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali",
  "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia",
  "Netherlands", "New Zealand", "Niger", "Nigeria", "Norway",
  "Rwanda", "São Tomé and Príncipe", "Senegal", "Seychelles",
  "Sierra Leone", "Singapore", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sudan", "Sweden", "Switzerland", "Tanzania",
  "Togo", "Tunisia", "Uganda", "United Arab Emirates", "United Kingdom",
  "United States", "Zambia", "Zimbabwe",
];

export default function ProfileSettings() {
  const { user, refreshAvatar } = useAuth();
  const { portfolioId } = usePortfolio();

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [country, setCountry] = useState(user?.user_metadata?.country || "");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const userInitial = fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  useEffect(() => {
    const storedPath = user?.user_metadata?.avatar_path;
    if (!storedPath) return;
    supabase.storage
      .from("avatars")
      .createSignedUrl(storedPath, 60 * 60)
      .then(({ data }) => {
        if (data?.signedUrl) setAvatarUrl(data.signedUrl);
      })
      .catch(() => {});
  }, [user?.user_metadata?.avatar_path]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (signedData?.signedUrl) setAvatarUrl(signedData.signedUrl);

      await supabase.auth.updateUser({ data: { avatar_path: path } });

      await supabase.rpc("fn_sync_user_profile", {
        p_user_id:   user.id,
        p_full_name: fullName || null,
        p_phone:     phone || null,
        p_country:   country || null,
        p_bio:       bio || null,
      });

      toast.success("Profile picture updated");
      refreshAvatar();
    } catch (err) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    const storedPath = user?.user_metadata?.avatar_path;
    if (!storedPath) return;
    setAvatarUploading(true);
    try {
      await supabase.storage.from("avatars").remove([storedPath]);
      await supabase.auth.updateUser({ data: { avatar_path: null } });
      setAvatarUrl(null);
      refreshAvatar();
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone, country, bio },
      });
      if (error) throw error;

      await supabase.rpc("fn_sync_user_profile", {
        p_user_id:   updatedUser?.id ?? user?.id,
        p_full_name: fullName || null,
        p_phone:     phone || null,
        p_country:   country || null,
        p_bio:       bio || null,
      });

      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-border/50">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{userInitial}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-card hover:bg-primary/90 transition-colors disabled:opacity-50"
              title="Change profile picture"
            >
              {avatarUploading ? (
                <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-primary-foreground" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1">
            <p className="font-semibold text-foreground">{fullName || "—"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Member since {memberSince}</p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAvatarClick}
                disabled={avatarUploading}
                className="h-7 text-xs gap-1.5"
              >
                <Camera className="w-3 h-3" />
                {avatarUrl ? "Change Photo" : "Upload Photo"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">JPG, PNG, GIF or WebP — max 5 MB</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-card border border-border/50 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Full Name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              Email Address
            </label>
            <Input
              value={user?.email || ""}
              disabled
              className="bg-secondary/20 border-border/30 text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Phone Number
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              type="tel"
              className="bg-secondary/50 border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us a bit about yourself..."
            rows={3}
            className="w-full rounded-md border border-border/50 bg-secondary/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-colors resize-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </form>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Account Information</h2>
        <div className="space-y-3">
          {[
            { label: "User ID",       value: user?.id?.slice(0, 16) + "…" },
            { label: "Account Type",  value: "Standard Trader" },
            { label: "Member Since",  value: memberSince },
            { label: "Portfolio ID",  value: portfolioId?.slice(0, 16) + "…" || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium text-foreground font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
