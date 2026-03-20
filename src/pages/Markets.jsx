import React from "react";
import MarketTable from "@/components/crypto/MarketTable";
import PriceChart from "@/components/crypto/PriceChart";
import { useLivePrices } from "@/hooks/useLivePrices";

export default function Markets() {
  const { cryptoList, isLoading } = useLivePrices();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Markets</h1>
      <PriceChart />
      <MarketTable cryptoList={cryptoList} isLoading={isLoading} />
    </div>
  );
}