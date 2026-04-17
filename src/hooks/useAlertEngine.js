import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listAlerts, updateAlert } from "@/lib/api/alerts";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { toast } from '@/lib/toast';

/**
 * useAlertEngine
 *
 * Runs in the background whenever the app is open.
 * Every time `livePrices` changes (object keyed by symbol -> price), it checks
 * all active, non-triggered price alerts for the current user and fires the
 * ones whose conditions are met — updating the DB and showing a toast.
 *
 * Place this hook inside a component that lives inside both
 * <QueryClientProvider> and <PortfolioProvider>.
 */
export function useAlertEngine(livePrices) {
  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const lastPricesRef = useRef({});

  useEffect(() => {
    if (!portfolioId || !livePrices || Object.keys(livePrices).length === 0) return;

    // Skip if prices haven't actually changed
    const priceKey = JSON.stringify(livePrices);
    if (priceKey === lastPricesRef.current.key) return;
    lastPricesRef.current.key = priceKey;

    // Prevent concurrent runs
    if (processingRef.current) return;

    const check = async () => {
      processingRef.current = true;
      try {
        const alerts = await listAlerts(portfolioId);
        const active = alerts.filter((a) => a.is_active && !a.is_triggered);
        if (active.length === 0) return;

        const triggered = [];

        for (const alert of active) {
          const currentPrice = livePrices[alert.crypto_symbol];
          if (currentPrice == null) continue;

          let shouldFire = false;
          if (alert.alert_type === "price_above" && currentPrice >= alert.threshold_value) {
            shouldFire = true;
          } else if (alert.alert_type === "price_below" && currentPrice <= alert.threshold_value) {
            shouldFire = true;
          } else if (alert.alert_type === "volatility") {
            // volatility alert: threshold_value is a % change magnitude
            // We don't have change24h here, but we can skip until it's provided
          }

          if (shouldFire) triggered.push({ alert, currentPrice });
        }

        if (triggered.length === 0) return;

        await Promise.all(
          triggered.map(({ alert, currentPrice }) =>
            updateAlert(alert.id, {
              is_triggered: true,
              triggered_at: new Date().toISOString(),
              current_price: currentPrice,
              is_active: false,
            })
          )
        );

        triggered.forEach(({ alert, currentPrice }) => {
          const dir = alert.alert_type === "price_above" ? "above" : "below";
          toast.success(
            `${alert.crypto_symbol} price alert triggered!`,
            {
              description: `${alert.crypto_symbol} is now $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} — ${dir} your target of $${Number(alert.threshold_value).toLocaleString()}`,
              duration: 8000,
            }
          );
        });

        // Refresh alert list in the UI
        queryClient.invalidateQueries({ queryKey: ["alerts", portfolioId] });
      } catch (err) {
        console.warn("[AlertEngine] check failed:", err.message);
      } finally {
        processingRef.current = false;
      }
    };

    check();
  }, [livePrices, portfolioId, queryClient]);
}
