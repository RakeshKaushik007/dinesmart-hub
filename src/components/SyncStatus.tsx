import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CloudOff, Check, UploadCloud } from "lucide-react";

interface SyncState {
  online: boolean;
  pending_orders: number;
  last_push_at: string | null;
  last_error: string | null;
}

/**
 * Shows whether this till's orders are reaching the cloud.
 *
 * It reads a record the store server keeps about itself. On the normal cloud
 * app that record does not exist, so this shows nothing at all and the screen
 * is unchanged.
 */
const SyncStatus = () => {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    let active = true;

    const read = async () => {
      try {
        const { data, error } = await supabase
          .from("sync_status" as any)
          .select("online, pending_orders, last_push_at, last_error")
          .eq("id", 1)
          .maybeSingle();
        if (!active) return;
        setState(error || !data ? null : (data as unknown as SyncState));
      } catch {
        if (active) setState(null);
      }
    };

    read();
    const timer = window.setInterval(read, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!state) return null;

  const waiting = Number(state.pending_orders ?? 0);

  if (!state.online) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 mb-3 text-amber-700 dark:text-amber-300">
        <CloudOff className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">
          Working offline
          {waiting > 0
            ? ` - ${waiting} order${waiting === 1 ? "" : "s"} saved here, they will be sent when the connection returns`
            : " - orders are saved here and sent when the connection returns"}
        </p>
      </div>
    );
  }

  if (waiting > 0) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        <UploadCloud className="h-3 w-3" />
        <span>Sending {waiting} order{waiting === 1 ? "" : "s"} to the cloud...</span>
      </div>
    );
  }

  const at = state.last_push_at
    ? new Date(state.last_push_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
      <Check className="h-3 w-3 text-emerald-500" />
      <span>In step with the cloud{at ? ` - last sent ${at}` : ""}</span>
    </div>
  );
};

export default SyncStatus;
