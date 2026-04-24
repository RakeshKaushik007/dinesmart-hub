import { useEffect, useState } from "react";
import { Building2, ToggleLeft, ToggleRight, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  id: string;
  name: string;
  location: string;
  todayRevenue: number;
  todayOrders: number;
  avgOrderValue: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
  status: "online" | "offline";
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const MultiBranchPage = () => {
  const [combined, setCombined] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = startOfDay(new Date());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

        const { data: branchRows, error: bErr } = await supabase
          .from("branches")
          .select("id, name, address, is_active")
          .order("name");
        if (bErr) throw bErr;

        const { data: orders, error: oErr } = await supabase
          .from("orders")
          .select("id, branch_id, total, completed_at, status")
          .eq("status", "completed")
          .gte("completed_at", yesterday.toISOString());
        if (oErr) throw oErr;

        const list: Branch[] = (branchRows ?? []).map((b) => {
          const todayOrders = (orders ?? []).filter((o) => o.branch_id === b.id && o.completed_at && new Date(o.completed_at) >= today);
          const ydayOrders = (orders ?? []).filter((o) => o.branch_id === b.id && o.completed_at && new Date(o.completed_at) >= yesterday && new Date(o.completed_at) < today);
          const todayRev = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
          const ydayRev = ydayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
          let trend: "up" | "down" | "stable" = "stable";
          let trendPercent = 0;
          if (ydayRev > 0) {
            trendPercent = Math.round(((todayRev - ydayRev) / ydayRev) * 100);
            trend = trendPercent > 1 ? "up" : trendPercent < -1 ? "down" : "stable";
          } else if (todayRev > 0) {
            trend = "up"; trendPercent = 100;
          }
          return {
            id: b.id,
            name: b.name,
            location: b.address ?? "—",
            todayRevenue: todayRev,
            todayOrders: todayOrders.length,
            avgOrderValue: todayOrders.length > 0 ? Math.round(todayRev / todayOrders.length) : 0,
            trend,
            trendPercent: Math.abs(trendPercent),
            status: b.is_active ? "online" : "offline",
          };
        });

        setBranches(list);
      } catch (err) {
        console.error("Multi-branch fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeBranches = branches.filter((b) => b.status === "online");
  const totalRevenue = activeBranches.reduce((s, b) => s + b.todayRevenue, 0);
  const totalOrders = activeBranches.reduce((s, b) => s + b.todayOrders, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Multi-Branch</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Performance across all locations</p>
          </div>
        </div>
        <button
          onClick={() => setCombined(!combined)}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          {combined ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
          {combined ? "Combined View" : "Individual View"}
        </button>
      </div>

      {branches.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No branches configured yet.</p>
        </div>
      )}

      {combined && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-primary/30 bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{Math.round(totalRevenue).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Orders</p>
            <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{totalOrders}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Branches</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 font-mono">{activeBranches.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Order Value</p>
            <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((branch) => (
          <div key={branch.id} className={`rounded-xl border bg-card p-5 ${branch.status === "offline" ? "opacity-50 border-border" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">{branch.name}</h3>
                <p className="text-xs text-muted-foreground">{branch.location}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                branch.status === "online" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
              }`}>
                {branch.status}
              </span>
            </div>
            {branch.status === "online" ? (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-sm font-bold font-mono text-card-foreground mt-0.5">₹{Math.round(branch.todayRevenue).toLocaleString()}</p>
                  {branch.trend !== "stable" ? (
                    <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${branch.trend === "up" ? "text-emerald-600" : "text-destructive"}`}>
                      {branch.trend === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                      {branch.trendPercent}% vs yest.
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">vs yesterday</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-sm font-bold font-mono text-card-foreground mt-0.5">{branch.todayOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Value</p>
                  <p className="text-sm font-bold font-mono text-card-foreground mt-0.5">₹{branch.avgOrderValue}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Branch is currently inactive</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiBranchPage;
