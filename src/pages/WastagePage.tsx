import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const reasonStyles: Record<string, string> = {
  expired: "bg-destructive/10 text-destructive",
  spoiled: "bg-amber-500/10 text-amber-600",
  spilled: "bg-blue-500/10 text-blue-600",
  over_cooking: "bg-orange-500/10 text-orange-600",
  discrepancy: "bg-purple-500/10 text-purple-600",
};

const WastagePage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("wastage_logs")
        .select("*")
        .order("created_at", { ascending: false });
      setLogs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const totalWaste = logs.reduce((s, l) => s + Number(l.cost), 0);
  const reasons = logs.map(l => l.reason);
  const topReason = reasons.length > 0
    ? [...new Set(reasons)].sort((a, b) => reasons.filter(r => r === b).length - reasons.filter(r => r === a).length)[0]
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wastage & Discrepancy Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Track waste, spoilage, and stock mismatches</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Log Wastage
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-destructive/30 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Waste</p>
          <p className="mt-2 text-2xl font-bold text-destructive font-mono">₹{totalWaste.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Incidents</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{logs.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Top Reason</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground capitalize">{topReason.replace("_", " ")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Item</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-right px-5 py-3 font-medium">Qty</th>
                <th className="text-left px-5 py-3 font-medium">Reason</th>
                <th className="text-right px-5 py-3 font-medium">Cost</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-card-foreground">{log.ingredient_name}</p>
                    {log.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{log.notes}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{log.category}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-card-foreground">{log.quantity} {log.unit}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${reasonStyles[log.reason] || "bg-muted text-muted-foreground"}`}>
                      {log.reason.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-destructive font-semibold">₹{Number(log.cost).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs hidden lg:table-cell">
                    {new Date(log.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">No wastage logs recorded.</div>}
      </div>
    </div>
  );
};

export default WastagePage;
