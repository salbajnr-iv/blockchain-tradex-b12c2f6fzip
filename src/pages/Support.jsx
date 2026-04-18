import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Loader2, Paperclip, X, Image as ImageIcon,
  FileText, Download, LifeBuoy, ChevronDown, ChevronRight,
  BookOpen, Shield, CreditCard, ArrowUpDown, Settings, HelpCircle,
  Zap, CheckCircle2, Clock, XCircle, RefreshCw, Plus, Search,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  getOrCreateConversation,
  fetchMessages,
  sendMessage,
  uploadSupportFile,
  markReadByUser,
  closeConversation,
  reopenConversation,
} from "@/lib/api/support";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  open:        { label: "Open",        color: "text-yellow-500",  bg: "bg-yellow-500/10 border-yellow-500/20",  icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20",      icon: RefreshCw },
  resolved:    { label: "Resolved",    color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  closed:      { label: "Closed",      color: "text-muted-foreground", bg: "bg-secondary border-border",        icon: XCircle },
};

const FAQS = [
  {
    category: "Getting Started",
    icon: BookOpen,
    items: [
      { q: "How do I verify my account (KYC)?", a: "Go to Settings → KYC Verification. You'll need a government-issued ID, a selfie, and proof of address. Verification typically takes 1–3 business days." },
      { q: "How do I change my password?", a: "Go to Settings → Security → Change Password. You'll receive a verification email before the change is confirmed." },
    ],
  },
  {
    category: "Deposits & Withdrawals",
    icon: CreditCard,
    items: [
      { q: "How long do crypto deposits take?", a: "Crypto deposits require network confirmations: BTC ~30 min, ETH ~5 min, USDT/USDC ~2 min. Upload your transaction proof for faster processing." },
      { q: "Why is my withdrawal pending?", a: "Withdrawals are reviewed for security. Large withdrawals may take up to 24 hours. If pending for more than 48 hours, please chat with us." },
    ],
  },
  {
    category: "Trading",
    icon: ArrowUpDown,
    items: [
      { q: "What order types are available?", a: "BlockTrade supports Market Orders (instant execution at current price) and Limit Orders (execute at your set price)." },
      { q: "What are the trading fees?", a: "Trading fees are 0.1% per trade for standard accounts. Market makers and high-volume traders can negotiate custom rates." },
    ],
  },
  {
    category: "Security",
    icon: Shield,
    items: [
      { q: "How is my money kept safe?", a: "BlockTrade uses institutional-grade cold storage for 95% of all assets. Accounts are protected by 256-bit SSL encryption." },
      { q: "I suspect unauthorised account access — what do I do?", a: "Immediately change your password and contact our support team. We'll lock your account and investigate within 1 hour." },
    ],
  },
];

// ── Helper: format time ───────────────────────────────────────────────────────

function fmtTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (hrs < 48) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }) {
  const isImage = msg.file_type?.startsWith("image/");
  const hasFile = !!msg.file_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mb-0.5">
          <LifeBuoy className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}

      <div className={`max-w-[75%] sm:max-w-[60%] space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {/* Sender label */}
        <p className="text-[10px] text-muted-foreground px-1">
          {isOwn ? "You" : "BlockTrade Support"} · {fmtTime(msg.created_at)}
        </p>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isOwn
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
                    isOwn ? "bg-white/15 hover:bg-white/25" : "bg-secondary hover:bg-secondary/80"
                  } transition-colors`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{msg.file_name}</span>
                  <span className="shrink-0 opacity-70">{fmtFileSize(msg.file_size)}</span>
                  <Download className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── File preview pill ─────────────────────────────────────────────────────────

function FilePill({ file, onRemove }) {
  const isImage = file.type.startsWith("image/");
  const previewUrl = isImage ? URL.createObjectURL(file) : null;

  return (
    <div className="flex items-center gap-2 bg-secondary/80 border border-border/60 rounded-xl px-3 py-2 max-w-xs">
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} className="w-8 h-8 rounded-md object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{fmtFileSize(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Chat input ────────────────────────────────────────────────────────────────

function ChatInput({ onSend, disabled, placeholder = "Type a message…" }) {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }
    setFile(f);
    e.target.value = "";
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSend = (text.trim().length > 0 || !!file) && !sending && !disabled;

  return (
    <div className="space-y-2">
      {file && <FilePill file={file} onRemove={() => setFile(null)} />}

      <div className={`flex items-end gap-2 bg-secondary/40 border rounded-2xl px-3 py-2.5 transition-colors ${
        disabled ? "border-border/30 opacity-60" : "border-border/60 focus-within:border-primary/50 focus-within:bg-background"
      }`}>
        {/* File attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded-lg hover:bg-primary/10"
          title="Attach file or image"
        >
          <Paperclip className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[24px] max-h-[160px] py-0.5 leading-relaxed"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 scale-100"
              : "bg-secondary text-muted-foreground scale-95"
          }`}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground px-1">
        Press Enter to send · Shift + Enter for new line · Max 10 MB per file
      </p>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground pr-4">{item.q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2.5 text-sm text-muted-foreground leading-relaxed border-t border-border/30">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ── Main Support page ─────────────────────────────────────────────────────────

const TABS = [
  { id: "chat", label: "Live Chat", icon: MessageSquare },
  { id: "faq",  label: "FAQ",       icon: BookOpen },
];

export default function Support() {
  const { user } = useAuth();
  const [tab, setTab] = useState("chat");
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [faqSearch, setFaqSearch] = useState("");
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Load or create conversation
  const initConversation = useCallback(async () => {
    if (!user) return;
    setConvLoading(true);
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const conversation = await getOrCreateConversation(
        user.id,
        profile?.email || user.email,
        profile?.full_name || user.email
      );
      setConv(conversation);

      const msgs = await fetchMessages(conversation.id);
      setMessages(msgs);
      await markReadByUser(conversation.id);
    } catch (err) {
      toast.error("Could not load support chat");
    } finally {
      setConvLoading(false);
    }
  }, [user]);

  useEffect(() => { initConversation(); }, [initConversation]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [conv?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!conv?.id) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`support-msgs:${conv.id}`)
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
        markReadByUser(conv.id);
        setTimeout(() => scrollToBottom(), 80);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "support_conversations",
        filter: `id=eq.${conv.id}`,
      }, (payload) => {
        setConv((c) => ({ ...c, ...payload.new }));
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [conv?.id, scrollToBottom]);

  // Auto-scroll on new messages (only if near bottom)
  useEffect(() => {
    const el = messagesEndRef.current?.parentElement;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollToBottom();
  }, [messages]);

  const handleSend = async (text, file) => {
    if (!conv) return;
    try {
      let fileData = null;
      if (file) {
        fileData = await uploadSupportFile(file, user.id);
      }
      const msg = await sendMessage(conv.id, user.id, "user", text, fileData);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => scrollToBottom(), 80);
    } catch (err) {
      toast.error(err?.message || "Failed to send message");
    }
  };

  const handleCloseChat = async () => {
    if (!conv) return;
    try {
      await closeConversation(conv.id);
      setConv((c) => ({ ...c, status: "closed" }));
      toast.success("Chat closed. Start a new one anytime.");
    } catch {
      toast.error("Failed to close chat");
    }
  };

  const handleNewChat = async () => {
    if (!user) return;
    setConvLoading(true);
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("support_conversations")
        .insert({
          user_id: user.id,
          user_email: profile?.email || user.email,
          user_name: profile?.full_name || user.email,
        })
        .select()
        .single();

      if (error) throw error;
      setConv(data);
      setMessages([]);
    } catch {
      toast.error("Failed to start new chat");
    } finally {
      setConvLoading(false);
    }
  };

  const statusCfg = STATUS_CFG[conv?.status] || STATUS_CFG.open;
  const StatusIcon = statusCfg.icon;

  // Group messages by date for dividers
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

  const filteredFaqs = FAQS.map((cat) => ({
    ...cat,
    items: faqSearch.trim()
      ? cat.items.filter((i) =>
          i.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
          i.a.toLowerCase().includes(faqSearch.toLowerCase())
        )
      : cat.items,
  })).filter((c) => c.items.length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Support</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-xs text-muted-foreground">Team online · Mon–Fri 9am–6pm GMT</p>
            </div>
          </div>
        </div>
        {conv && conv.status !== "closed" && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Chat Tab ─────────────────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-secondary/20 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <LifeBuoy className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">BlockTrade Support</p>
                <p className="text-[10px] text-muted-foreground">Typically replies within 4 hours</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conv && conv.status !== "closed" && (
                <button
                  onClick={handleCloseChat}
                  className="text-xs text-muted-foreground hover:text-destructive border border-border/50 hover:border-destructive/40 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  Close chat
                </button>
              )}
              {conv && conv.status === "closed" && (
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 hover:bg-primary/5 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New chat
                </button>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {convLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Start a conversation</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send us a message and our team will get back to you as soon as possible.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {["I have a deposit issue", "Help with withdrawal", "Account question"].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q, null)}
                      className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border/50 text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Welcome message */}
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
                  <LifeBuoy className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Welcome to BlockTrade Support. Our team typically responds within 4 hours (Mon–Fri, 9am–6pm GMT).
                  </p>
                </div>

                {groupedMessages.map((item) =>
                  item.type === "date" ? (
                    <DateDivider key={item.id} date={item.date} />
                  ) : (
                    <MessageBubble
                      key={item.id}
                      msg={item}
                      isOwn={item.sender_role === "user"}
                    />
                  )
                )}
              </>
            )}

            {/* Closed notice */}
            {conv?.status === "closed" && !convLoading && (
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full border border-border/40">
                  This chat is closed · Start a new one above
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 border-t border-border/40 shrink-0">
            {conv?.status === "closed" ? (
              <div className="flex items-center justify-center py-3">
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/15 border border-primary/25 rounded-xl text-sm font-medium text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Start a new conversation
                </button>
              </div>
            ) : (
              <ChatInput
                onSend={handleSend}
                disabled={convLoading || !conv}
                placeholder="Message BlockTrade Support…"
              />
            )}
          </div>
        </div>
      )}

      {/* ── FAQ Tab ──────────────────────────────────────────────────────────── */}
      {tab === "faq" && (
        <div className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Search frequently asked questions…"
              className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
            />
            {faqSearch && (
              <button
                onClick={() => setFaqSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No results for "{faqSearch}"</p>
              <button
                onClick={() => { setFaqSearch(""); setTab("chat"); }}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Ask our support team →
              </button>
            </div>
          ) : (
            filteredFaqs.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <div key={cat.category} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{cat.category}</h2>
                  </div>
                  {cat.items.map((item) => (
                    <FAQItem key={item.q} item={item} />
                  ))}
                </div>
              );
            })
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-4 flex items-center gap-4">
            <MessageSquare className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Didn't find your answer?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Chat with our support team directly</p>
            </div>
            <button
              onClick={() => setTab("chat")}
              className="shrink-0 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Open Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
