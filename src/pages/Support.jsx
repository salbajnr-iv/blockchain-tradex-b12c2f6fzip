import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, ChevronDown, ChevronRight, Send, Clock, CheckCircle2,
  AlertCircle, XCircle, Loader2, Plus, Search, LifeBuoy, BookOpen,
  Zap, Shield, CreditCard, ArrowUpDown, Settings, HelpCircle,
  ChevronLeft, MessageCircle, Inbox, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from '@/lib/toast';
import { submitSupportTicket, fetchMyTickets } from "@/lib/api/support";

const CATEGORIES = [
  { value: "account",      label: "Account & Profile",     icon: Settings },
  { value: "deposit",      label: "Deposits",              icon: CreditCard },
  { value: "withdrawal",   label: "Withdrawals",           icon: CreditCard },
  { value: "trading",      label: "Trading & Orders",      icon: ArrowUpDown },
  { value: "kyc",          label: "KYC Verification",      icon: Shield },
  { value: "security",     label: "Security",              icon: Shield },
  { value: "technical",    label: "Technical Issue",       icon: Zap },
  { value: "general",      label: "General Enquiry",       icon: HelpCircle },
];

const PRIORITIES = [
  { value: "low",      label: "Low",      color: "text-muted-foreground" },
  { value: "normal",   label: "Normal",   color: "text-blue-400" },
  { value: "high",     label: "High",     color: "text-orange-400" },
  { value: "urgent",   label: "Urgent",   color: "text-red-500" },
];

