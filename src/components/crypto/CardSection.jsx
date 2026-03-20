import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getOrCreateCard } from "@/lib/api/cards";
import VirtualCard from "./VirtualCard";
import { Loader2 } from "lucide-react";

export default function CardSection() {
  const { user } = useAuth();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    try {
      const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      const cardData = getOrCreateCard(user.id, fullName);
      setCard(cardData);
    } catch (error) {
      console.error("Error loading card:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="max-w-md">
      <VirtualCard card={card} />
    </div>
  );
}
