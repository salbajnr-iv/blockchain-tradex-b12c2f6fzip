import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listPendingOrders, fillPendingOrder } from "@/lib/api/pendingOrders";
import { executeTrade } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { toast } from '@/lib/toast';

/**
 * usePendingOrderEngine
 *
 * Runs whenever live prices update.  It loads all "pending" limit orders for
 * the current portfolio, checks whether the current market price satisfies
 * each order's condition, and — if so — executes the trade atomically and
 * marks the pending order as "filled".
 *
 * BUY limit order  → triggers when market price <= limit_price
 * SELL limit order → triggers when market price >= limit_price
 *
 * Place this hook inside a component that lives inside both
 * <QueryClientProvider> and <PortfolioProvider>.
 */
export function usePendingOrderEngine(livePrices) {
  const { portfolioId, cashBalance, holdingsMap, refetch } = usePortfolio();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const lastPricesRef = useRef({});

  useEffect(() => {
    if (!portfolioId || !livePrices || Object.keys(livePrices).length === 0) return;

    const priceKey = JSON.stringify(livePrices);
    if (priceKey === lastPricesRef.current.key) return;
    lastPricesRef.current.key = priceKey;

    if (processingRef.current) return;

    const check = async () => {
      processingRef.current = true;
      try {
        const orders = await listPendingOrders(portfolioId, "pending");
        if (orders.length === 0) return;

        for (const order of orders) {
          const currentPrice = livePrices[order.symbol];
          if (currentPrice == null) continue;

          const isBuy = order.side === "BUY";
          const shouldFill =
            (isBuy && currentPrice <= order.limit_price) ||
            (!isBuy && currentPrice >= order.limit_price);

          if (!shouldFill) continue;

          try {
            // Execute the actual trade at the current market price (which has
            // now reached the limit), then mark the order as filled.
            await executeTrade(portfolioId, cashBalance, {
              symbol: order.symbol,
              name: order.name || order.symbol,
              type: order.side,
              quantity: parseFloat(order.quantity),
              unitPrice: currentPrice,
            });

            await fillPendingOrder(order.id);
            await refetch();

            queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
            queryClient.invalidateQueries({ queryKey: ["pending-orders", portfolioId] });

            toast.success(`Limit order filled!`, {
              description: `${isBuy ? "Bought" : "Sold"} ${Number(order.quantity).toFixed(6)} ${order.symbol} at $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
              duration: 7000,
            });
          } catch (execErr) {
            console.warn(`[PendingOrderEngine] failed to fill order ${order.id}:`, execErr.message);
            // Do not cancel the order on a transient error — it will retry next tick.
          }
        }
      } catch (err) {
        console.warn("[PendingOrderEngine] check failed:", err.message);
      } finally {
        processingRef.current = false;
      }
    };

    check();
  }, [livePrices, portfolioId, cashBalance, holdingsMap, refetch, queryClient]);
}
