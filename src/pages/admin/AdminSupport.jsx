import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Send, Loader2, Paperclip, X, RefreshCw,
  CheckCircle2, Clock, XCircle, User, Search, LifeBuoy,
  FileText, Download, Image as ImageIcon, ChevronDown,
  Filter, Inbox, AlertCircle, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchAllConversations,
  fetchMessages,
  sendMessage,
  uploadSupportFile,
  adminUpdateStatus,
  markReadByAdmin,
} from "@/lib/api/support";
import { toast } from "sonner";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  open:        { label: "Open",        color: "text-yellow-500",       bg: "bg-yellow-500/10 border-yellow-500/30",    dot: "bg-yellow-500",   icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-400",         bg: "bg-blue-400/10 border-blue-400/30",        dot: "bg-blue-400",     icon: RefreshCw },
  resolved:    { label: "Resolved",    color: "text-emerald-500",      bg: "bg-emerald-500/10 border-emerald-500/30",  dot: "bg-emerald-500",  icon: CheckCircle2 },
  closed:      { label: "Closed",      color: "text-muted-foreground", bg: "bg-secondary border-border/50",            dot: "bg-border",       icon: XCircle },
};

const STATUS_FILTERS = ["all", "open", "in_progress", "resolved", "closed"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (hrs < 48) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtTimeFull(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Today ${timeStr}`;
  if (diff === 1) return `Yesterday ${timeStr}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + timeStr;
}

function fmtFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, userInitials }) {
  const isAdmin = msg.sender_role === "admin";
  const isImage = msg.file_type?.startsWith("image/");
  const hasFile = !!msg.file_url;

  return (
    <div className={`flex items-end gap-2 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isAdmin && (
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mb-0.5">
          <span className="text-[10px] font-bold text-foreground">{userInitials}</span>
        </div>
      )}

      <div className={`max-w-[70%] space-y-1 flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
        <p className="text-[10px] text-muted-foreground px-1">
          {isAdmin ? "You (Support)" : "User"} · {fmtTimeFull(msg.created_at)}
        </p>

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isAdmin
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-card border border-border/60 text-foreground rounded-bl-sm"
          }`}
        >
          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

          {hasFile && (
            <div className={`mt-2 ${msg.content ? "pt-2 border-t border-white/20" : ""}`}>
              {isImage ? (
                <a href={msg.file_url} target="_blank" rel="noreferrer">
                  <img
                    src={msg.file_url}
                    alt={msg.file_name}
                    className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <a
                  href={msg.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    isAdmin ? "bg-white/15 hover:bg-white/25" : "bg-secondary hover:bg-secondary/80"
                  } transition-colors`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{msg.file_name}</span>
                  <span className="opacity-70">{fmtFileSize(msg.file_size)}</span>
                  <Download className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── File preview pill ─────────────────────────────────────────────────────────

function FilePill({ file, onRemove }) {
  const isImage = file.type.startsWith("image/");
  return (
    <div className="flex items-center gap-2 bg-secondary/80 border border-border/60 rounded-xl px-3 py-2">
      {isImage ? (
        <img src={URL.createObjectURL(file)} alt={file.name} className="w-8 h-8 rounded-md object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{fmtFileSize(file.size)}</p>
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Date divider ──────────────────────────────────────────────────────────────

function DateDivider({ date }) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday"
    : d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

// ── Reply input ───────────────────────────────────────────────────────────────

function ReplyInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSend = async () => {
    if ((!text.trim() && !file) || sending || disabled) return;
    setSending(true);
    try {
      await onSend(text, file);
      setText("");
      setFile(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10 MB"); return; }
    setFile(f);
    e.target.value = "";
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const canSend = (text.trim() || file) && !sending && !disabled;

  return (
    <div className="space-y-2">
      {file && <FilePill file={file} onRemove={() => setFile(null)} />}

      <div className={`flex items-end gap-2 bg-secondary/40 border rounded-2xl px-3 py-2.5 transition-colors ${
        disabled ? "border-border/30 opacity-50" : "border-border/60 focus-within:border-primary/50 focus-within:bg-background"
      }`}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded-lg hover:bg-primary/10"
          title="Attach file or image"
        >
          <Paperclip className="w-[18px] h-[18px]" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Chat is closed" : "Reply to user…"}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[24px] max-h-[120px] py-0.5 leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            canSend ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-muted-foreground"
          }`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({ conv, active, onClick }) {
  const cfg = STATUS_CFG[conv.status] || STATUS_CFG.open;
  const hasUnread = (conv.unread_admin || 0) > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-border/30 last:border-0 ${
        active ? "bg-primary/8 bg-primary/5" : "hover:bg-secondary/50"
      }`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-primary">{initials(conv.user_name)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm font-semibold truncate ${active ? "text-primary" : "text-foreground"}`}>
            {conv.user_name || conv.user_email || "Unknown User"}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(conv.last_message_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{conv.user_email || "—"}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {hasUnread && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              New
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({ conv, user, onStatusChange, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);
      await markReadByAdmin(conv.id);
    } catch {
      toast.error("Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [conv.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [conv.id]);

  useEffect(() => {
    if (!conv?.id) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`admin-msgs:${conv.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conv.id}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        markReadByAdmin(conv.id);
        setTimeout(() => scrollToBottom(), 80);
      })
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [conv.id, scrollToBottom]);

  useEffect(() => {
    const el = messagesEndRef.current?.parentElement;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (near) scrollToBottom();
  }, [messages]);

  const handleSend = async (text, file) => {
    if (!conv) return;
    try {
      let fileData = null;
      if (file) fileData = await uploadSupportFile(file, user.id);
      const msg = await sendMessage(conv.id, user.id, "admin", text, fileData);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => scrollToBottom(), 80);
    } catch (err) {
      toast.error(err?.message || "Failed to send reply");
    }
  };

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;
    for (const msg of messages) {
      const day = new Date(msg.created_at).toDateString();
      if (day !== lastDate) {
        groups.push({ type: "date", date: msg.created_at, id: `date-${msg.id}` });
        lastDate = day;
      }
      groups.push({ type: "message", ...msg });
    }
    return groups;
  }, [messages]);

  const cfg = STATUS_CFG[conv.status] || STATUS_CFG.open;
  const StatusIcon = cfg.icon;
  const isClosed = conv.status === "closed";
  const userInit = initials(conv.user_name);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-secondary/10 shrink-0">
        {/* Mobile back button */}
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{userInit}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{conv.user_name || "User"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{conv.user_email}</p>
        </div>

        {/* Status badge + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {cfg.label}
          </span>

          <select
            value={conv.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs bg-secondary border border-border/50 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Close</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
          </div>
        ) : (
          groupedMessages.map((item) =>
            item.type === "date" ? (
              <DateDivider key={item.id} date={item.date} />
            ) : (
              <MessageBubble key={item.id} msg={item} userInitials={userInit} />
            )
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-4 pb-4 pt-2 border-t border-border/40 shrink-0">
        {isClosed ? (
          <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground">
            <XCircle className="w-4 h-4" />
            <span>This conversation is closed</span>
            <button
              onClick={() => onStatusChange("open")}
              className="text-primary hover:underline ml-1"
            >
              Reopen
            </button>
          </div>
        ) : (
          <ReplyInput onSend={handleSend} disabled={isClosed} />
        )}
      </div>
    </div>
  );
}

// ── Main AdminSupport page ────────────────────────────────────────────────────

export default function AdminSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(true);

  const { data: conversations = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-support-conversations"],
    queryFn: fetchAllConversations,
    refetchInterval: 20_000,
  });

  // Real-time: listen for new conversations and messages
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "support_conversations",
      }, () => {
        qc.invalidateQueries({ queryKey: ["admin-support-conversations"] });
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
      }, () => {
        qc.invalidateQueries({ queryKey: ["admin-support-conversations"] });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [qc]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (c.user_name || "").toLowerCase().includes(q) ||
          (c.user_email || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [conversations, statusFilter, search]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  const handleSelectConv = (conv) => {
    setSelectedConvId(conv.id);
    setShowList(false);
    markReadByAdmin(conv.id).catch(() => {});
    qc.invalidateQueries({ queryKey: ["admin-support-conversations"] });
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedConvId) return;
    try {
      await adminUpdateStatus(selectedConvId, newStatus);
      qc.invalidateQueries({ queryKey: ["admin-support-conversations"] });
      toast.success(`Conversation marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const counts = useMemo(() => ({
    all: conversations.length,
    open: conversations.filter((c) => c.status === "open").length,
    in_progress: conversations.filter((c) => c.status === "in_progress").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
    closed: conversations.filter((c) => c.status === "closed").length,
    unread: conversations.filter((c) => (c.unread_admin || 0) > 0).length,
  }), [conversations]);

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* Page header */}
      <div className="p-4 sm:p-6 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Support Inbox</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.open} open · {counts.in_progress} in progress
              {counts.unread > 0 && (
                <span className="ml-2 text-primary font-medium">· {counts.unread} unread</span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 shrink-0"
          >
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Open",        value: counts.open,        color: "text-yellow-500" },
            { label: "In Progress", value: counts.in_progress, color: "text-blue-400" },
            { label: "Resolved",    value: counts.resolved,    color: "text-emerald-500" },
            { label: "Closed",      value: counts.closed,      color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border/40 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
        {/* ── Left: conversation list ─────────────────────────────────────────── */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-border/40 flex flex-col shrink-0 ${
            !showList ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search + filter */}
          <div className="px-3 py-3 border-b border-border/30 space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full bg-secondary/50 border border-border/40 rounded-xl pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "All" : s.replace("_", " ")}
                  {s !== "all" && counts[s] > 0 && (
                    <span className={`ml-1 ${statusFilter === s ? "opacity-70" : "text-muted-foreground"}`}>
                      {counts[s]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4 text-center">
                <Inbox className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-sm">No conversations</p>
                <p className="text-xs mt-1">
                  {conversations.length === 0
                    ? "No support chats yet"
                    : "Try a different filter"}
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === selectedConvId}
                  onClick={() => handleSelectConv(conv)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: chat panel ───────────────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${
            showList ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConv ? (
            <ChatPanel
              key={selectedConv.id}
              conv={selectedConv}
              user={user}
              onStatusChange={handleStatusChange}
              onBack={() => setShowList(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/5 border border-primary/15 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary/40" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a chat from the left to view and reply to user messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
