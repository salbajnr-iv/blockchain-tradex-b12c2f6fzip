import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions";
import { listTrades } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle,
  Loader2, Send, BarChart3, Search, SlidersHorizontal, X, MessageSquare,
  Download, Receipt, Copy, CheckCheck, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from '@/lib/toast';
import DepositDialog from "@/components/crypto/DepositDialog";
import TransferDialog from "@/components/crypto/TransferDialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
};

const DATE_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Today",    value: "today" },
  { label: "Week",     value: "week" },
  { label: "Month",    value: "month" },
];

const TYPE_FILTERS = [
  { label: "All",        value: "all" },
  { label: "Buy",        value: "BUY" },
  { label: "Sell",       value: "SELL" },
  { label: "Deposit",    value: "DEPOSIT" },
  { label: "Withdrawal", value: "WITHDRAWAL" },
  { label: "Transfer",   value: "TRANSFER" },
];

function getDateCutoff(range) {
  const now = new Date();
  switch (range) {
    case "today": return startOfDay(now);
    case "week":  return startOfWeek(now);
    case "month": return startOfMonth(now);
    default:      return null;
  }
}

function getStatusIcon(status, size = "w-5 h-5") {
  switch ((status || "").toLowerCase()) {
    case "completed": return <CheckCircle2 className={`${size} text-primary`} />;
    case "pending":   return <Clock className={`${size} text-yellow-400`} />;
    case "failed":    return <XCircle className={`${size} text-destructive`} />;
    default:          return null;
  }
}

function getStatusColor(status) {
  switch ((status || "").toLowerCase()) {
    case "completed": return "bg-primary/10 text-primary";
    case "pending":   return "bg-yellow-400/10 text-yellow-400";
    case "failed":    return "bg-destructive/10 text-destructive";
    default:          return "bg-muted text-muted-foreground";
  }
}

