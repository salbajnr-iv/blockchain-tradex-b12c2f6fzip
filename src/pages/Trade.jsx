import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import TradePanel from "@/components/crypto/TradePanel";
import RecentTrades from "@/components/crypto/RecentTrades";
import { useLivePrices } from "@/hooks/useLivePrices";

export default function Trade() {
  const { cryptoList } = useLivePrices();
  const [searchParams] = useSearchParams();
  const initialCoin = searchParams.get("coin")?.toUpperCase() || null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Trade</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TradePanel cryptoList={cryptoList} initialCoin={initialCoin} />
        <RecentTrades />
      </div>
    </div>
  );
}
