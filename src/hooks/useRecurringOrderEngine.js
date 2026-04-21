import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { listDueRecurringOrders, advanceRecurringOrder } from '@/lib/api/recurringOrders';
import { executeTrade } from '@/lib/api/portfolio';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { toast } from '@/lib/toast';
import { devWarn } from '@/lib/log';

/**
 * useRecurringOrderEngine
 *
 * Checks for any DCA/recurring orders that are due (next_execution_at <= now).
 * Runs on mount and every 60 seconds while the app is open.
 * Requires live prices from the context to price the market buy.
 */
export function useRecurringOrderEngine(livePrices) {
  const { portfolioId, cashBalance, refetch } = usePortfolio();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!portfolioId) return;

    const check = async () => {
      if (processingRef.current) return;
      if (!livePrices || Object.keys(livePrices).length === 0) return;

      processingRef.current = true;
      try {
        const dueOrders = await listDueRecurringOrders(portfolioId);
        if (dueOrders.length === 0) return;

        for (const order of dueOrders) {
          const currentPrice = livePrices[order.symbol];
          if (!currentPrice || currentPrice <= 0) continue;

          const quantity = parseFloat((order.amount_usd / currentPrice).toFixed(8));
          if (quantity <= 0) continue;

          if (cashBalance < order.amount_usd * 1.002) { // include ~0.2% fee buffer
            devWarn(`[DCAEngine] Insufficient cash for ${order.symbol} — need $${order.amount_usd}, have $${cashBalance}`);
            continue;
          }

          try {
            await executeTrade(portfolioId, cashBalance, {
              symbol:    order.symbol,
              name:      order.name,
              type:      'BUY',
              quantity,
              unitPrice: currentPrice,
            });

            await advanceRecurringOrder(order, order.amount_usd);
            await refetch();

            queryClient.invalidateQueries({ queryKey: ['recurring-orders', portfolioId] });
            queryClient.invalidateQueries({ queryKey: ['trades', portfolioId] });

            toast.success('DCA order executed!', {
              description: `Bought $${order.amount_usd.toLocaleString()} of ${order.symbol} at $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
              duration: 7000,
            });
          } catch (execErr) {
            devWarn(`[DCAEngine] failed to execute order ${order.id}:`, execErr.message);
          }
        }
      } catch (err) {
        devWarn('[DCAEngine] check failed:', err.message);
      } finally {
        processingRef.current = false;
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [portfolioId, livePrices, cashBalance, refetch, queryClient]);
}
