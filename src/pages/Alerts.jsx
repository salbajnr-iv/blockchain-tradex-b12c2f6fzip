import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAlerts } from "@/lib/api/alerts";
import AlertManager from "@/components/crypto/AlertManager";
import { useLivePrices } from "@/hooks/useLivePrices";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";

export default function Alerts() {
  const { cryptoList } = useLivePrices();
  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts", portfolioId],
    queryFn: () => listAlerts(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Realtime: auto-refresh alerts list when an alert is updated (e.g. triggered)
  useEffect(() => {
    if (!portfolioId) return;
    const channel = supabase
      .channel(`realtime:alerts:${portfolioId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "price_alerts",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts", portfolioId] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [portfolioId, queryClient]);

  const cryptoPrices = cryptoList.reduce((acc, coin) => { acc[coin.symbol] = coin.price; return acc; }, {});
  const cryptoChanges = cryptoList.reduce((acc, coin) => { acc[coin.symbol] = coin.change24h; return acc; }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Price Alerts</h1>
      <AlertManager
        alerts={alerts}
        onAlertsUpdate={refetchAlerts}
        cryptoPrices={cryptoPrices}
        cryptoChanges={cryptoChanges}
        portfolioId={portfolioId}
      />
    </div>
  );
}
