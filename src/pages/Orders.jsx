import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useMarketCoins } from "@/hooks/useMarketCoins";
import { listPendingOrders, cancelPendingOrder, updatePendingOrder } from "@/lib/api/pendingOrders";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Clock, CheckCircle2, XCircle, X, RefreshCw, ArrowUpRight, ArrowDownLeft,
  TrendingUp, TrendingDown, BarChart2, Loader2, AlertCircle, Zap, Search, Trash2,
  Pencil, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (n, d = 2) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const priceFmt = (n) => {
  if (!n) return "$0";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

const STATUS_CONFIG = {
  pending:   { label: "Pending",   icon: Clock,         color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  filled:    { label: "Filled",    icon: CheckCircle2,  color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle,       color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
};

const FILTERS = [
  { key: "all",       label: "All Orders" },
  { key: "pending",   label: "Pending" },
  { key: "filled",    label: "Filled" },
  { key: "cancelled", label: "Cancelled" },
];

function PriceGapBadge({ side, limitPrice, currentPrice }) {
  if (!currentPrice || !limitPrice) return null;
  const isBuy = side === "BUY";
  const gap = isBuy
    ? ((currentPrice - limitPrice) / limitPrice) * 100
    : ((limitPrice - currentPrice) / currentPrice) * 100;
  const willFill = isBuy ? currentPrice <= limitPrice : currentPrice >= limitPrice;

  if (willFill) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
        <Zap className="w-2.5 h-2.5" /> Ready to fill
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${gap > 5 ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
      {Math.abs(gap).toFixed(1)}% away
    </span>
  );
}

export default function Orders() {
  const { portfolioId } = usePortfolio();
  const { coins } = useMarketCoins();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Live price map from market coins
  const priceMap = useMemo(() => {
    const m = {};
    coins.forEach((c) => { m[c.symbol] = c.price; });
    return m;
  }, [coins]);

  const loadOrders = async (status = null) => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingOrders(portfolioId, status);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load — fetch all statuses
  useEffect(() => {
    if (!portfolioId) return;
    loadOrders(null);
  }, [portfolioId]);

  // Realtime subscription
  useEffect(() => {
    if (!portfolioId) return;
    const channel = supabase
      .channel(`orders:page:${portfolioId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pending_orders",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, (payload) => {
        // Merge the changed record into local state
        setOrders((prev) => {
          if (payload.eventType === "INSERT") {
            return [payload.new, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((o) => o.id === payload.new.id ? payload.new : o);
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((o) => o.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [portfolioId]);

  const handleCancel = async (orderId) => {
    setCancellingId(orderId);
    try {
      await cancelPendingOrder(orderId);
      toast.success("Order cancelled");
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "cancelled", cancelled_at: new Date().toISOString() } : o));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(orderId); return next; });
    } catch (err) {
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedIds.size === 0) return;
    setBulkCancelling(true);
    let succeeded = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await cancelPendingOrder(id);
        setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "cancelled", cancelled_at: new Date().toISOString() } : o));
        succeeded++;
      } catch {
        failed++;
      }
    }
    setSelectedIds(new Set());
    setBulkCancelling(false);
    if (succeeded > 0) toast.success(`${succeeded} order${succeeded !== 1 ? "s" : ""} cancelled`);
    if (failed > 0) toast.error(`${failed} order${failed !== 1 ? "s" : ""} failed to cancel`);
  };

  const openEdit = (order) => {
    setEditingOrder(order);
    setEditPrice(String(order.limit_price));
    setEditQty(String(order.quantity));
  };

  const handleEditSave = async () => {
    if (!editingOrder) return;
    const newPrice = parseFloat(editPrice);
    const newQty   = parseFloat(editQty);
    if (!newPrice || newPrice <= 0) { toast.error("Enter a valid limit price"); return; }
    if (!newQty   || newQty   <= 0) { toast.error("Enter a valid quantity"); return; }
    setEditSaving(true);
    try {
      const updated = await updatePendingOrder(editingOrder.id, { limitPrice: newPrice, quantity: newQty });
      setOrders((prev) => prev.map((o) => o.id === updated.id ? updated : o));
      toast.success("Order updated");
      setEditingOrder(null);
    } catch (err) {
      toast.error(err.message || "Failed to update order");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtered = useMemo(() => {
    let list = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((o) => o.symbol?.toUpperCase().includes(q) || o.name?.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [orders, filter, search]);

  const pendingFiltered = useMemo(() => filtered.filter((o) => o.status === "pending"), [filtered]);

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingFiltered.length && pendingFiltered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map((o) => o.id)));
    }
  };

  const allPendingSelected = pendingFiltered.length > 0 && selectedIds.size === pendingFiltered.length;

  // Stats
  const pendingCount   = orders.filter((o) => o.status === "pending").length;
  const filledCount    = orders.filter((o) => o.status === "filled").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const pendingValue   = orders
    .filter((o) => o.status === "pending")
    .reduce((s, o) => s + (o.quantity * o.limit_price), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Open Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Limit orders auto-execute when the market reaches your target price · Live updates
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs text-primary/70 font-medium">
            <Zap className="w-3 h-3" /> Live
          </span>
          <button
            onClick={() => loadOrders(null)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate("/trade")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Place Order
          </button>
        </div>
      </div>

      {/* Client-side notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <span>
          Limit orders are monitored in real-time while this page is open. If you close the browser, orders will resume checking on your next visit.
        </span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: pendingCount, color: "text-yellow-500" },
          { label: "Pending Value", value: `$${fmt(pendingValue)}`, color: "text-foreground" },
          { label: "Filled", value: filledCount, color: "text-emerald-500" },
          { label: "Cancelled", value: cancelledCount, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by coin..."
            className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/40 transition-colors text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Orders list */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Loading orders...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">
              {search ? `No orders matching "${search}"` : filter === "all" ? "No orders yet" : `No ${filter} orders`}
            </p>
            {filter === "all" && !search && (
              <button
                onClick={() => navigate("/trade")}
                className="mt-4 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mx-auto"
              >
                Place your first limit order <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Bulk cancel bar */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20"
                >
                  <p className="text-sm text-foreground font-medium">
                    {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} selected
                  </p>
                  <button
                    onClick={handleBulkCancel}
                    disabled={bulkCancelling}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                  >
                    {bulkCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Cancel selected
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20">
                    <th className="py-3 pl-4 pr-2 w-8">
                      {pendingFiltered.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-border cursor-pointer accent-primary"
                        />
                      )}
                    </th>
                    {["Asset", "Side", "Quantity", "Limit Price", "Current Price", "Gap", "Total Value", "Status", "Placed", ""].map((h) => (
                      <th key={h} className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${h === "" || h === "Side" || h === "Status" ? "text-center" : h === "Placed" ? "text-right" : "text-right first:text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((order) => {
                      const isBuy = order.side === "BUY";
                      const currentPrice = priceMap[order.symbol];
                      const SideIcon = isBuy ? ArrowUpRight : ArrowDownLeft;
                      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                      const StatusIcon = cfg.icon;
                      const total = order.quantity * order.limit_price;
                      const coin = coins.find((c) => c.symbol === order.symbol);
                      const isPending = order.status === "pending";
                      const isSelected = selectedIds.has(order.id);

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`border-b border-border/20 hover:bg-secondary/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          {/* Checkbox */}
                          <td className="pl-4 pr-2 py-3 w-8">
                            {isPending && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(order.id)}
                                className="rounded border-border cursor-pointer accent-primary"
                              />
                            )}
                          </td>

                          {/* Asset */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {coin?.image && (
                                <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              )}
                              <div>
                                <p className="text-sm font-semibold">{order.symbol}</p>
                                <p className="text-[11px] text-muted-foreground">{order.name || order.symbol}</p>
                              </div>
                            </div>
                          </td>

                          {/* Side */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${isBuy ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                              <SideIcon className="w-3 h-3" />
                              {isBuy ? "BUY" : "SELL"}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm tabular-nums font-mono">{fmt(order.quantity, 6)}</span>
                          </td>

                          {/* Limit Price */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm tabular-nums font-semibold">{priceFmt(order.limit_price)}</span>
                          </td>

                          {/* Current Price */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {currentPrice ? priceFmt(currentPrice) : "—"}
                            </span>
                          </td>

                          {/* Gap */}
                          <td className="px-4 py-3 text-center">
                            {order.status === "pending" && (
                              <PriceGapBadge side={order.side} limitPrice={order.limit_price} currentPrice={currentPrice} />
                            )}
                          </td>

                          {/* Total Value */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm tabular-nums font-mono">${fmt(total)}</span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {cfg.label}
                            </span>
                          </td>

                          {/* Placed */}
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(order.created_at), "MMM d, HH:mm")}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-center">
                            {order.status === "pending" && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEdit(order)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                  title="Edit order"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCancel(order.id)}
                                  disabled={cancellingId === order.id}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                                  title="Cancel order"
                                >
                                  {cancellingId === order.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <X className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/20">
              <AnimatePresence>
                {filtered.map((order) => {
                  const isBuy = order.side === "BUY";
                  const currentPrice = priceMap[order.symbol];
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const total = order.quantity * order.limit_price;
                  const coin = coins.find((c) => c.symbol === order.symbol);

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {coin?.image && (
                            <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-bold">{order.symbol}</p>
                            <p className="text-xs text-muted-foreground">{order.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </span>
                          {order.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEdit(order)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                title="Edit order"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleCancel(order.id)}
                                disabled={cancellingId === order.id}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                              >
                                {cancellingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Side</p>
                          <p className={`font-semibold ${isBuy ? "text-emerald-500" : "text-red-500"}`}>{isBuy ? "BUY" : "SELL"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-mono">{fmt(order.quantity, 6)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Limit Price</p>
                          <p className="font-semibold">{priceFmt(order.limit_price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current Price</p>
                          <p>{currentPrice ? priceFmt(currentPrice) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Value</p>
                          <p className="font-mono">${fmt(total)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Placed</p>
                          <p>{format(new Date(order.created_at), "MMM d, HH:mm")}</p>
                        </div>
                      </div>

                      {order.status === "pending" && currentPrice && (
                        <PriceGapBadge side={order.side} limitPrice={order.limit_price} currentPrice={currentPrice} />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Updates in real-time via Supabase
          </div>
        )}
      </motion.div>

      {/* Edit Order Modal */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="border-border/50 bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Limit Order
            </DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2 p-3 bg-secondary/40 rounded-lg">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${editingOrder.side === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  {editingOrder.side}
                </span>
                <span className="text-sm font-semibold">{editingOrder.symbol}</span>
                <span className="text-xs text-muted-foreground">{editingOrder.name}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Limit Price (USD)</label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="bg-secondary/40 border-border font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="0.000000"
                  min="0"
                  step="any"
                  className="bg-secondary/40 border-border font-mono"
                />
              </div>
              {editPrice && editQty && parseFloat(editPrice) > 0 && parseFloat(editQty) > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Total value: <span className="font-semibold text-foreground">${(parseFloat(editPrice) * parseFloat(editQty)).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setEditingOrder(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleEditSave} disabled={editSaving} className="flex-1">
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
