import React from "react";
import TradePanel from "@/components/crypto/TradePanel";
import RecentTrades from "@/components/crypto/RecentTrades";
import { useLivePrices } from "@/hooks/useLivePrices";

export default function Trade() {
  const { cryptoList } = useLivePrices();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Trade</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TradePanel cryptoList={cryptoList} />
        <RecentTrades />
      </div>
    </div>
  );
}