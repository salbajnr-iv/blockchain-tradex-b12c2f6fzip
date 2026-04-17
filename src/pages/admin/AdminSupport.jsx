import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, ChevronDown, ChevronUp, Clock, CheckCircle2,
  XCircle, AlertCircle, Loader2, Send, RefreshCw, Tag, User,
  Mail, Inbox, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from '@/lib/toast';
import { fetchAllTickets, replyToTicket, closeTicket } from "@/lib/api/support";

const STATUS_CONFIG = {
  open:     { label: "Open",     color: "text-yellow-500",  bg: "bg-yellow-500/10 border-yellow-500/30",  icon: Clock },
  answered: { label: "Answered", color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/30",      icon: CheckCircle2 },
  closed:   { label: "Closed",   color: "text-gray-500",    bg: "bg-gray-500/10 border-gray-500/30",      icon: XCircle },
};

const PRIORITY_CONFIG = {
  low:      { label: "Low",      color: "text-gray-400",    bg: "bg-gray-500/10" },
  normal:   { label: "Normal",   color: "text-blue-400",    bg: "bg-blue-500/10" },
  high:     { label: "High",     color: "text-orange-400",  bg: "bg-orange-500/10" },
  urgent:   { label: "Urgent",   color: "text-red-400",     bg: "bg-red-500/10" },
};

const CATEGORY_LABELS = {
  general:      "General",
  billing:      "Billing",
  technical:    "Technical",
  kyc:          "KYC",
  withdrawal:   "Withdrawal",
  deposit:      "Deposit",
  account:      "Account",
  trading:      "Trading",
  other:        "Other",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(dateStr));
}

function TicketRow({ ticket, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const qc = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: () => replyToTicket(ticket.id, replyText.trim()),
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to send reply"),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeTicket(ticket.id),
    onSuccess: () => {
      toast.success("Ticket closed");
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to close ticket"),
  });

  const isClosed = ticket.status === "closed";

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground truncate">{ticket.subject}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {ticket.user_name || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {ticket.user_email || "—"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmtDate(ticket.created_at)}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border"
          >
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">User Message</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/30 rounded-lg p-3">
                  {ticket.message}
                </p>
              </div>

              {ticket.admin_reply && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Admin Reply <span className="normal-case font-normal ml-1">— {fmtDate(ticket.replied_at)}</span>
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-primary/5 border border-primary/20 rounded-lg p-3">
                    {ticket.admin_reply}
                  </p>
                </div>
              )}

              {!isClosed && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {ticket.admin_reply ? "Update Reply" : "Reply to User"}
                  </p>
                  <textarea
                    rows={4}
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full resize-none rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => replyMutation.mutate()}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className="gap-2"
                    >
                      {replyMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                      Send Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => closeMutation.mutate()}
                      disabled={closeMutation.isPending}
                      className="gap-2 text-muted-foreground border-border hover:text-foreground"
                    >
                      {closeMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <XCircle className="w-3.5 h-3.5" />}
                      Close Ticket
                    </Button>
                  </div>
                </div>
              )}

              {isClosed && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
                  <XCircle className="w-3.5 h-3.5" />
                  This ticket is closed.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "all",      label: "All" },
  { value: "open",     label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed",   label: "Closed" },
];

export default function AdminSupport() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: fetchAllTickets,
    refetchInterval: 30_000,
  });

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const countOpen   = tickets.filter((t) => t.status === "open").length;
  const countAnswered = tickets.filter((t) => t.status === "answered").length;
  const countClosed = tickets.filter((t) => t.status === "closed").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and respond to user support requests</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",     count: countOpen,     color: "text-yellow-500", bg: "bg-yellow-500/10" },
          { label: "Answered", count: countAnswered, color: "text-blue-500",   bg: "bg-blue-500/10" },
          { label: "Closed",   count: countClosed,   color: "text-gray-500",   bg: "bg-gray-500/10" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Status:</span>
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
          <Tag className="w-3.5 h-3.5" />
          <span className="font-medium">Priority:</span>
        </div>
        <div className="flex gap-1.5">
          {["all", "urgent", "high", "normal", "low"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                priorityFilter === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Inbox className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">
            {tickets.length === 0 ? "No support tickets have been submitted yet." : "Try changing the filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
