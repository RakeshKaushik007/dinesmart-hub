import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  type: "direct" | "aggregator";
  is_active: boolean;
  icon?: string | null;
}

// Built-in defaults always available, even before any custom methods are added.
export const BUILT_IN_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "builtin-cash", name: "Cash", code: "cash", type: "direct", is_active: true, icon: "Banknote" },
  { id: "builtin-upi", name: "UPI", code: "upi", type: "direct", is_active: true, icon: "Smartphone" },
  { id: "builtin-card", name: "Card", code: "card", type: "direct", is_active: true, icon: "CreditCard" },
];

export const DIRECT_CODES = new Set(["cash", "upi", "card"]);

export const usePaymentMethods = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>(BUILT_IN_PAYMENT_METHODS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payment_methods")
      .select("id, name, code, type, is_active, icon")
      .eq("is_active", true)
      .order("type")
      .order("name");
    const custom = (data || []) as PaymentMethod[];
    // Merge: built-in always present + custom (deduped by code)
    const seen = new Set(BUILT_IN_PAYMENT_METHODS.map((m) => m.code));
    const merged = [
      ...BUILT_IN_PAYMENT_METHODS,
      ...custom.filter((m) => !seen.has(m.code)),
    ];
    setMethods(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { methods, loading, refresh };
};

/** Classify an arbitrary payment_mode code as direct or aggregator. */
export const classifyPayment = (
  code: string,
  customMethods: PaymentMethod[]
): "direct" | "aggregator" | "other" => {
  if (DIRECT_CODES.has(code)) return "direct";
  const m = customMethods.find((cm) => cm.code === code);
  if (m) return m.type;
  // Unknown legacy codes (zomato_pay, swiggy_dineout, easydiner) → aggregator
  if (code === "pending" || code === "wallet" || code === "mixed") return "other";
  return "aggregator";
};
