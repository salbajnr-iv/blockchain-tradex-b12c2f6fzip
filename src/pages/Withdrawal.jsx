import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Wallet, ShieldCheck, AlertCircle, CheckCircle2,
  Clock, XCircle, Send, Lock, CreditCard, Globe, Building2,
  Bitcoin, Info, Loader2, RefreshCw, MessageSquare, DollarSign, TrendingUp, X,
} from "lucide-react";
import {
  createWithdrawalRequest,
  getUserKycStatus,
  subscribeToWithdrawalStatus,
} from "@/lib/api/withdrawal";

const WITHDRAWAL_METHODS = [
  { value: "bank_transfer",  label: "Bank Transfer",  icon: Building2,  desc: "1–3 business days" },
  { value: "crypto_wallet",  label: "Crypto Wallet",  icon: Bitcoin,    desc: "10–30 minutes" },
  { value: "paypal",         label: "PayPal",          icon: CreditCard, desc: "Instant – 24 hrs" },
  { value: "wire_transfer",  label: "Wire Transfer",   icon: Globe,      desc: "2–5 business days" },
];

const CRYPTO_NETWORKS = [
  { value: "ERC-20",  label: "Ethereum (ERC-20)" },
  { value: "TRC-20",  label: "Tron (TRC-20)" },
  { value: "BEP-20",  label: "BNB Smart Chain (BEP-20)" },
  { value: "BTC",     label: "Bitcoin (BTC)" },
  { value: "SOL",     label: "Solana (SOL)" },
];

const CRYPTO_COINS = [
  { value: "BTC",  label: "Bitcoin (BTC)" },
  { value: "ETH",  label: "Ethereum (ETH)" },
  { value: "USDT", label: "Tether (USDT)" },
  { value: "USDC", label: "USD Coin (USDC)" },
  { value: "BNB",  label: "BNB" },
  { value: "SOL",  label: "Solana (SOL)" },
];

const FIAT_CURRENCIES = [
  { value: "USD", label: "US Dollar",         symbol: "$",    flag: "🇺🇸" },
  { value: "EUR", label: "Euro",              symbol: "€",    flag: "🇪🇺" },
  { value: "GBP", label: "British Pound",     symbol: "£",    flag: "🇬🇧" },
  { value: "AUD", label: "Australian Dollar", symbol: "A$",   flag: "🇦🇺" },
  { value: "CAD", label: "Canadian Dollar",   symbol: "C$",   flag: "🇨🇦" },
  { value: "CHF", label: "Swiss Franc",       symbol: "Fr",   flag: "🇨🇭" },
  { value: "JPY", label: "Japanese Yen",      symbol: "¥",    flag: "🇯🇵" },
  { value: "SGD", label: "Singapore Dollar",  symbol: "S$",   flag: "🇸🇬" },
  { value: "AED", label: "UAE Dirham",        symbol: "د.إ",  flag: "🇦🇪" },
  { value: "INR", label: "Indian Rupee",      symbol: "₹",    flag: "🇮🇳" },
];

const CRYPTO_CURRENCIES = [
  { value: "BTC",  label: "Bitcoin",    symbol: "BTC",  coinId: "bitcoin" },
  { value: "ETH",  label: "Ethereum",   symbol: "ETH",  coinId: "ethereum" },
  { value: "USDT", label: "Tether",     symbol: "USDT", coinId: "tether" },
  { value: "USDC", label: "USD Coin",   symbol: "USDC", coinId: "usd-coin" },
  { value: "BNB",  label: "BNB",        symbol: "BNB",  coinId: "binancecoin" },
  { value: "SOL",  label: "Solana",     symbol: "SOL",  coinId: "solana" },
  { value: "XRP",  label: "XRP",        symbol: "XRP",  coinId: "ripple" },
  { value: "ADA",  label: "Cardano",    symbol: "ADA",  coinId: "cardano" },
  { value: "DOGE", label: "Dogecoin",   symbol: "DOGE", coinId: "dogecoin" },
  { value: "AVAX", label: "Avalanche",  symbol: "AVAX", coinId: "avalanche-2" },
];

