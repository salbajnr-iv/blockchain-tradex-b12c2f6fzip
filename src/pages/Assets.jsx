import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Copy, CheckCircle2, Clock, XCircle, Upload, X,
  ChevronDown, Info, Loader2, ArrowLeft, ExternalLink,
  Wallet, RefreshCw, AlertCircle, FileImage,
} from "lucide-react";
import {
  getMasterWallets,
  getUserDeposits,
  submitCryptoDeposit,
  getUserCryptoBalances,
  getDepositProofUrl,
} from "@/lib/api/cryptoDeposits";

const ASSET_META = {
  BTC:  { color: "text-orange-500",   bg: "bg-orange-500/10",  border: "border-orange-500/20",  icon: "₿",  label: "Bitcoin" },
  ETH:  { color: "text-blue-500",     bg: "bg-blue-500/10",    border: "border-blue-500/20",    icon: "Ξ",  label: "Ethereum" },
  SOL:  { color: "text-purple-500",   bg: "bg-purple-500/10",  border: "border-purple-500/20",  icon: "◎",  label: "Solana" },
  BNB:  { color: "text-yellow-500",   bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  icon: "B",  label: "BNB" },
  USDT: { color: "text-emerald-500",  bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "₮",  label: "Tether" },
  USDC: { color: "text-sky-500",      bg: "bg-sky-500/10",     border: "border-sky-500/20",     icon: "$",  label: "USD Coin" },
};

const STATUS_CONFIG = {
  pending:      { label: "Pending",      color: "text-yellow-500",      bg: "bg-yellow-500/10 border-yellow-500/20",  icon: Clock },
  under_review: { label: "Under Review", color: "text-blue-500",        bg: "bg-blue-500/10 border-blue-500/20",      icon: RefreshCw },
  completed:    { label: "Completed",    color: "text-emerald-500",     bg: "bg-emerald-500/10 border-emerald-500/20",icon: CheckCircle2 },
  rejected:     { label: "Rejected",     color: "text-destructive",     bg: "bg-destructive/10 border-destructive/20",icon: XCircle },
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <Copy className="w-4 h-4" />}
    </button>
  );
}

function AssetCard({ wallet, balance, onDeposit, isSelected, onSelect }) {
  const meta = ASSET_META[wallet.asset] || { color: "text-foreground", bg: "bg-secondary/40", border: "border-border", icon: "?", label: wallet.asset };
  const bal = parseFloat(balance?.balance ?? 0);

  return (
    <motion.button
      layout
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        isSelected
          ? `${meta.bg} ${meta.border} ring-1 ring-offset-1 ring-offset-background ${meta.border.replace("border-", "ring-")}`
          : "bg-card border-border hover:border-primary/30 hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0`}>
            <span className={`text-lg font-bold ${meta.color}`}>{meta.icon}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{wallet.asset}</p>
            <p className="text-xs text-muted-foreground">{meta.label} · {wallet.network}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {bal > 0 ? bal.toFixed(8).replace(/\.?0+$/, "") : "0"}
          </p>
          <p className="text-xs text-muted-foreground">{wallet.asset} balance</p>
        </div>
      </div>

      {isSelected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-border/40 space-y-3"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Deposit Address</p>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5 border border-border/50">
              <p className="flex-1 font-mono text-xs text-foreground break-all">{wallet.address}</p>
              <CopyButton value={wallet.address} />
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Only send <strong>{wallet.asset}</strong> on the <strong>{wallet.network}</strong> network to this address. Sending the wrong asset or using the wrong network will result in permanent loss of funds.
            </p>
          </div>
          <Button
            onClick={(e) => { e.stopPropagation(); onDeposit(wallet); }}
            className={`w-full rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90`}
          >
            Submit Deposit Proof
          </Button>
        </motion.div>
      )}
    </motion.button>
  );
}

