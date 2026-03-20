import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, X, RefreshCw, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";

const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];

const ALERT_TYPE_META = {
  price_above: { label: "Price Above",    icon: TrendingUp,   hint: "USD price target",       color: "text-primary" },
  price_below: { label: "Price Below",    icon: TrendingDown, hint: "USD price target",       color: "text-destructive" },
  volatility:  { label: "High Volatility",icon: Zap,          hint: "24h change % threshold", color: "text-yellow-400" },
};

export default function AlertManager({ alerts, onAlertsUpdate, cryptoPrices, cryptoChanges }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ crypto_symbol: "BTC", alert_type: "price_above", threshold_value: "" });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!formData.threshold_value) return;
    setLoading(true);
    try {
      await base44.entities.Alert.create({
        ...formData,
        threshold_value: parseFloat(formData.threshold_value),
        is_active: true,
        is_triggered: false,
      });
      setFormData({ crypto_symbol: "BTC", alert_type: "price_above", threshold_value: "" });
      setShowForm(false);
      onAlertsUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId) => {
    await base44.entities.Alert.delete(alertId);
    onAlertsUpdate();
  };

  const handleToggle = async (alert) => {
    await base44.entities.Alert.update(alert.id, { is_active: !alert.is_active });
    onAlertsUpdate();
  };

  const handleRearm = async (alert) => {
    await base44.entities.Alert.update(alert.id, { is_triggered: false, is_active: true, triggered_at: null });
    onAlertsUpdate();
  };

  // Calculate how close current price is to threshold (for progress bar)
  const getProgress = (alert) => {
    const currentPrice = cryptoPrices?.[alert.crypto_symbol];
    if (!currentPrice || alert.alert_type === "volatility") return null;
    const ratio = currentPrice / alert.threshold_value;
    return Math.min(100, Math.max(0, ratio * 100));
  };

  const activeAlerts   = alerts.filter((a) => a.is_active && !a.is_triggered);
  const triggeredAlerts = alerts.filter((a) => a.is_triggered);
  const disabledAlerts  = alerts.filter((a) => !a.is_active && !a.is_triggered);

  const AlertRow = ({ alert }) => {
    const meta = ALERT_TYPE_META[alert.alert_type] || {};
    const Icon = meta.icon || AlertCircle;
    const progress = getProgress(alert);
    const currentPrice = cryptoPrices?.[alert.crypto_symbol];

    return (
      <div className={`p-3 rounded-xl border transition-all ${
        alert.is_triggered
          ? "bg-primary/5 border-primary/30"
          : alert.is_active
          ? "bg-secondary/20 border-border/40 hover:border-border/70"
          : "bg-muted/10 border-border/20 opacity-50"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold">{alert.crypto_symbol}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{meta.label}</span>
                {alert.is_triggered && (
                  <span className="flex items-center gap-0.5 text-xs text-primary font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Triggered
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {alert.alert_type === "volatility"
                  ? `Change ≥ ${alert.threshold_value}%`
                  : `$${alert.threshold_value.toLocaleString()}`}
                {currentPrice && alert.alert_type !== "volatility" && (
                  <span className="ml-1.5">
                    · Live: <span className="text-foreground font-medium">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {alert.is_triggered ? (
              <button
                onClick={() => handleRearm(alert)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Re-arm
              </button>
            ) : (
              <button
                onClick={() => handleToggle(alert)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  alert.is_active
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {alert.is_active ? "On" : "Off"}
              </button>
            )}
            <button onClick={() => handleDelete(alert.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar for price alerts */}
        {progress !== null && !alert.is_triggered && alert.is_active && (
          <div className="mt-2">
            <div className="w-full h-1 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  alert.alert_type === "price_above"
                    ? progress >= 95 ? "bg-primary" : "bg-primary/50"
                    : progress <= 105 ? "bg-destructive" : "bg-destructive/40"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{progress.toFixed(1)}% of target</p>
          </div>
        )}
      </div>
    );
  };

  const meta = ALERT_TYPE_META[formData.alert_type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card rounded-xl border border-border/50 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Price Alerts</h3>
          {activeAlerts.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
              {activeAlerts.length}
            </span>
          )}
          {triggeredAlerts.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center animate-pulse">
              {triggeredAlerts.length}
            </span>
          )}
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" />
          New Alert
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-secondary/20 rounded-xl p-4 mb-4 border border-border/40 space-y-3"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configure Alert</p>
          <div className="grid grid-cols-2 gap-3">
            <Select value={formData.crypto_symbol} onValueChange={(v) => setFormData({ ...formData, crypto_symbol: v })}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRYPTO_SYMBOLS.map((sym) => (
                  <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={formData.alert_type} onValueChange={(v) => setFormData({ ...formData, alert_type: v })}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_above">📈 Price Above</SelectItem>
                <SelectItem value="price_below">📉 Price Below</SelectItem>
                <SelectItem value="volatility">⚡ High Volatility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Input
              type="number"
              placeholder={meta?.hint || "Enter threshold"}
              value={formData.threshold_value}
              onChange={(e) => setFormData({ ...formData, threshold_value: e.target.value })}
              className="bg-secondary/50 border-border/50"
              min="0"
            />
            <p className="text-[11px] text-muted-foreground pl-1">{meta?.hint}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={loading || !formData.threshold_value} className="flex-1 bg-primary hover:bg-primary/90">
              {loading ? "Creating..." : "Create Alert"}
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </motion.div>
      )}

      {/* Alert Lists */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
        {alerts.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground">No alerts yet. Create one to get started!</p>
          </div>
        ) : (
          <>
            {activeAlerts.length > 0 && (
              <div className="space-y-1.5">
                {activeAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </div>
            )}
            {triggeredAlerts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-yellow-400/80 uppercase tracking-wider pt-1 pb-0.5 px-1">✓ Triggered</p>
                {triggeredAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </div>
            )}
            {disabledAlerts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider pt-1 pb-0.5 px-1">Disabled</p>
                {disabledAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}