import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const alertTypeStyles: Record<string, string> = {
  out_of_stock: "border-destructive/40 bg-destructive/5",
  low_stock: "border-amber-500/40 bg-amber-500/5",
  expiring: "border-orange-500/40 bg-orange-500/5",
};

const AlertsPage = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = async () => {
    const query = supabase.from("stock_alerts").select("*").order("created_at", { ascending: false });
    if (!showResolved) query.eq("resolved", false);
    const { data } = await query;
    setAlerts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, [showResolved]);

  useEffect(() => {
    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_alerts" }, () => fetchAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [showResolved]);

  const resolveAlert = async (id: string) => {
    await supabase.from("stock_alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    fetchAlerts();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Low stock, out-of-stock, and expiry notifications</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded border-input accent-primary" />
          Show resolved
        </label>
      </div>

      <div className="space-y-3 max-w-2xl">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No active alerts — everything looks good! 🎉</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`rounded-lg border p-4 ${alertTypeStyles[alert.type] || "border-border"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.type === "out_of_stock" ? "text-destructive" : alert.type === "low_stock" ? "text-amber-500" : "text-orange-500"}`} />
                  <div>
                    <p className="font-medium text-foreground">{alert.ingredient_name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                {!alert.resolved && (
                  <button onClick={() => resolveAlert(alert.id)}
                    className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
