import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import VirtualCard from "./VirtualCard";
import { Loader2 } from "lucide-react";

export default function CardSection() {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const user = await base44.auth.me();
        const cards = await base44.entities.Card.filter({ created_by: user.email }, undefined, 1);
        
        if (cards.length === 0) {
          // Create a default card for new users
          const newCard = await base44.entities.Card.create({
            card_holder: user.full_name || "User",
            card_number: generateCardNumber(),
            expiry_date: generateExpiryDate(),
            cvv: generateCVV(),
            balance: 45000,
            card_type: "premium",
            is_active: true,
            daily_limit: 5000000,
            spending_today: 2000000,
          });
          setCard(newCard);
        } else {
          setCard(cards[0]);
        }
      } catch (error) {
        console.error("Error fetching card:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div className="max-w-md">
      <VirtualCard card={card} />
    </div>
  );
}

function generateCardNumber() {
  const cardNumber = "4532" + Array(12).fill(0).map(() => Math.floor(Math.random() * 10)).join("");
  return cardNumber;
}

function generateExpiryDate() {
  const year = new Date().getFullYear() + 5;
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return `${month}/${year.toString().slice(-2)}`;
}

function generateCVV() {
  return String(Math.floor(Math.random() * 900) + 100);
}