// ── Transaction Detail Modal ───────────────────────────────────────────────────
function TransactionDetailModal({ item, onClose }) {
  const receiptRef = useRef(null);
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const isTrade = item._source === "trade";
  const isBuy = item.type === "BUY";
  const isDeposit = item.type === "DEPOSIT";
  const isTransfer = item.type === "TRANSFER";
  const isIn = item.transfer_direction === "IN";

  const txId = item.id || "—";
  const dateStr = item._date ? format(item._date, "MMMM d, yyyy 'at' h:mm:ss a") : "—";

  let title = "";
  let amount = "";
  let amountColor = "text-foreground";
  let typeLabel = "";

  if (isTrade) {
    title = `${isBuy ? "Bought" : "Sold"} ${item.symbol}`;
    amount = `${isBuy ? "+" : "-"}${Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${item.symbol}`;
    amountColor = isBuy ? "text-primary" : "text-destructive";
    typeLabel = isBuy ? "Buy Order" : "Sell Order";
  } else if (isTransfer) {
    title = isIn ? "Received Transfer" : "Sent Transfer";
    amount = `${isIn ? "+" : "−"}$${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    amountColor = isIn ? "text-primary" : "text-blue-400";
    typeLabel = "Internal Transfer";
  } else {
    title = item.type === "WITHDRAWAL" ? "Withdrawal" : item.type === "DEPOSIT" ? "Deposit" : item.type;
    amount = item.total_amount != null
      ? `${isDeposit ? "+" : ""}$${Number(item.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : "—";
    amountColor = isDeposit ? "text-primary" : "text-foreground";
    typeLabel = item.type === "WITHDRAWAL" ? "Withdrawal" : "Deposit";
  }

  const copyId = () => {
    navigator.clipboard.writeText(txId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveReceipt = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a5" });
      const W = doc.internal.pageSize.getWidth();

      const primaryColor = [16, 185, 129];
      const darkColor = [15, 23, 42];
      const mutedColor = [100, 116, 139];
      const lightBg = [248, 250, 252];

      doc.setFillColor(...darkColor);
      doc.rect(0, 0, W, 110, "F");

      doc.setFillColor(...primaryColor);
      doc.rect(0, 100, W, 4, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("BlockTrade", 40, 45);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(160, 180, 200);
      doc.text("Transaction Receipt", 40, 65);
      doc.text("blocktrade.com", 40, 82);

      doc.setFillColor(...lightBg);
      doc.roundedRect(30, 120, W - 60, 80, 6, 6, "F");

      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(title, W / 2, 150, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(...primaryColor);
      doc.text(amount, W / 2, 185, { align: "center" });

      const rows = [];
      rows.push(["Date", dateStr]);
      rows.push(["Status", (item.status || "Completed").toUpperCase()]);
      rows.push(["Type", typeLabel]);
      rows.push(["Transaction ID", txId]);

      if (isTrade) {
        rows.push(["Asset", item.symbol]);
        rows.push(["Quantity", Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 8 })]);
        rows.push(["Unit Price", `$${Number(item.unit_price).toLocaleString(undefined, { maximumFractionDigits: 6 })}`]);
        const totalValue = Number(item.quantity) * Number(item.unit_price);
        rows.push(["Total Value", `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`]);
        if (item.fees > 0) rows.push(["Fees", `$${Number(item.fees).toFixed(4)}`]);
      } else if (isTransfer) {
        rows.push(["Direction", isIn ? "Received" : "Sent"]);
        rows.push([isIn ? "From" : "To", `@${item.counterparty_username || item.counterparty_uid || "—"}`]);
        rows.push(["Amount", `$${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        rows.push(["Fee", "Free"]);
      } else {
        if (item.payment_method) rows.push(["Payment Method", METHOD_LABELS[item.payment_method] || item.payment_method]);
        if (item.total_amount != null) rows.push(["Amount", `$${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
        if (item.notes) rows.push(["Notes", item.notes]);
        if (item.admin_message) rows.push(["Team Message", item.admin_message]);
      }

      let y = 225;
      const rowH = 28;
      rows.forEach((row, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(30, y - 10, W - 60, rowH, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...mutedColor);
        doc.text(row[0], 40, y + 6);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...darkColor);
        const val = String(row[1]);
        doc.text(val.length > 38 ? val.slice(0, 35) + "..." : val, W - 40, y + 6, { align: "right" });
        y += rowH;
      });

      y += 20;
      doc.setFillColor(...primaryColor);
      doc.rect(30, y, W - 60, 1, "F");
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      doc.text("This is an official receipt from BlockTrade. For support, contact support@blocktrade.com", W / 2, y, { align: "center" });
      y += 15;
      doc.text(`Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, W / 2, y, { align: "center" });

      const filename = `blocktrade-receipt-${txId.slice(0, 8)}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(filename);
      toast.success("Receipt saved as PDF");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate receipt");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.35 }}
          className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          ref={receiptRef}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">Transaction Details</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1 hover:bg-secondary/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount hero */}
          <div className="px-5 py-6 text-center border-b border-border/30 bg-secondary/20">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{typeLabel}</p>
            <p className={`text-3xl font-bold ${amountColor} mb-1`}>{amount}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(item.status || "completed")}`}>
              {getStatusIcon(item.status || "completed", "w-3.5 h-3.5")}
              <span className="capitalize">{(item.status || "completed")}</span>
            </div>
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <DetailRow label="Date & Time" value={dateStr} />
            <DetailRow label="Type" value={typeLabel} />

            {isTrade && (
              <>
                <DetailRow label="Asset" value={item.symbol} />
                <DetailRow label="Quantity" value={`${Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${item.symbol}`} />
                <DetailRow label="Unit Price" value={`$${Number(item.unit_price).toLocaleString(undefined, { maximumFractionDigits: 6 })}`} />
                <DetailRow label="Total Value" value={`$${(Number(item.quantity) * Number(item.unit_price)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                {item.fees > 0 && <DetailRow label="Fees" value={`$${Number(item.fees).toFixed(4)}`} />}
              </>
            )}

            {isTransfer && (
              <>
                <DetailRow label="Direction" value={isIn ? "Received" : "Sent"} />
                <DetailRow label={isIn ? "From" : "To"} value={`@${item.counterparty_username || item.counterparty_uid || "—"}`} />
                <DetailRow label="Amount" value={`$${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <DetailRow label="Fee" value="Free" />
                {item.notes && <DetailRow label="Note" value={item.notes} />}
              </>
            )}

            {!isTrade && !isTransfer && (
              <>
                {item.payment_method && <DetailRow label="Payment Method" value={METHOD_LABELS[item.payment_method] || item.payment_method} />}
                {item.total_amount != null && <DetailRow label="Amount" value={`$${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />}
                {item.notes && <DetailRow label="Notes" value={item.notes} />}
                {item.admin_message && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-semibold text-primary mb-0.5">Message from our team</p>
                    <p className="text-xs text-foreground">{item.admin_message}</p>
                  </div>
                )}
              </>
            )}

            {/* Transaction ID */}
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1.5">Transaction ID</p>
              <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
                <span className="text-xs font-mono text-foreground flex-1 truncate">{txId}</span>
                <button onClick={copyId} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 pt-1 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2 border-border/50 text-sm"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-sm"
              onClick={saveReceipt}
            >
              <Download className="w-4 h-4" />
              Save Receipt
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Transactions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [depositDialog, setDepositDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [searchSymbol, setSearchSymbol] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const isLoading = txLoading || tradesLoading;

  useEffect(() => {
    if (!portfolioId) return;

    const tradesChannel = supabase
      .channel(`realtime:tx-trades:${portfolioId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "trades",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
      })
      .subscribe();

    const txChannel = supabase
      .channel(`realtime:tx-transactions:${portfolioId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", portfolioId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(txChannel);
    };
  }, [portfolioId, queryClient]);

  const allActivity = useMemo(() => {
    const combined = [
      ...transactions
        .filter((t) => t.type !== "BUY" && t.type !== "SELL")
        .map((t) => ({
          ...t,
          _source: "transaction",
          _type: t.type,
          _symbol: null,
          _date: new Date(t.transaction_date),
        })),
      ...trades.map((t) => ({
        ...t,
        _source: "trade",
        _type: t.type,
        _symbol: t.symbol,
        _date: new Date(t.trade_date),
        transaction_date: t.trade_date,
      })),
    ].sort((a, b) => b._date - a._date);
    return combined;
  }, [transactions, trades]);

  const filtered = useMemo(() => {
    const cutoff = getDateCutoff(dateRange);
    return allActivity.filter((item) => {
      if (cutoff && item._date < cutoff) return false;
      if (typeFilter !== "all" && item._type !== typeFilter) return false;
      if (searchSymbol.trim()) {
        const q = searchSymbol.trim().toUpperCase();
        const sym = (item._symbol || item.symbol || "").toUpperCase();
        if (!sym.includes(q)) return false;
      }
      return true;
    });
  }, [allActivity, typeFilter, dateRange, searchSymbol]);

  const renderActivity = (item, index) => {
    const handleClick = () => setSelectedItem(item);

    if (item._source === "trade") {
      const isBuy = item.type === "BUY";
      return (
        <motion.div
          key={`trade-${item.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.3) }}
          onClick={handleClick}
          className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
                {isBuy
                  ? <ArrowDownLeft className="w-5 h-5 text-primary" />
                  : <ArrowUpRight className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {isBuy ? "Buy" : "Sell"} {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(item._date, "MMM d, yyyy • h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`font-semibold ${isBuy ? "text-primary" : "text-destructive"}`}>
                  {isBuy ? "+" : "-"}{Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  @${Number(item.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  {item.fees > 0 && ` · fee $${Number(item.fees).toFixed(2)}`}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusColor(item.status)}`}>
                {getStatusIcon(item.status)}
                <span className="text-xs font-medium capitalize">{item.status}</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
            </div>
          </div>
        </motion.div>
      );
    }

    if (item.type === "TRANSFER") {
      const isIn = item.transfer_direction === "IN";
      return (
        <motion.div
          key={`tx-${item.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.3) }}
          onClick={handleClick}
          className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg ${isIn ? "bg-primary/10" : "bg-secondary/50"}`}>
                {isIn
                  ? <ArrowDownLeft className="w-5 h-5 text-primary" />
                  : <ArrowUpRight className="w-5 h-5 text-blue-400" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {isIn ? "Received" : "Sent"} · Internal Transfer
                </p>
                <p className="text-xs text-muted-foreground">
                  {isIn ? "From" : "To"}: <span className="font-medium text-foreground/80">@{item.counterparty_username || "—"}</span>
                </p>
                <p className="text-xs text-muted-foreground">{format(item._date, "MMM d, yyyy • h:mm a")}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`font-semibold ${isIn ? "text-primary" : "text-blue-400"}`}>
                  {isIn ? "+" : "−"}${Number(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Instant · Free</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Completed</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
            </div>
          </div>
          {item.notes && (
            <div className="mt-2 pl-14 text-xs text-muted-foreground italic">{item.notes}</div>
          )}
        </motion.div>
      );
    }

    const typeLabel = item.type === "WITHDRAWAL" ? "Withdrawal"
      : item.type === "DEPOSIT" ? "Deposit"
      : item.type;
    const isDeposit = item.type === "DEPOSIT";

    return (
      <motion.div
        key={`tx-${item.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.3) }}
        onClick={handleClick}
        className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
              {isDeposit
                ? <ArrowDownLeft className="w-5 h-5 text-primary" />
                : <ArrowUpRight className="w-5 h-5 text-yellow-400" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{typeLabel}</p>
              <p className="text-xs text-muted-foreground">
                {format(item._date, "MMM d, yyyy • h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`font-semibold ${isDeposit ? "text-primary" : "text-foreground"}`}>
                {isDeposit ? "+" : ""}{item.total_amount != null
                  ? `$${Number(item.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : "-"}
              </p>
              {item.payment_method && (
                <p className="text-xs text-muted-foreground capitalize">
                  {METHOD_LABELS[item.payment_method] || item.payment_method}
                </p>
              )}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusColor(item.status)}`}>
              {getStatusIcon(item.status)}
              <span className="text-xs font-medium capitalize">{item.status}</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
          </div>
        </div>
        {item.notes && (
          <div className="mt-3 pl-14 text-xs text-muted-foreground italic">{item.notes}</div>
        )}
        {item.admin_message && (
          <div className="mt-3 pl-14 flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">Message from our team</p>
              <p className="text-xs text-foreground">{item.admin_message}</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const hasActiveFilters = typeFilter !== "all" || dateRange !== "all" || searchSymbol.trim();

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("No transactions to export"); return; }
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Date", "Type", "Symbol", "Quantity", "Price Per Unit", "Total Amount", "Fee", "Status", "Notes"];
    const rows = filtered.map((item) => {
      if (item._source === "trade") {
        return [
          format(item._date, "yyyy-MM-dd HH:mm:ss"),
          item.type,
          item.symbol || "",
          item.quantity ?? "",
          item.unit_price ?? "",
          ((item.quantity || 0) * (item.unit_price || 0)).toFixed(2),
          item.fees ?? 0,
          item.status || "completed",
          item.notes || "",
        ];
      }
      return [
        format(item._date, "yyyy-MM-dd HH:mm:ss"),
        item.type,
        item.symbol || "",
        item.quantity ?? "",
        item.price_per_unit ?? "",
        item.total_amount ?? "",
        "",
        item.status || "",
        item.notes || "",
      ];
    });
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `blocktrade-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} transactions`);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Transactions</h1>
            <p className="text-muted-foreground text-sm">All trades, deposits, and withdrawals · Click any row to view details</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={exportCSV}
              variant="outline"
              className="border-border/60 hover:border-primary/40 hover:text-primary gap-2"
              disabled={!portfolioId || filtered.length === 0}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={() => setDepositDialog(true)}
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/5"
              disabled={!portfolioId}
            >
              Add Funds
            </Button>
            <Button
              onClick={() => navigate("/withdrawal")}
              className="bg-primary hover:bg-primary/90"
              disabled={!portfolioId}
            >
              <Send className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
            <Button
              onClick={() => setTransferDialog(true)}
              variant="outline"
              className="border-border/60 hover:border-primary/40 hover:text-primary"
              disabled={!portfolioId}
            >
              <ArrowUpRight className="w-4 h-4 mr-2 rotate-45" />
              Send to User
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 bg-card rounded-xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={() => { setTypeFilter("all"); setDateRange("all"); setSearchSymbol(""); }}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by coin (BTC, ETH…)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="pl-8 bg-secondary/50 border-border/50 h-9 text-sm"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDateRange(r.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    dateRange === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> result{filtered.length !== 1 ? "s" : ""}
            {allActivity.length !== filtered.length && (
              <span>of {allActivity.length} total</span>
            )}
          </div>
        </div>

        {/* Activity list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {allActivity.length === 0
                ? "No activity yet. Start trading to see your history here."
                : "No results match your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, index) => renderActivity(item, index))}
          </div>
        )}

        <DepositDialog open={depositDialog} onClose={() => setDepositDialog(false)} />
        <TransferDialog open={transferDialog} onClose={() => setTransferDialog(false)} />

        {/* Transaction Detail Modal */}
        {selectedItem && (
          <TransactionDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </div>
  );
}
