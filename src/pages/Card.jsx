import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CreditCard, PlusCircle, Trash2, Star, Lock,
  Eye, EyeOff, Copy, CheckCircle2, Building2, Wallet2,
  ArrowDownLeft, ArrowUpRight, Clock, Loader2, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { listPaymentMethods, deletePaymentMethod, setDefaultPaymentMethod } from "@/lib/api/paymentMethods";
import { listDepositRequests } from "@/lib/api/deposits";
import AddPaymentMethodDialog from "@/components/crypto/AddPaymentMethodDialog";
import AddFundsFlow from "@/components/crypto/AddFundsFlow";
import WithdrawalSidebar from "@/components/crypto/WithdrawalSidebar";
import { toast } from '@/lib/toast';
import { format, parseISO } from "date-fns";

const BRAND_LABEL  = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };
const BRAND_COLOR  = { visa: "from-blue-600 to-blue-800", mastercard: "from-red-600 to-orange-600", amex: "from-blue-500 to-cyan-600", discover: "from-orange-500 to-yellow-600" };
const TYPE_ICON    = { card: CreditCard, bank_account: Building2, paypal: Wallet2 };
const STATUS_COLOR = { completed: "text-primary", pending: "text-yellow-400", processing: "text-blue-400", failed: "text-destructive", cancelled: "text-muted-foreground" };
const STATUS_LABEL = { completed: "Completed", pending: "Pending", processing: "Processing", failed: "Failed", cancelled: "Cancelled" };

function generateCardDetails(userId) {
  const hex = userId.replace(/-/g, "");
  const hexToDigit = (c) => (parseInt(c, 16) % 10).toString();
  const digits = hex.split("").map(hexToDigit).join("");
  const cardDigits = "4" + digits.slice(0, 15);
  const cardNo = `${cardDigits.slice(0,4)} ${cardDigits.slice(4,8)} ${cardDigits.slice(8,12)} ${cardDigits.slice(12,16)}`;
  const expYear = 2028 + (parseInt(digits[16] || "0") % 5);
  const monthNum = (parseInt(digits[17] || "0") % 12) + 1;
  const expiry = `${String(monthNum).padStart(2, "0")}/${String(expYear).slice(-2)}`;
  const cvv = digits.slice(18, 21).padStart(3, "0");
  const last4 = cardDigits.slice(12, 16);
  return { cardNo, expiry, cvv, last4 };
}

function VirtualCardDisplay({ user, cashBalance }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [cardDetails, setCardDetails] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    const saved = user?.user_metadata?.virtual_card;
    if (saved?.cardNo && saved?.expiry && saved?.cvv) {
      setCardDetails(saved);
      return;
    }
    const details = generateCardDetails(user.id);
    setCardDetails(details);
    supabase.auth.updateUser({ data: { virtual_card: details } }).catch(() => {});
  }, [user?.id]);

  const cardNo  = cardDetails?.cardNo  || "•••• •••• •••• ••••";
  const last4   = cardDetails?.last4   || "••••";
  const expiry  = cardDetails?.expiry  || "••/••";
  const cvv     = cardDetails?.cvv     || "•••";
  const fullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const copy = () => {
    navigator.clipboard.writeText(cardNo.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-cyan-500/10 to-primary/10 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-2xl p-6 text-white overflow-hidden border border-indigo-500/20 shadow-2xl">
        {/* Background circles */}
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="white" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold opacity-60 uppercase tracking-widest">BlockTrade</p>
            <p className="text-sm font-bold mt-0.5">Virtual Card</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowDetails(!showDetails)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title={showDetails ? "Hide details" : "Show details"}>
              {showDetails ? <EyeOff className="w-4 h-4 opacity-70" /> : <Eye className="w-4 h-4 opacity-70" />}
            </button>
            <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Copy card number">
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 opacity-70" />}
            </button>
          </div>
        </div>

        {/* Card number */}
        <p className="font-mono text-xl tracking-widest mb-6 opacity-90">
          {showDetails ? cardNo : "•••• •••• •••• " + last4}
        </p>

        {/* Footer row */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">Card Holder</p>
            <p className="font-semibold">{fullName.toUpperCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">Expires</p>
            <p className="font-mono font-semibold">{expiry}</p>
          </div>
          <div className="text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">CVV</p>
            <p className="font-mono font-semibold">{showDetails ? cvv : "•••"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">Balance</p>
            <p className="font-bold text-lg">
              ${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Chip */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>
    </motion.div>
  );
}

function PaymentMethodCard({ method, onDelete, onSetDefault, isBusy }) {
  const Icon = TYPE_ICON[method.type] || CreditCard;
  const gradient = method.type === "card" ? (BRAND_COLOR[method.card_brand] || "from-slate-600 to-slate-800") : "from-slate-600 to-slate-800";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-border transition-colors bg-card/50"
    >
      <div className={`w-12 h-8 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {method.type === "card" && (
          <>
            <p className="text-sm font-semibold">{BRAND_LABEL[method.card_brand] || "Card"} ••••{method.card_last_four}</p>
            <p className="text-xs text-muted-foreground">{method.card_holder_name} · Exp {String(method.expiry_month).padStart(2,"0")}/{String(method.expiry_year).slice(-2)}</p>
          </>
        )}
        {method.type === "bank_account" && (
          <>
            <p className="text-sm font-semibold">{method.bank_name} ••••{method.account_last_four}</p>
            <p className="text-xs text-muted-foreground">{method.account_holder}</p>
          </>
        )}
        {method.type === "paypal" && (
          <>
            <p className="text-sm font-semibold">PayPal</p>
            <p className="text-xs text-muted-foreground">{method.paypal_email}</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {method.is_default && (
          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">Default</span>
        )}
        {!method.is_default && (
          <button
            onClick={() => onSetDefault(method.id)}
            disabled={isBusy}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
            title="Set as default"
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(method.id)}
          disabled={isBusy}
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function DepositHistoryItem({ req }) {
  const date = req.created_at ? format(parseISO(req.created_at), "MMM d, yyyy · h:mm a") : "—";
  const pm   = req.payment_methods;
  let methodLabel = "Direct";
  if (pm) {
    if (pm.type === "card")         methodLabel = `${BRAND_LABEL[pm.card_brand] || "Card"} ••••${pm.card_last_four}`;
    else if (pm.type === "bank_account") methodLabel = `${pm.bank_name} ••••${pm.account_last_four}`;
    else if (pm.type === "paypal")  methodLabel = `PayPal (${pm.paypal_email})`;
  }
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        req.status === "completed" ? "bg-primary/10" : req.status === "failed" ? "bg-destructive/10" : "bg-secondary/50"
      }`}>
        {req.status === "completed" ? <ArrowDownLeft className="w-4 h-4 text-primary" />
          : req.status === "failed" ? <ArrowUpRight className="w-4 h-4 text-destructive" />
          : <Clock className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">${req.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        <p className="text-xs text-muted-foreground truncate">{methodLabel} · {date}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-xs font-semibold ${STATUS_COLOR[req.status] || "text-muted-foreground"}`}>
          {STATUS_LABEL[req.status] || req.status}
        </span>
        {req.reference_code && (
          <p className="text-xs text-muted-foreground font-mono">{req.reference_code}</p>
        )}
      </div>
    </div>
  );
}

export default function Card() {
  const { user }                            = useAuth();
  const { portfolioId, cashBalance }        = usePortfolio();
  const queryClient                         = useQueryClient();
  const [addMethodOpen, setAddMethodOpen]   = useState(false);
  const [addFundsOpen, setAddFundsOpen]     = useState(false);
  const [withdrawOpen, setWithdrawOpen]     = useState(false);
  const [busyId, setBusyId]                 = useState(null);

  const { data: methods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn:  () => listPaymentMethods(user?.id),
    enabled:  !!user?.id,
    initialData: [],
  });

  const { data: deposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ["deposit-requests", portfolioId],
    queryFn:  () => listDepositRequests(portfolioId, 10),
    enabled:  !!portfolioId,
    initialData: [],
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["deposit-requests", portfolioId] });
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await deletePaymentMethod(id);
      queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
      toast.success("Payment method removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove");
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id) => {
    if (!user) return;
    setBusyId(id);
    try {
      await setDefaultPaymentMethod(id, user.id);
      queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
      toast.success("Default payment method updated");
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Card</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your virtual card and payment methods</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Secured</span>
        </div>
      </div>

      {/* Virtual Card */}
      <VirtualCardDisplay user={user} cashBalance={cashBalance} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setAddFundsOpen(true)}
          className="bg-primary hover:bg-primary/90 font-semibold"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Funds
        </Button>
        <Button
          variant="outline"
          onClick={() => setWithdrawOpen(true)}
          className="border-border/50"
        >
          <Send className="w-4 h-4 mr-2" />
          Withdraw
        </Button>
      </div>

      {/* Payment Methods */}
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground">Payment Methods</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Saved cards and accounts for deposits</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddMethodOpen(true)}
            className="text-xs border-border/50"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            Add New
          </Button>
        </div>

        {methodsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No payment methods saved yet.</p>
            <Button size="sm" variant="outline" onClick={() => setAddMethodOpen(true)} className="text-xs">
              <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Your First Card
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map(m => (
              <PaymentMethodCard
                key={m.id}
                method={m}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                isBusy={busyId === m.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Deposit History */}
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Deposit History</h2>
        <p className="text-xs text-muted-foreground mb-4">Recent fund additions to your account</p>

        {depositsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No deposits yet. Add funds to get started.</p>
          </div>
        ) : (
          <div>
            {deposits.map(req => (
              <DepositHistoryItem key={req.id} req={req} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPaymentMethodDialog
        open={addMethodOpen}
        onClose={() => setAddMethodOpen(false)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] })}
      />
      <AddFundsFlow
        open={addFundsOpen}
        onClose={() => setAddFundsOpen(false)}
        paymentMethods={methods}
        onMethodAdded={() => queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] })}
        onSuccess={refetchAll}
      />
      <WithdrawalSidebar open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
