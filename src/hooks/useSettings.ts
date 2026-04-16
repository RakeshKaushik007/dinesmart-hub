import { useMemo } from "react";

export interface BlennixSettings {
  restaurantName: string;
  taxRate: number;
  taxLabel: string;
  serviceChargePct: number;
  currency: string;
}

export const getSettings = (): BlennixSettings => {
  const saved = typeof window !== "undefined" ? localStorage.getItem("blennix_settings") : null;
  const s = saved ? JSON.parse(saved) : {};
  return {
    restaurantName: s.restaurantName || "Blennix Restaurant",
    taxRate: parseFloat(s.taxRate || "5"),
    taxLabel: s.taxLabel || "GST",
    serviceChargePct: parseFloat(s.serviceChargePct || "5"),
    currency: s.currency || "₹",
  };
};

export const useSettings = (): BlennixSettings => {
  return useMemo(() => getSettings(), []);
};
