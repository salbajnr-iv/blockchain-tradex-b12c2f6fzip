import React from "react";
import CardSection from "@/components/crypto/CardSection";

export default function Card() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Virtual Card</h1>
      <CardSection />
    </div>
  );
}