function DepositForm({ wallet, userId, onSuccess, onCancel }) {
  const meta = ASSET_META[wallet.asset] || {};
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(f.type)) { toast.error("Only images (JPG, PNG, WebP, GIF) or PDF allowed"); return; }
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (!file && !txHash.trim()) {
      toast.error("Please provide a transaction hash or upload a proof screenshot");
      return;
    }

    setSubmitting(true);
    try {
      await submitCryptoDeposit({
        userId,
        asset:     wallet.asset,
        network:   wallet.network,
        amount:    parsed,
        txHash:    txHash || null,
        proofFile: file || null,
      });
      toast.success("Deposit submitted! Our team will review it shortly.");
      onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to submit deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="bg-card border border-border rounded-2xl p-6 space-y-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center`}>
            <span className={`font-bold ${meta.color}`}>{meta.icon}</span>
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Submit {wallet.asset} Deposit</p>
            <p className="text-xs text-muted-foreground">{meta.label} · {wallet.network}</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-secondary/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-xs">Deposit Address</p>
        <div className="flex items-center gap-2">
          <p className="font-mono break-all flex-1">{wallet.address}</p>
          <CopyButton value={wallet.address} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Amount <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Input
              type="number"
              step="any"
              min="0"
              placeholder={`e.g. 0.005`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-secondary/40 border-border pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              {wallet.asset}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Transaction Hash <span className="text-muted-foreground text-xs font-normal ml-1">(optional but recommended)</span>
          </label>
          <Input
            placeholder="e.g. 0xabc123... or txid..."
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="bg-secondary/40 border-border font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Proof of Payment <span className="text-muted-foreground text-xs font-normal ml-1">(screenshot or PDF)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center gap-3 bg-secondary/40 rounded-xl border border-border px-3 py-2.5">
              <FileImage className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-primary/40 rounded-xl py-6 transition-colors text-muted-foreground hover:text-foreground bg-secondary/20 hover:bg-secondary/40"
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm">Click to upload proof</span>
              <span className="text-xs">JPG, PNG, WebP, GIF, PDF · Max 10 MB</span>
            </button>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            Your deposit will be reviewed by our team. Balance is credited only after manual verification. This typically takes 1–24 hours.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 rounded-xl"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 rounded-xl"
            disabled={submitting}
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : "Submit Deposit"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

function DepositHistoryRow({ deposit }) {
  const cfg = STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const meta = ASSET_META[deposit.asset] || {};
  const [proofUrl, setProofUrl] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const handleViewProof = async () => {
    if (proofUrl) { window.open(proofUrl, "_blank"); return; }
    if (!deposit.proof_url) return;
    setLoadingProof(true);
    try {
      const url = await getDepositProofUrl(deposit.proof_url);
      setProofUrl(url);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not load proof file");
    } finally {
      setLoadingProof(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors">
      <div className={`w-9 h-9 rounded-xl ${meta.bg || "bg-secondary/40"} flex items-center justify-center shrink-0`}>
        <span className={`font-bold text-sm ${meta.color || "text-foreground"}`}>{meta.icon || deposit.asset[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">
            {parseFloat(deposit.amount).toFixed(8).replace(/\.?0+$/, "")} {deposit.asset}
          </p>
          <span className="text-xs text-muted-foreground">{deposit.network}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(deposit.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
          {deposit.tx_hash && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]" title={deposit.tx_hash}>
              {deposit.tx_hash.slice(0, 10)}…
            </span>
          )}
        </div>
        {deposit.admin_note && (
          <p className="text-xs text-muted-foreground mt-1.5 italic">"{deposit.admin_note}"</p>
        )}
      </div>
      {deposit.proof_url && (
        <button
          onClick={handleViewProof}
          disabled={loadingProof}
          className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
          title="View proof"
        >
          {loadingProof ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [depositFormWallet, setDepositFormWallet] = useState(null);
  const [activeTab, setActiveTab] = useState("assets"); // "assets" | "history"
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ["master_wallets"],
    queryFn: getMasterWallets,
    staleTime: 5 * 60 * 1000,
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["user_crypto_balances", user?.id],
    queryFn: () => getUserCryptoBalances(user?.id),
    enabled: !!user?.id,
  });

  const { data: deposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ["user_deposits", user?.id],
    queryFn: () => getUserDeposits(user?.id),
    enabled: !!user?.id,
  });

  const balanceMap = Object.fromEntries(balances.map((b) => [b.asset, b]));

  const filteredDeposits = statusFilter === "all"
    ? deposits
    : deposits.filter((d) => d.status === statusFilter);

  const handleDeposit = (wallet) => {
    setDepositFormWallet(wallet);
    setSelectedWallet(null);
  };

  const handleDepositSuccess = () => {
    setDepositFormWallet(null);
    setSelectedWallet(null);
    setActiveTab("history");
    queryClient.invalidateQueries(["user_deposits", user?.id]);
    queryClient.invalidateQueries(["user_crypto_balances", user?.id]);
  };

  const isLoading = walletsLoading || balancesLoading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Wallet className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">
          Deposit crypto and track your balances. All deposits require manual verification.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        {[
          { key: "assets",  label: "Deposit" },
          { key: "history", label: "History", badge: deposits.filter(d => d.status === "pending").length },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setDepositFormWallet(null); setSelectedWallet(null); }}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-[9px] font-bold text-white flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "assets" && (
          <motion.div
            key="assets"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Deposit Form */}
            <AnimatePresence>
              {depositFormWallet && (
                <DepositForm
                  wallet={depositFormWallet}
                  userId={user?.id}
                  onSuccess={handleDepositSuccess}
                  onCancel={() => setDepositFormWallet(null)}
                />
              )}
            </AnimatePresence>

            {/* Asset List */}
            {!depositFormWallet && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Select an asset to see its deposit address</p>
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[72px] bg-secondary/40 rounded-2xl animate-pulse" />
                      ))
                    : wallets.map((wallet) => (
                        <AssetCard
                          key={wallet.id}
                          wallet={wallet}
                          balance={balanceMap[wallet.asset]}
                          isSelected={selectedWallet?.id === wallet.id}
                          onSelect={() => setSelectedWallet(prev => prev?.id === wallet.id ? null : wallet)}
                          onDeposit={handleDeposit}
                        />
                      ))
                  }
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
              {["all", "pending", "under_review", "completed", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                    statusFilter === s
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "under_review" ? "Under Review" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {depositsLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDeposits.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm font-medium text-muted-foreground">No deposits found</p>
                  <p className="text-xs text-muted-foreground/60">
                    {statusFilter === "all" ? "Submit your first crypto deposit to get started" : `No ${statusFilter} deposits`}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("assets")}
                    className="mt-2 rounded-xl"
                  >
                    Make a Deposit
                  </Button>
                </div>
              ) : (
                filteredDeposits.map((deposit) => (
                  <DepositHistoryRow key={deposit.id} deposit={deposit} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
