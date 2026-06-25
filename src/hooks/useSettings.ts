import { useEffect, useMemo, useState } from "react";

export interface SurchargeConfig {
  pct: number;
  enabled: boolean;
}

export const TAKEAWAY_SURCHARGE_KEY = "__takeaway__";

export interface BlennixSettings {
  restaurantName: string;
  taxRate: number;
  taxLabel: string;
  serviceChargePct: number;
  currency: string;
  /** Keyed by section name. Special key TAKEAWAY_SURCHARGE_KEY holds the takeaway markup. */
  sectionSurcharges: Record<string, SurchargeConfig>;
}

const normalizeSurcharges = (raw: unknown): Record<string, SurchargeConfig> => {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, SurchargeConfig> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number") {
      out[k] = { pct: v, enabled: true };
    } else if (v && typeof v === "object") {
      const pct = Number((v as { pct?: unknown }).pct);
      const enabled = (v as { enabled?: unknown }).enabled !== false;
      if (!isNaN(pct)) out[k] = { pct, enabled };
    }
  }
  return out;
};

export const getSettings = (): BlennixSettings => {
  const saved = typeof window !== "undefined" ? localStorage.getItem("blennix_settings") : null;
  const s = saved ? JSON.parse(saved) : {};
  return {
    restaurantName: s.restaurantName || "Blennix Restaurant",
    taxRate: parseFloat(s.taxRate || "5"),
    taxLabel: s.taxLabel || "GST",
    serviceChargePct: parseFloat(s.serviceChargePct || "5"),
    currency: s.currency || "₹",
    sectionSurcharges: normalizeSurcharges(s.sectionSurcharges),
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