function useFiatRates() {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchRates() {
      try {
        const res = await fetch("https://api.frankfurter.app/latest?base=USD");
        if (!res.ok) throw new Error("Failed to fetch rates");
        const data = await res.json();
        if (!cancelled) setRates(data.rates || {});
      } catch {
        if (!cancelled) setRates({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRates();
    const id = setInterval(fetchRates, 300000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { rates, loading };
}

const EU_COUNTRIES = new Set([
  "France","Germany","Netherlands","Spain","Italy","Belgium","Austria","Portugal",
  "Ireland","Denmark","Sweden","Finland","Norway","Switzerland","Luxembourg",
  "Poland","Czech Republic","Hungary","Romania","Greece","Croatia",
]);

function getCountryBankFields(country) {
  if (!country) return "international";
  if (country === "United States") return "us";
  if (country === "United Kingdom") return "uk";
  if (country === "Australia" || country === "New Zealand") return "au";
  if (country === "Canada") return "ca";
  if (EU_COUNTRIES.has(country)) return "eu";
  return "international";
}

function BankFields({ country, values, onChange }) {
  const variant = getCountryBankFields(country);
  const field = (key, label, placeholder, type = "text") => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label} <span className="text-destructive">*</span></label>
      <Input
        type={type}
        placeholder={placeholder}
        value={values[key] || ""}
        onChange={(e) => onChange(key, e.target.value)}
        className="bg-secondary/40 border-border"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {field("accountName", "Account Holder Name", "Full legal name as on account")}
      {field("bankName", "Bank Name", "e.g. Chase, HSBC, Barclays")}

      {variant === "us" && (
        <>
          {field("routingNumber", "Routing Number", "9-digit ABA routing number")}
          {field("accountNumber", "Account Number", "Checking or savings account number")}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Account Type <span className="text-destructive">*</span></label>
            <Select value={values.accountType || ""} onValueChange={(v) => onChange("accountType", v)}>
              <SelectTrigger className="bg-secondary/40 border-border">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {variant === "uk" && (
        <>
          {field("sortCode", "Sort Code", "XX-XX-XX (6 digits)")}
          {field("accountNumber", "Account Number", "8-digit account number")}
        </>
      )}

      {variant === "au" && (
        <>
          {field("bsb", "BSB Number", "XXX-XXX (6 digits)")}
          {field("accountNumber", "Account Number", "Bank account number")}
        </>
      )}

      {variant === "ca" && (
        <>
          {field("transitNumber", "Transit Number", "5-digit transit number")}
          {field("institutionNumber", "Institution Number", "3-digit institution number")}
          {field("accountNumber", "Account Number", "Account number")}
        </>
      )}

      {(variant === "eu" || variant === "international") && (
        <>
          {field("iban", "IBAN", "e.g. DE89370400440532013000")}
          {field("swift", "BIC / SWIFT Code", "e.g. DEUTDEDB")}
          {variant === "international" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>For international transfers, IBAN and SWIFT/BIC codes are required. Contact your bank if unsure.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CryptoFields({ values, onChange, lockedCoin }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Cryptocurrency <span className="text-destructive">*</span></label>
        {lockedCoin ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
            {lockedCoin} <span className="text-xs text-muted-foreground font-normal ml-1">(selected via currency)</span>
          </div>
        ) : (
          <Select value={values.coin || ""} onValueChange={(v) => onChange("coin", v)}>
            <SelectTrigger className="bg-secondary/40 border-border">
              <SelectValue placeholder="Select cryptocurrency" />
            </SelectTrigger>
            <SelectContent>
              {CRYPTO_COINS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Network <span className="text-destructive">*</span></label>
        <Select value={values.network || ""} onValueChange={(v) => onChange("network", v)}>
          <SelectTrigger className="bg-secondary/40 border-border">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            {CRYPTO_NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Wallet Address <span className="text-destructive">*</span></label>
        <Input
          placeholder="0x... or bc1..."
          value={values.walletAddress || ""}
          onChange={(e) => onChange("walletAddress", e.target.value)}
          className="bg-secondary/40 border-border font-mono text-xs"
        />
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Double-check the wallet address and network. Crypto transfers are irreversible and cannot be recovered if sent to a wrong address.</span>
      </div>
    </div>
  );
}

function PayPalFields({ values, onChange }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">PayPal Email Address <span className="text-destructive">*</span></label>
        <Input
          type="email"
          placeholder="your@paypal-email.com"
          value={values.paypalEmail || ""}
          onChange={(e) => onChange("paypalEmail", e.target.value)}
          className="bg-secondary/40 border-border"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Confirm PayPal Email <span className="text-destructive">*</span></label>
        <Input
          type="email"
          placeholder="Confirm email address"
          value={values.paypalEmailConfirm || ""}
          onChange={(e) => onChange("paypalEmailConfirm", e.target.value)}
          className="bg-secondary/40 border-border"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Account Holder Name <span className="text-destructive">*</span></label>
        <Input
          placeholder="Name on PayPal account"
          value={values.accountName || ""}
          onChange={(e) => onChange("accountName", e.target.value)}
          className="bg-secondary/40 border-border"
        />
      </div>
    </div>
  );
}

function WireFields({ values, onChange }) {
  const field = (key, label, placeholder) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label} <span className="text-destructive">*</span></label>
      <Input
        placeholder={placeholder}
        value={values[key] || ""}
        onChange={(e) => onChange(key, e.target.value)}
        className="bg-secondary/40 border-border"
      />
    </div>
  );
  return (
    <div className="space-y-4">
      {field("accountName", "Beneficiary Name", "Full legal name")}
      {field("bankName", "Bank Name", "Full bank name")}
      {field("bankAddress", "Bank Address", "Street, City, Country")}
      {field("iban", "IBAN / Account Number", "e.g. DE89370400440532013000")}
      {field("swift", "SWIFT / BIC Code", "e.g. DEUTDEDB")}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Correspondent Bank <span className="text-muted-foreground text-xs ml-1">(optional)</span></label>
        <Input
          placeholder="Intermediary bank SWIFT code if required"
          value={values.correspondentBank || ""}
          onChange={(e) => onChange("correspondentBank", e.target.value)}
          className="bg-secondary/40 border-border"
        />
      </div>
      {field("reference", "Payment Reference", "Any specific reference for the wire")}
    </div>
  );
}

function StatusTracker({ transaction, onDone }) {
  const [txn, setTxn] = useState(transaction);

  useEffect(() => {
    if (!txn?.id) return;
    const unsubscribe = subscribeToWithdrawalStatus(txn.id, (updated) => {
      setTxn(updated);
    });
    return unsubscribe;
  }, [txn?.id]);

  const FINAL_STATUSES = ["completed", "failed", "cancelled", "rejected"];

  const steps = [
    { key: "submitted", label: "Request Submitted", done: true },
    { key: "pending",   label: "Pending Admin Review", done: txn?.status !== null },
    { key: "reviewed",  label: "Under Review", done: FINAL_STATUSES.includes(txn?.status) },
    { key: "final",     label: txn?.status === "completed" ? "Approved & Processed" : txn?.status === "rejected" ? "Rejected" : txn?.status === "failed" ? "Declined" : txn?.status === "cancelled" ? "Cancelled" : "Final Decision", done: FINAL_STATUSES.includes(txn?.status) },
  ];

  const statusMap = {
    pending:   { label: "Pending Review", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", icon: Clock },
    completed: { label: "Approved", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
    rejected:  { label: "Rejected", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: XCircle },
    failed:    { label: "Declined", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: XCircle },
    cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-secondary border-border", icon: XCircle },
  };

  const current = statusMap[txn?.status] || statusMap.pending;
  const StatusIcon = current.icon;
  const isDone = FINAL_STATUSES.includes(txn?.status);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center space-y-2">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${current.bg} ${current.color}`}>
          {!isDone ? <Loader2 className="w-4 h-4 animate-spin" /> : <StatusIcon className="w-4 h-4" />}
          {current.label}
        </div>
        <p className="text-muted-foreground text-sm">
          {!isDone
            ? "Your withdrawal request is being reviewed by our team."
            : txn?.status === "completed"
            ? "Your withdrawal has been approved and is being processed."
            : txn?.status === "rejected"
            ? "Your withdrawal request was rejected. Please review the message below and contact support if needed."
            : "Please contact support if you have any questions."}
        </p>
      </div>

      <div className="relative">
        {steps.map((step, i) => {
          const isCurrent = i === steps.filter(s => s.done).length - 1 && !isDone;
          const isComplete = i < steps.filter(s => s.done).length - (isDone ? 0 : 1);
          return (
            <div key={step.key} className="flex items-start gap-4 mb-4 last:mb-0">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                  isComplete ? "bg-primary border-primary" :
                  isCurrent ? "border-primary bg-primary/10" :
                  "border-border bg-secondary"
                }`}>
                  {isComplete ? <CheckCircle2 className="w-4 h-4 text-primary-foreground" /> :
                   isCurrent ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> :
                   <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-8 mt-1 ${isComplete ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-medium ${isComplete || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {txn?.admin_message && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-4 space-y-2 ${current.bg}`}>
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${current.color}`} />
            <span className={`text-sm font-semibold ${current.color}`}>Message from our team</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{txn.admin_message}</p>
        </motion.div>
      )}

      <div className="bg-secondary/40 rounded-xl border border-border p-4 space-y-2 text-sm">
        <p className="font-semibold text-foreground">Transaction Details</p>
        <div className="flex justify-between text-muted-foreground">
          <span>Reference ID</span>
          <span className="font-mono text-xs text-foreground">{txn?.id?.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Amount</span>
          <span className="text-foreground font-semibold">${parseFloat(txn?.total_amount || 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Method</span>
          <span className="text-foreground capitalize">{txn?.payment_method?.replace("_", " ")}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Submitted</span>
          <span className="text-foreground">{txn?.transaction_date ? new Date(txn.transaction_date).toLocaleDateString() : "—"}</span>
        </div>
        {txn?.reviewed_at && (
          <div className="flex justify-between text-muted-foreground">
            <span>Reviewed</span>
            <span className="text-foreground">{new Date(txn.reviewed_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {isDone && (
        <Button onClick={onDone} className="w-full">
          Back to Transactions
        </Button>
      )}
    </motion.div>
  );
}

function validateMethodDetails(method, details) {
  if (method === "bank_transfer") {
    if (!details.accountName) return "Account holder name is required";
    if (!details.bankName) return "Bank name is required";
    const variant = getCountryBankFields(details._country);
    if (variant === "us") {
      if (!details.routingNumber) return "Routing number is required";
      if (!details.accountNumber) return "Account number is required";
      if (!details.accountType) return "Account type is required";
    } else if (variant === "uk") {
      if (!details.sortCode) return "Sort code is required";
      if (!details.accountNumber) return "Account number is required";
    } else if (variant === "au") {
      if (!details.bsb) return "BSB number is required";
      if (!details.accountNumber) return "Account number is required";
    } else if (variant === "ca") {
      if (!details.transitNumber) return "Transit number is required";
      if (!details.institutionNumber) return "Institution number is required";
      if (!details.accountNumber) return "Account number is required";
    } else {
      if (!details.iban) return "IBAN is required";
      if (!details.swift) return "SWIFT/BIC code is required";
    }
  } else if (method === "crypto_wallet") {
    if (!details.coin) return "Please select a cryptocurrency";
    if (!details.network) return "Please select a network";
    if (!details.walletAddress) return "Wallet address is required";
  } else if (method === "paypal") {
    if (!details.paypalEmail) return "PayPal email is required";
    if (!details.paypalEmailConfirm) return "Please confirm your PayPal email";
    if (details.paypalEmail !== details.paypalEmailConfirm) return "PayPal email addresses do not match";
    if (!details.accountName) return "Account holder name is required";
  } else if (method === "wire_transfer") {
    if (!details.accountName) return "Beneficiary name is required";
    if (!details.bankName) return "Bank name is required";
    if (!details.bankAddress) return "Bank address is required";
    if (!details.iban) return "IBAN / Account number is required";
    if (!details.swift) return "SWIFT/BIC code is required";
    if (!details.reference) return "Payment reference is required";
  }
  return null;
}

export default function WithdrawalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { cashBalance, portfolioId } = usePortfolio();
  const { cryptoList } = useLivePrices();
  const { rates: fiatRates, loading: fiatLoading } = useFiatRates();

  const [method, setMethod] = useState(searchParams.get("method") || "");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedTxn, setSubmittedTxn] = useState(null);

  const SAVED_DEST_KEY = `blocktrade_saved_destinations_${user?.id || ""}`;
  const [savedDestinations, setSavedDestinations] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_DEST_KEY) || "[]"); } catch { return []; }
  });
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [destLabel, setDestLabel] = useState("");

  const [currencyType, setCurrencyType] = useState("fiat");
  const [currency, setCurrency] = useState("USD");

  const userCountry = user?.user_metadata?.country || "";

  const selectedFiat   = FIAT_CURRENCIES.find(c => c.value === currency);
  const selectedCrypto = CRYPTO_CURRENCIES.find(c => c.value === currency);

  const STABLECOIN_PRICE = { USDT: 1.0, USDC: 1.0 };
  const cryptoPrice = selectedCrypto
    ? (cryptoList.find(c => c.symbol === selectedCrypto.value)?.price
       ?? STABLECOIN_PRICE[selectedCrypto.value]
       ?? 0)
    : 0;

  const fiatRate = currency === "USD" ? 1 : (fiatRates[currency] ?? 0);

  const parsedAmount = parseFloat(amount) || 0;

  const usdEquivalent = parsedAmount === 0
    ? 0
    : currencyType === "crypto"
    ? (cryptoPrice > 0 ? parsedAmount * cryptoPrice : 0)
    : (currency === "USD"
      ? parsedAmount
      : (fiatRate > 0 ? parsedAmount / fiatRate : 0));

  const feeUsd    = usdEquivalent * 0.02;
  const netUsd    = usdEquivalent - feeUsd;
  const netInCurrency = currencyType === "crypto"
    ? (cryptoPrice > 0 ? netUsd / cryptoPrice : 0)
    : (currency === "USD" ? netUsd : netUsd * fiatRate);

  const currencySymbol = currencyType === "crypto"
    ? (selectedCrypto?.symbol ?? "")
    : (selectedFiat?.symbol ?? "$");

  const handleCurrencyTypeChange = (type) => {
    setCurrencyType(type);
    setCurrency(type === "fiat" ? "USD" : "BTC");
    setAmount("");
    if (type === "crypto") {
      setMethod("crypto_wallet");
      setDetails({});
    } else {
      setMethod("");
      setDetails({});
    }
  };

  const handleCurrencyChange = (cur) => {
    setCurrency(cur);
    setAmount("");
    if (currencyType === "crypto") {
      setMethod("crypto_wallet");
      setDetails({ coin: cur });
    }
  };

  const { data: kycStatus, isLoading: kycLoading } = useQuery({
    queryKey: ["kyc-status", user?.id],
    queryFn: getUserKycStatus,
    enabled: !!user?.id,
  });

  const kycApproved = kycStatus?.status === "approved";
  const kycPending = kycStatus?.status === "pending" || kycStatus?.status === "under_review";

  const hasSufficientBalance = usdEquivalent > 0 && usdEquivalent <= cashBalance;
  const methodSelected = !!method;

  const handleDetailChange = useCallback((key, value) => {
    setDetails(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleMethodChange = (val) => {
    if (currencyType === "crypto") return;
    setMethod(val);
    setDetails({ _country: userCountry });
  };

  const saveDestination = () => {
    if (!destLabel.trim() || !method) return;
    const dest = {
      id: Date.now().toString(),
      label: destLabel.trim(),
      method,
      details: { ...details },
      currencyType,
      currency,
    };
    const updated = [dest, ...savedDestinations.slice(0, 9)];
    setSavedDestinations(updated);
    localStorage.setItem(SAVED_DEST_KEY, JSON.stringify(updated));
    setDestLabel("");
    setShowSaveForm(false);
    toast.success("Destination saved!");
  };

  const loadDestination = (dest) => {
    setCurrencyType(dest.currencyType);
    setCurrency(dest.currency);
    setMethod(dest.method);
    setDetails(dest.details);
    if (dest.currencyType === "crypto") setMethod("crypto_wallet");
    toast.success(`Loaded: ${dest.label}`);
  };

  const deleteDestination = (id) => {
    const updated = savedDestinations.filter((d) => d.id !== id);
    setSavedDestinations(updated);
    localStorage.setItem(SAVED_DEST_KEY, JSON.stringify(updated));
    toast.success("Destination removed");
  };

  useEffect(() => {
    if (userCountry && currencyType === "fiat") {
      setDetails(prev => ({ ...prev, _country: userCountry }));
    }
  }, [userCountry, currencyType]);

  const handleSubmit = async () => {
    if (!kycApproved) {
      toast.error("KYC verification required before withdrawing funds");
      return;
    }
    if (!method) {
      toast.error("Please select a withdrawal method");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (usdEquivalent <= 0) {
      toast.error("Unable to compute USD equivalent — please try again shortly");
      return;
    }
    if (!hasSufficientBalance) {
      toast.error("Insufficient balance for this withdrawal");
      return;
    }
    const validationError = validateMethodDetails(method, details);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const methodLabel = WITHDRAWAL_METHODS.find(m => m.value === method)?.label || method;
      const currencyLabel = currencyType === "crypto"
        ? `${parsedAmount} ${currency}`
        : currency === "USD"
        ? `$${parsedAmount} USD`
        : `${currencySymbol}${parsedAmount} ${currency} (~$${usdEquivalent.toFixed(2)} USD)`;

      const txn = await createWithdrawalRequest(portfolioId, {
        amount: usdEquivalent,
        method,
        withdrawalDetails: {
          ...details,
          withdrawCurrency: currency,
          withdrawCurrencyType: currencyType,
          withdrawAmount: parsedAmount,
          withdrawUsdEquivalent: usdEquivalent,
        },
        notes: `Withdrawal of ${currencyLabel} via ${methodLabel}`,
      });
      setSubmittedTxn(txn);
      toast.success("Withdrawal request submitted successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to submit withdrawal request");
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = kycApproved && methodSelected && parsedAmount > 0 && usdEquivalent > 0 && hasSufficientBalance && !submitting;

  if (submittedTxn) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/transactions")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Withdrawal Request</h1>
              <p className="text-sm text-muted-foreground">Track your withdrawal status</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Withdrawal Submitted</p>
                <p className="text-xs text-muted-foreground">We will process your request shortly</p>
              </div>
            </div>
            <StatusTracker transaction={submittedTxn} onDone={() => navigate("/transactions")} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Withdraw Funds</h1>
            <p className="text-sm text-muted-foreground">Submit a secure withdrawal request</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${kycApproved ? "bg-green-500/5 border-green-500/20" : kycPending ? "bg-yellow-500/5 border-yellow-500/20" : "bg-destructive/5 border-destructive/20"}`}>
            <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${kycApproved ? "text-green-500" : kycPending ? "text-yellow-500" : "text-destructive"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">KYC Status</p>
              {kycLoading ? <p className="text-xs text-muted-foreground">Checking...</p>
                : kycApproved ? <p className="text-xs text-green-600 dark:text-green-400 font-medium">Verified ✓</p>
                : kycPending ? <p className="text-xs text-yellow-600 dark:text-yellow-400">Under Review</p>
                : <p className="text-xs text-destructive">Not Verified</p>}
            </div>
          </div>

          <div className={`rounded-xl border p-4 flex items-start gap-3 ${hasSufficientBalance || !parsedAmount ? "bg-secondary/40 border-border" : "bg-destructive/5 border-destructive/20"}`}>
            <Wallet className={`w-5 h-5 mt-0.5 shrink-0 ${!parsedAmount || hasSufficientBalance ? "text-primary" : "text-destructive"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">Available Balance</p>
              <p className="text-xs text-muted-foreground font-mono">${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-start gap-3">
            <Globe className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Country</p>
              <p className="text-xs text-muted-foreground">{userCountry || "Not set in profile"}</p>
            </div>
          </div>
        </div>

        {!kycApproved && !kycLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-xl border p-4 flex items-start gap-3 ${kycPending ? "bg-yellow-500/10 border-yellow-500/30" : "bg-destructive/10 border-destructive/30"}`}>
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${kycPending ? "text-yellow-500" : "text-destructive"}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${kycPending ? "text-yellow-700 dark:text-yellow-400" : "text-destructive"}`}>
                {kycPending ? "KYC Verification Pending" : "KYC Verification Required"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {kycPending
                  ? "Your identity verification is currently under review. You will be able to withdraw once it is approved."
                  : "You must complete identity verification before you can withdraw funds. This helps us keep your account secure."}
              </p>
              {!kycPending && (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => navigate("/settings/kyc")}>
                  Complete KYC Verification
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Currency Selection ── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-semibold text-foreground">Withdrawal Currency</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select the currency you want to receive</p>
          </div>
          <div className="p-6 space-y-4">
            {/* Fiat / Crypto tab */}
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl w-fit">
              {[
                { type: "fiat",   icon: DollarSign, label: "Fiat Currencies" },
                { type: "crypto", icon: TrendingUp,  label: "Cryptocurrencies" },
              ].map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => handleCurrencyTypeChange(type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currencyType === type
                      ? "bg-card border border-border text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Currency grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(currencyType === "fiat" ? FIAT_CURRENCIES : CRYPTO_CURRENCIES).map((cur) => {
                const selected = currency === cur.value;
                const liveEntry = currencyType === "crypto"
                  ? cryptoList.find(c => c.symbol === cur.value)
                  : null;
                const stablePrice = { USDT: 1.0, USDC: 1.0 }[cur.value];
                const priceHint = currencyType === "crypto"
                  ? (liveEntry
                    ? `$${liveEntry.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    : stablePrice != null ? `$${stablePrice.toFixed(2)}` : "…")
                  : (cur.value !== "USD" && fiatRates[cur.value]
                    ? `${fiatRates[cur.value].toFixed(2)} / $1`
                    : null);
                return (
                  <button
                    key={cur.value}
                    onClick={() => handleCurrencyChange(cur.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <p className="text-base mb-0.5">{cur.flag ?? cur.symbol}</p>
                    <p className={`text-xs font-bold ${selected ? "text-primary" : "text-foreground"}`}>{cur.value}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{cur.label}</p>
                    {priceHint && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{priceHint}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Withdrawal Method (fiat only) ── */}
        {currencyType === "fiat" && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Withdrawal Method</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Select how you want to receive your funds</p>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {WITHDRAWAL_METHODS.map((m) => {
                const Icon = m.icon;
                const selected = method === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => handleMethodChange(m.value)}
                    className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${selected ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50"}`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className={`text-xs font-semibold leading-tight ${selected ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Saved Destinations ── */}
        {savedDestinations.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Saved Destinations</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Load a previously saved withdrawal destination</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {savedDestinations.map((dest) => {
                const methodMeta = WITHDRAWAL_METHODS.find(m => m.value === dest.method);
                const DestIcon = methodMeta?.icon;
                return (
                  <div key={dest.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {DestIcon && <DestIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{dest.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {dest.currencyType === "crypto" ? `${dest.currency} Wallet` : `${methodMeta?.label ?? dest.method} • ${dest.currency}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => loadDestination(dest)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-all"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteDestination(dest.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Method Details ── */}
        <AnimatePresence mode="wait">
          {method && (
            <motion.div key={`${method}-${currency}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {currencyType === "crypto"
                      ? `${currency} Wallet Details`
                      : `${WITHDRAWAL_METHODS.find(m => m.value === method)?.label} Details`}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {method === "bank_transfer" && userCountry
                      ? `Fields tailored for ${userCountry}`
                      : "Please provide your receiving account details"}
                  </p>
                </div>
                <button
                  onClick={() => setShowSaveForm((p) => !p)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shrink-0 mt-0.5"
                >
                  {showSaveForm ? "Cancel" : "Save destination"}
                </button>
              </div>
              <AnimatePresence>
                {showSaveForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center gap-3"
                  >
                    <Input
                      placeholder='Label, e.g. "My Chase Account"'
                      value={destLabel}
                      onChange={(e) => setDestLabel(e.target.value)}
                      className="bg-background border-border text-sm h-9 flex-1"
                    />
                    <button
                      onClick={saveDestination}
                      disabled={!destLabel.trim()}
                      className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all disabled:opacity-50 h-9"
                    >
                      Save
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="p-6">
                {method === "bank_transfer" && <BankFields country={userCountry} values={details} onChange={handleDetailChange} />}
                {method === "crypto_wallet" && <CryptoFields values={details} onChange={handleDetailChange} lockedCoin={currencyType === "crypto" ? currency : null} />}
                {method === "paypal" && <PayPalFields values={details} onChange={handleDetailChange} />}
                {method === "wire_transfer" && <WireFields values={details} onChange={handleDetailChange} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Amount ── */}
        {method && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Withdrawal Amount</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your USD balance: <span className="text-foreground font-medium">${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Amount ({currencyType === "crypto" ? currency : currency})
                  <span className="text-destructive ml-1">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                    {currencyType === "fiat" ? (selectedFiat?.symbol ?? "$") : ""}
                  </span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`bg-secondary/40 border-border text-base font-medium ${currencyType === "fiat" ? "pl-7" : "pl-3"}`}
                    min="0"
                    step={currencyType === "crypto" ? "0.00000001" : "0.01"}
                  />
                  {currencyType === "crypto" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{currency}</span>
                  )}
                </div>
                {/* % shortcuts based on USD balance → target currency conversion */}
                {currencyType === "fiat" && (
                  <div className="flex gap-2 mt-1">
                    {[25, 50, 75, 100].map((pct) => {
                      const pctUsd = cashBalance * pct / 100;
                      const pctVal = currency === "USD" ? pctUsd : (fiatRate > 0 ? pctUsd * fiatRate : 0);
                      return (
                        <button
                          key={pct}
                          onClick={() => setAmount(pctVal > 0 ? pctVal.toFixed(2) : "")}
                          disabled={pctVal <= 0}
                          className="text-xs px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors border border-border disabled:opacity-40"
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                )}
                {parsedAmount > 0 && !hasSufficientBalance && usdEquivalent > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Amount exceeds available USD balance
                  </p>
                )}
                {parsedAmount > 0 && currencyType === "crypto" && cryptoPrice <= 0 && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Live price unavailable — cannot compute USD equivalent
                  </p>
                )}
                {parsedAmount > 0 && currencyType === "fiat" && currency !== "USD" && fiatRate <= 0 && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Exchange rate unavailable — please try again
                  </p>
                )}
              </div>

              {parsedAmount > 0 && usdEquivalent > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-secondary/30 rounded-xl border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">You Send ({currency})</span>
                      <span className="font-semibold">
                        {currencyType === "fiat"
                          ? `${selectedFiat?.symbol ?? ""}${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : `${parsedAmount.toLocaleString("en-US", { maximumSignificantDigits: 8 })} ${currency}`}
                      </span>
                    </div>
                    {currency !== "USD" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">USD Equivalent</span>
                        <span className="font-medium text-muted-foreground">≈ ${usdEquivalent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing Fee (2%)</span>
                      <span className="font-semibold text-destructive">−${feeUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-semibold text-sm">You Receive</span>
                      <span className="font-bold text-lg text-primary">
                        {currencyType === "fiat"
                          ? `${selectedFiat?.symbol ?? ""}${netInCurrency.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : `${netInCurrency.toLocaleString("en-US", { maximumSignificantDigits: 8 })} ${currency}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/60">
                      <span>Deducted from USD balance</span>
                      <span>${usdEquivalent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {method && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                All withdrawal requests are manually reviewed by our compliance team. Processing times depend on the method selected. Once submitted, you can track the status in your transaction history.
              </p>
            </div>

            <div className="space-y-2">
              {!kycApproved && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <XCircle className="w-4 h-4" /> KYC verification required
                </div>
              )}
              {!parsedAmount && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-4 h-4" /> Enter a withdrawal amount
                </div>
              )}
              {parsedAmount > 0 && !hasSufficientBalance && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <XCircle className="w-4 h-4" /> Insufficient balance
                </div>
              )}
              {kycApproved && parsedAmount > 0 && hasSufficientBalance && (
                <div className="flex items-center gap-2 text-xs text-green-500">
                  <CheckCircle2 className="w-4 h-4" /> All checks passed — ready to proceed
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!canProceed}
              className="w-full h-12 text-base font-semibold"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting Request...</>
              ) : (
                <><Send className="w-5 h-5 mr-2" /> Proceed with Withdrawal</>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
