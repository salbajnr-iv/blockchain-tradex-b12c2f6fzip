import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, X, Loader2, Send, Users, User, Trash2,
  Bell, CheckCheck, ChevronDown, AlertCircle, Info, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from '@/lib/toast';
import { sendAdminNotification, fetchAdminNotifications, deleteAdminNotification, fetchAllAdminUsers } from "@/lib/api/adminNotifications";

const NOTIF_TYPES = [
  { value: "announcement", label: "Announcement",  icon: Megaphone, color: "text-violet-400 bg-violet-500/10" },
  { value: "info",         label: "Info",           icon: Info,      color: "text-blue-400 bg-blue-500/10" },
  { value: "alert",        label: "Alert",          icon: AlertCircle, color: "text-orange-400 bg-orange-500/10" },
  { value: "security",     label: "Security",       icon: Shield,    color: "text-red-400 bg-red-500/10" },
  { value: "promo",        label: "Promotion",      icon: Zap,       color: "text-yellow-400 bg-yellow-500/10" },
];

const ICONS = ["📢", "🔔", "📊", "🚀", "⚠️", "🛡️", "✅", "💡", "🎉", "💰"];

function TypeBadge({ type }) {
  const cfg = NOTIF_TYPES.find((t) => t.value === type) || NOTIF_TYPES[0];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function ComposeModal({ users, onSend, onClose }) {
  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "announcement",
    icon: "📢",
    targetType: "all",
    selectedUsers: [],
  });
  const [sending, setSending] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filteredUsers = users.filter((u) =>
    userSearch.trim() === "" ||
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const toggleUser = (id) => {
    setForm((f) => ({
      ...f,
      selectedUsers: f.selectedUsers.includes(id)
        ? f.selectedUsers.filter((x) => x !== id)
        : [...f.selectedUsers, id],
    }));
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (form.targetType === "individual" && form.selectedUsers.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      await onSend({
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        icon: form.icon,
        targetType: form.targetType,
        targetUserIds: form.targetType === "individual" ? form.selectedUsers : null,
      });
      toast.success("Notification sent!");
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Send Notification</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. Platform Maintenance Notice" className="mt-1.5" />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => upd("message", e.target.value)}
              placeholder="Write your message to users..."
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Type + Icon row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={form.type}
                onChange={(e) => upd("type", e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {NOTIF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => upd("icon", ic)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${form.icon === ic ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary/60"}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Recipients</label>
            <div className="mt-1.5 flex gap-2">
              {[
                { value: "all",        label: "All users",       icon: Users },
                { value: "individual", label: "Select users",    icon: User },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => upd("targetType", opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                      form.targetType === opt.value
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User selector */}
          {form.targetType === "individual" && (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="text-xs h-8"
                />
              </div>
              <div className="border border-border/40 rounded-xl max-h-40 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                ) : filteredUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/30 cursor-pointer border-b border-border/20 last:border-0">
                    <input
                      type="checkbox"
                      checked={form.selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{u.full_name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {form.selectedUsers.length > 0 && (
                <p className="text-xs text-primary">{form.selectedUsers.length} user{form.selectedUsers.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}

          {/* Preview */}
          {form.title && (
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/30 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
              <div className="flex items-center gap-2">
                <span className="text-base">{form.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{form.title || "Title"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{form.message || "Message"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border/30 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="flex-1 gap-2">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send Notification
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifs, userList] = await Promise.all([fetchAdminNotifications(), fetchAllAdminUsers()]);
      setNotifications(notifs);
      setUsers(userList);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (payload) => {
    await sendAdminNotification(payload);
    await load();
  };

  const handleDelete = async (id) => {
    try {
      await deleteAdminNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification removed");
    } catch {
      toast.error("Failed to remove notification");
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send announcements and alerts to users</p>
        </div>
        <Button onClick={() => setShowCompose(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Notification
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total sent",   value: notifications.length, icon: Bell },
          { label: "Broadcast",    value: notifications.filter((n) => n.target_type === "all").length, icon: Users },
          { label: "Targeted",     value: notifications.filter((n) => n.target_type === "individual").length, icon: User },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border/40 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border/40 rounded-2xl">
          <Megaphone className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No notifications sent yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1 mb-4">Send your first announcement to users</p>
          <Button size="sm" onClick={() => setShowCompose(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Send Now
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="bg-card border border-border/40 rounded-xl p-4 flex items-start gap-4 group">
              <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 text-base">
                {n.icon || "📢"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <TypeBadge type={n.type} />
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    n.target_type === "all"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {n.target_type === "all" ? <Users className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                    {n.target_type === "all" ? "All users" : `${(n.target_user_ids || []).length} user(s)`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5">{fmtDate(n.created_at)}</p>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-red-500 shrink-0 mt-0.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCompose && (
          <ComposeModal users={users} onSend={handleSend} onClose={() => setShowCompose(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
