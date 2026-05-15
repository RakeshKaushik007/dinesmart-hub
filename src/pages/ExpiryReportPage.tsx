import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Row {
  ingredient_id: string;
  ingredient_name: string;
  is_prep: boolean;
  unit: string;
  consumed_qty: number;
  consumed_cost: number;
  expired_qty: number;
  expired_cost: number;
}

const ExpiryReportPage = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("expiry_consumption_report", { _days: 30 });
    if (error) toast({ title: "Failed to load report", description: error.message, variant: "destructive" });
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    const { error } = await supabase.rpc("scan_expiry_alerts");
    if (error) toast({ title: "Scan failed", description: error.message, variant: "destructive" });
    else toast({ title: "Expiry scan complete", description: "New alerts pushed to Alerts page if any items were found." });
    setScanning(false);
    load();
  };

  const exportCsv = () => {
    const header = ["Ingredient","Type","Unit","Consumed Qty","Consumed Cost","Expired Qty","Expired Cost"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        `"${r.ingredient_name.replace(/"/g, '""')}"`,
        r.is_prep ? "Prep" : "Raw",
        r.unit,
        Number(r.consumed_qty).toFixed(3),
        Number(r.consumed_cost).toFixed(2),
        Number(r.expired_qty).toFixed(3),
        Number(r.expired_cost).toFixed(2),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expiry-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totals = rows.reduce((acc, r) => ({
    consumedCost: acc.consumedCost + Number(r.consumed_cost || 0),
    expiredCost: acc.expiredCost + Number(r.expired_cost || 0),
  }), { consumedCost: 0, expiredCost: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Expiry & Consumption Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Last 30 days, grouped by ingredient (raw + prep).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runScan} disabled={scanning}>
            {scanning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Scan for expiry alerts
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Consumed cost (30d)</p>
          <p className="text-2xl font-bold font-mono text-card-foreground mt-1">₹{totals.consumedCost.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Expired/wasted cost (30d)</p>
          <p className="text-2xl font-bold font-mono text-destructive mt-1">₹{totals.expiredCost.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No consumption or expiry recorded in the last 30 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Ingredient</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-right px-4 py-2.5">Consumed</th>
                  <th className="text-right px-4 py-2.5">Consumed ₹</th>
                  <th className="text-right px-4 py-2.5">Expired</th>
                  <th className="text-right px-4 py-2.5">Expired ₹</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ingredient_id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-card-foreground">{r.ingredient_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${r.is_prep ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {r.is_prep ? "Prep" : "Raw"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(r.consumed_qty).toFixed(3)} {r.unit}</td>
                    <td className="px-4 py-2.5 text-right font-mono">₹{Number(r.consumed_cost).toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${Number(r.expired_qty) > 0 ? "text-destructive" : ""}`}>
                      {Number(r.expired_qty).toFixed(3)} {r.unit}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${Number(r.expired_cost) > 0 ? "text-destructive" : ""}`}>
                      ₹{Number(r.expired_cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpiryReportPage;