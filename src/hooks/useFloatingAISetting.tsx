import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SETTING_KEY = "floating_ai_assistant";

/**
 * Reads (and lets super admins write) the global "floating AI assistant" toggle
 * stored in public.app_settings. Subscribes to realtime changes so flipping the
 * switch in one tab/role propagates to every active session.
 */
export const useFloatingAISetting = () => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    const next = (data as any)?.value?.enabled;
    setEnabled(next === false ? false : true);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("app_settings:floating_ai")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${SETTING_KEY}` },
        (payload: any) => {
          const v = payload?.new?.value?.enabled;
          if (typeof v === "boolean") setEnabled(v);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setEnabledRemote = useCallback(async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert({ key: SETTING_KEY, value: { enabled: next }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (!error) setEnabled(next);
    return { error };
  }, []);

  return { enabled, loading, saving, setEnabled: setEnabledRemote };
};