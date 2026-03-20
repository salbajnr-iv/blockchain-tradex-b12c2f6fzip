import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AlertManager from "@/components/crypto/AlertManager";
import NotificationCenter from "@/components/crypto/NotificationCenter";
import { useLivePrices } from "@/hooks/useLivePrices";

export default function Alerts() {
  const { cryptoList } = useLivePrices();

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => base44.entities.Alert.list(),
    initialData: [],
  });

  const cryptoPrices = cryptoList.reduce((acc, coin) => { acc[coin.symbol] = coin.price; return acc; }, {});
  const cryptoChanges = cryptoList.reduce((acc, coin) => { acc[coin.symbol] = coin.change24h; return acc; }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Price Alerts</h1>
      <AlertManager alerts={alerts} onAlertsUpdate={refetchAlerts} cryptoPrices={cryptoPrices} cryptoChanges={cryptoChanges} />
      <NotificationCenter alerts={alerts} cryptoPrices={cryptoPrices} cryptoChanges={cryptoChanges} />
    </div>
  );
}