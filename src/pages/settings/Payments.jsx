import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { CreditCard, Building2, Wallet2, PlusCircle, Trash2, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddPaymentMethodDialog from "@/components/crypto/AddPaymentMethodDialog";
import { toast } from "sonner";

const TYPE_ICON = { card: CreditCard, bank_account: Building2, paypal: Wallet2 };
const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

function MethodCard({ method, onDelete, onSetDefault }) {
  const Icon = TYPE_ICON[method.type] || CreditCard;
  let title = "Payment Method";
  let subtitle = "";
  if (method.type === "card") {
    title = `${BRAND_LABEL[method.card_brand] || "Card"} ••••${method.card_last_four}`;
    subtitle = `${method.card_holder_name} · Exp ${String(method.expiry_month).padStart(2,"0")}/${String(method.expiry_year).slice(-2)}`;
  } else if (method.type === "bank_account") {
    title = `${method.bank_name} ••••${method.account_last_four}`;
    subtitle = method.account_holder;
  } else {
    title = "PayPal";
    subtitle = method.paypal_email;
  }

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${method.is_default ? "border-primary/40 bg-primary/5" : "border-border/50"}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            {title}
            {method.is_default && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Default</span>}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!method.is_default && (
          <button onClick={() => onSetDefault(method.id)} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            Set default
          </button>
        )}
        <button onClick={() => onDelete(method.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function PaymentsSettings() {
  const { user } = useAuth();
  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
      toast.success("Payment method removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove payment method");
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await supabase.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
      await supabase.from("payment_methods").update({ is_default: true }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
      toast.success("Default payment method updated");
    } catch (err) {
      toast.error(err.message || "Failed to update default");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Payment Methods</h2>
          <Button onClick={() => setAddOpen(true)} size="sm" className="bg-primary hover:bg-primary/90 gap-2 text-xs h-8">
            <PlusCircle className="w-3.5 h-3.5" />
            Add Method
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No payment methods saved yet.</p>
            <Button variant="outline" onClick={() => setAddOpen(true)} className="border-dashed">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add your first method
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => (
              <MethodCard key={m.id} method={m} onDelete={handleDelete} onSetDefault={handleSetDefault} />
            ))}
          </div>
        )}
      </div>

      <AddPaymentMethodDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
          setAddOpen(false);
        }}
      />
    </div>
  );
}
