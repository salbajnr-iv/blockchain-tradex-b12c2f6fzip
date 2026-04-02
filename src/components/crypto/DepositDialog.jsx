import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { listPaymentMethods } from "@/lib/api/paymentMethods";
import AddFundsFlow from "./AddFundsFlow";
import { useQueryClient } from "@tanstack/react-query";

export default function DepositDialog({ open, onClose }) {
  const { user }       = useAuth();
  const queryClient    = useQueryClient();

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn:  () => listPaymentMethods(user?.id),
    enabled:  !!user?.id && open,
    initialData: [],
  });

  const handleMethodAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
  };

  return (
    <AddFundsFlow
      open={open}
      onClose={onClose}
      paymentMethods={methods}
      onMethodAdded={handleMethodAdded}
    />
  );
}