const STATUS_CFG = {
  open:     { icon: Clock,         color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",   label: "Open" },
  answered: { icon: CheckCircle2,  color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Answered" },
  closed:   { icon: XCircle,       color: "text-muted-foreground bg-secondary border-border",         label: "Closed" },
  pending:  { icon: AlertCircle,   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",          label: "In Progress" },
};

const FAQS = [
  {
    category: "Getting Started",
    icon: BookOpen,
    items: [
      { q: "How do I verify my account (KYC)?", a: "Go to Settings → KYC Verification. You'll need a government-issued ID (passport, national ID, or driver's licence), a selfie, and proof of address. Verification typically takes 1–3 business days." },
      { q: "What countries are supported?", a: "BlockTrade is available in 100+ countries across Europe, North America, Asia, Africa, and beyond. Check our full list during registration." },
      { q: "How do I change my password?", a: "Go to Settings → Security → Change Password. You'll receive a verification email before the change is confirmed." },
    ],
  },
  {
    category: "Deposits & Withdrawals",
    icon: CreditCard,
    items: [
      { q: "How long do crypto deposits take?", a: "Crypto deposits require network confirmations: BTC ~30 min (3 confirmations), ETH ~5 min (12 confirmations), USDT/USDC ~2 min. Upload your transaction proof after sending for faster processing." },
      { q: "What are the withdrawal fees?", a: "Withdrawal fees vary by asset and method. Crypto withdrawals incur network fees. Fiat withdrawals via bank transfer are typically free for premium accounts; standard accounts pay a small fee." },
      { q: "How do I deposit fiat currency?", a: "Go to Assets → select your currency → Deposit. Choose Bank Transfer or Wire Transfer, then send funds to the displayed bank account using your reference code. Funds appear within 1–3 business days." },
      { q: "Why is my withdrawal pending?", a: "Withdrawals are reviewed for security. Large withdrawals may take up to 24 hours. If your withdrawal has been pending more than 48 hours, please submit a support ticket." },
    ],
  },
  {
    category: "Trading",
    icon: ArrowUpDown,
    items: [
      { q: "What order types are available?", a: "BlockTrade supports Market Orders (instant execution at current price), Limit Orders (execute at your set price), and Stop-Limit Orders (trigger price + limit price for risk management)." },
      { q: "What are the trading fees?", a: "Trading fees start at 0.1% per trade for standard accounts. Premium members get reduced fees from 0.05%. Market makers and high-volume traders can negotiate custom rates." },
      { q: "How does the Recurring/DCA feature work?", a: "Dollar-Cost Averaging lets you buy a fixed amount of crypto on a regular schedule (daily, weekly, monthly). Go to Markets → Recurring/DCA to set up your plan." },
    ],
  },
  {
    category: "Security",
    icon: Shield,
    items: [
      { q: "How is my money kept safe?", a: "BlockTrade uses institutional-grade cold storage for 95% of all crypto assets. Remaining funds are held in hot wallets secured with multi-signature technology. All accounts are protected by 256-bit SSL encryption." },
      { q: "I suspect unauthorised account access — what should I do?", a: "Immediately change your password and contact our support team with 'URGENT - Security' as the subject. We'll lock your account and investigate within 1 hour." },
    ],
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground pr-4">{item.q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TicketCard({ ticket, onClick }) {
  const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.open;
  const StatusIcon = cfg.icon;
  const cat = CATEGORIES.find((c) => c.value === ticket.category);
  const CatIcon = cat?.icon || HelpCircle;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-card border border-border/40 rounded-xl hover:border-primary/30 hover:bg-secondary/20 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
          <CatIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
              <StatusIcon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            {new Date(ticket.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            {ticket.admin_reply && <span className="ml-2 text-emerald-500">· Reply received</span>}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
      </div>
    </button>
  );
}

function TicketDetail({ ticket, onBack }) {
  const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.open;
  const StatusIcon = cfg.icon;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to tickets
      </button>
      <div className="bg-card border border-border/40 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted {new Date(ticket.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-secondary px-2.5 py-1 rounded-full text-muted-foreground capitalize">
            {CATEGORIES.find((c) => c.value === ticket.category)?.label || ticket.category}
          </span>
          <span className={`px-2.5 py-1 rounded-full border capitalize ${
            ticket.priority === "urgent" ? "border-red-500/30 text-red-500 bg-red-500/5" :
            ticket.priority === "high" ? "border-orange-400/30 text-orange-400 bg-orange-400/5" :
            "border-border/40 text-muted-foreground bg-secondary"
          }`}>
            {ticket.priority} priority
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Your message</p>
          <div className="bg-secondary/40 rounded-lg p-3 text-sm text-foreground leading-relaxed">
            {ticket.message}
          </div>
        </div>
        {ticket.admin_reply && (
          <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Star className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-primary">BlockTrade Support</span>
              {ticket.replied_at && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(ticket.replied_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{ticket.admin_reply}</p>
          </div>
        )}
        {!ticket.admin_reply && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Our team typically responds within 4–24 hours. You'll receive a notification when we reply.
          </div>
        )}
      </div>
    </div>
  );
}

function NewTicketForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ subject: "", category: "general", priority: "normal", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      toast.success("Support ticket submitted! We'll respond within 24 hours.");
    } catch (err) {
      toast.error(err?.message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-card border border-border/40 rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">New Support Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject *</label>
            <Input
              value={form.subject}
              onChange={(e) => upd("subject", e.target.value)}
              placeholder="Brief description of your issue"
              className="mt-1.5"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category *</label>
              <select
                value={form.category}
                onChange={(e) => upd("category", e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => upd("priority", e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => upd("message", e.target.value)}
              placeholder="Describe your issue in detail. Include any relevant transaction IDs, dates, or error messages."
              rows={6}
              required
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1 gap-2">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit Ticket
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABS = [
  { id: "faq",     label: "FAQ",           icon: BookOpen },
  { id: "tickets", label: "My Tickets",    icon: Inbox },
  { id: "contact", label: "Contact Us",    icon: MessageCircle },
];

export default function Support() {
  const [tab, setTab] = useState("faq");
  const [faqSearch, setFaqSearch] = useState("");
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [view, setView] = useState("list"); // 'list' | 'new' | 'detail'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedFaqCat, setExpandedFaqCat] = useState(null);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try { setTickets(await fetchMyTickets()); } catch { /* ignore */ }
    finally { setTicketsLoading(false); }
  }, []);

  useEffect(() => { if (tab === "tickets") loadTickets(); }, [tab, loadTickets]);

  const filteredFaqs = FAQS.map((cat) => ({
    ...cat,
    items: faqSearch.trim()
      ? cat.items.filter((i) =>
          i.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
          i.a.toLowerCase().includes(faqSearch.toLowerCase())
        )
      : cat.items,
  })).filter((cat) => cat.items.length > 0);

  const handleSubmitTicket = async (form) => {
    await submitSupportTicket(form);
    await loadTickets();
    setTab("tickets");
    setView("list");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center py-6 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl border border-primary/10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <LifeBuoy className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Support Centre</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Find answers instantly or reach our team. We typically respond within 4–24 hours.
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Support online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Mon–Fri, 9am–6pm GMT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            <span>Avg. response: &lt; 4h</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setView("list"); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "tickets" && tickets.some((t) => t.status === "answered" && !t.admin_reply_seen) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* FAQ Tab */}
      {tab === "faq" && (
        <div className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Search frequently asked questions..."
              className="pl-9"
            />
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-muted-foreground">No results for "{faqSearch}"</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setFaqSearch(""); setTab("tickets"); setView("new"); }}>
                Submit a ticket instead
              </Button>
            </div>
          ) : (
            filteredFaqs.map((cat) => {
              const CatIcon = cat.icon;
              const isExpanded = expandedFaqCat === cat.category || faqSearch.trim();
              return (
                <div key={cat.category} className="space-y-2">
                  <button
                    onClick={() => setExpandedFaqCat(isExpanded && !faqSearch.trim() ? null : cat.category)}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    <CatIcon className="w-4 h-4 text-primary" />
                    {cat.category}
                    <span className="text-muted-foreground font-normal">({cat.items.length})</span>
                    {!faqSearch.trim() && (
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} className="ml-auto">
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 overflow-hidden"
                      >
                        {cat.items.map((item) => <FAQItem key={item.q} item={item} />)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground mb-3">Can't find what you're looking for?</p>
            <Button onClick={() => { setTab("tickets"); setView("new"); }} className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Contact Support
            </Button>
          </div>
        </div>
      )}

      {/* Tickets Tab */}
      {tab === "tickets" && (
        <div>
          {view === "list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  Your Tickets
                  {tickets.length > 0 && <span className="text-muted-foreground font-normal ml-1.5">({tickets.length})</span>}
                </h2>
                <Button size="sm" onClick={() => setView("new")} className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" />
                  New Ticket
                </Button>
              </div>
              {ticketsLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border/40 rounded-xl">
                  <Inbox className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No tickets yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-1 mb-4">Submit a ticket and we'll get back to you shortly</p>
                  <Button size="sm" onClick={() => setView("new")} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    New Ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <TicketCard key={t.id} ticket={t} onClick={() => { setSelectedTicket(t); setView("detail"); }} />
                  ))}
                </div>
              )}
            </div>
          )}
          {view === "new" && (
            <NewTicketForm onSubmit={handleSubmitTicket} onCancel={() => setView("list")} />
          )}
          {view === "detail" && selectedTicket && (
            <TicketDetail ticket={selectedTicket} onBack={() => { setView("list"); setSelectedTicket(null); }} />
          )}
        </div>
      )}

      {/* Contact Tab */}
      {tab === "contact" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: MessageSquare, title: "Submit a Ticket", desc: "Get help from our support team. We respond within 4–24 hours.", action: "Open Ticket", onClick: () => { setTab("tickets"); setView("new"); }, primary: true },
              { icon: BookOpen, title: "Knowledge Base", desc: "Browse our FAQ for instant answers to common questions.", action: "Browse FAQ", onClick: () => setTab("faq"), primary: false },
              { icon: Shield, title: "Security Issues", desc: "Report suspected unauthorised access or account security problems.", action: "Report Now", onClick: () => { setTab("tickets"); setView("new"); }, primary: false },
              { icon: Zap, title: "Live Status", desc: "Check if there are any known platform outages or maintenance windows.", action: "View Status", onClick: () => window.open("https://status.blocktrade.com", "_blank"), primary: false },
            ].map((card) => (
              <div key={card.title} className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.primary ? "bg-primary/10" : "bg-secondary/60"}`}>
                  <card.icon className={`w-5 h-5 ${card.primary ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{card.desc}</p>
                </div>
                <Button variant={card.primary ? "default" : "outline"} size="sm" onClick={card.onClick} className="gap-1.5 w-full">
                  {card.action}
                </Button>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border/40 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-3">Direct Contact</h3>
            <div className="space-y-2">
              {[
                { label: "General Support", value: "support@blocktrade.com" },
                { label: "Compliance / KYC", value: "compliance@blocktrade.com" },
                { label: "Security",         value: "security@blocktrade.com" },
                { label: "Business / PR",    value: "business@blocktrade.com" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <a href={`mailto:${row.value}`} className="text-xs text-primary hover:underline">{row.value}</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
