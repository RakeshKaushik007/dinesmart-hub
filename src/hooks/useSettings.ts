import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/hooks/useActiveBranch";

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

const STORAGE_KEY = "blennix_settings";

export const normalizeSurcharges = (raw: unknown): Record<string, SurchargeConfig> => {
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
  const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const s = saved ? JSON.parse(saved) : {};
  return {
    restaurantName: s.restaurantName || "Blennix Restaurant",
    taxRate: parseFloat(s.taxRate || "5"),
    taxLabel: s.taxLabel || "GST",
    serviceChargePct: parseFloat(s.serviceChargePct || "5"),
    currency: s.currency || "\u20b9",
    sectionSurcharges: normalizeSurcharges(s.sectionSurcharges),
  };
};

/** Store values on this device and tell every open screen to re-read them. */
export const cacheSettings = (raw: Record<string, unknown>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    window.dispatchEvent(new Event("blennix_settings_changed"));
  } catch {
    /* storage unavailable - the screen keeps the values it already has */
  }
};

/**
 * Save settings for a whole branch, so every till bills the same way, and
 * update this device immediately. Before this existed, tax and charges lived
 * only in each browser, so two tills could bill at different rates.
 */
export const saveBranchSettings = async (
  branchId: string,
  raw: Record<string, unknown>,
  userId?: string | null,
) => {
  const { error } = await supabase
    .from("branch_settings" as any)
    .upsert(
      {
        branch_id: branchId,
        value: raw,
        updated_at: new Date().toISOString(),
        updated_by: userId ?? null,
      },
      { onConflict: "branch_id" },
    );
  if (!error) cacheSettings(raw);
  return { error };
};

export const useSettings = (): BlennixSettings => {
  const { branchId } = useActiveBranch();

  // Re-read on storage changes so updates from the Settings page reflect immediately.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setTick(t => t + 1); };
    const onCustom = () => setTick(t => t + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener("blennix_settings_changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("blennix_settings_changed", onCustom);
    };
  }, []);

  // Pull the branch's shared settings once the branch is known. Until they
  // arrive - and for as long as nobody has saved any - the device keeps using
  // its own values, so billing behaves exactly as it did before.
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("branch_settings" as any)
        .select("value")
        .eq("branch_id", branchId)
        .maybeSingle();
      const value = (data as any)?.value;
      if (cancelled || !value || typeof value !== "object") return;
      if (localStorage.getItem(STORAGE_KEY) !== JSON.stringify(value)) {
        cacheSettings(value as Record<string, unknown>);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId]);

  return useMemo(() => getSettings(), [tick]);
};
