import { useEffect, useMemo, useState } from "react";

export interface BlennixSettings {
  restaurantName: string;
  taxRate: number;
  taxLabel: string;
  serviceChargePct: number;
  currency: string;
  sectionSurcharges: Record<string, number>;
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
    sectionSurcharges: s.sectionSurcharges && typeof s.sectionSurcharges === "object" ? s.sectionSurcharges : {},
  };
};

export const useSettings = (): BlennixSettings => {
  // Re-read on storage changes so updates from Settings page reflect immediately.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === "blennix_settings") setTick(t => t + 1); };
    const onCustom = () => setTick(t => t + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener("blennix_settings_changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("blennix_settings_changed", onCustom);
    };
  }, []);
  return useMemo(() => getSettings(), [tick]);
};
