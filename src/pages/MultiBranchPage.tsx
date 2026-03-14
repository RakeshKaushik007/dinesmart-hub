import { useState } from "react";
import { Building2, ToggleLeft, ToggleRight, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  location: string;
  todayRevenue: number;
  todayOrders: number;
  avgOrderValue: number;
  trend: "up" | "down";
  trendPercent: number;
  status: "online" | "offline";
}

const mockBranches: Branch[] = [
  { id: "b1", name: "Main Branch", location: "MG Road, Bangalore", todayRevenue: 28450, todayOrders: 47, avgOrderValue: 605, trend: "up", trendPercent: 12, status: "online" },
  { id: "b2", name: "Indiranagar", location: "100 Feet Road", todayRevenue: 22100, todayOrders: 38, avgOrderValue: 581, trend: "up", trendPercent: 8, status: "online" },
  { id: "b3", name: "Koramangala", location: "80 Feet Road", todayRevenue: 18300, todayOrders: 31, avgOrderValue: 590, trend: "down", trendPercent: 3, status: "online" },
  { id: "b4", name: "Whitefield", location: "ITPL Main Road", todayRevenue: 0, todayOrders: 0, avgOrderValue: 0, trend: "down", trendPercent: 0, status: "offline" },
];

const MultiBranchPage = () => {
  const [combined, setCombined] = useState(true);
  const activeBranches = mockBranches.filter(b => b.status === "online");
  const totalRevenue = activeBranches.reduce((s, b) => s + b.todayRevenue, 0);
  const totalOrders = activeBranches.reduce((s, b) => s + b.todayOrders, 0);

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

      {combined && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-primary/30 bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{totalRevenue.toLocaleString()}</p>
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
        {mockBranches.map((branch) => (
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
                  <p className="text-sm font-bold font-mono text-card-foreground mt-0.5">₹{branch.todayRevenue.toLocaleString()}</p>
                  <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${branch.trend === "up" ? "text-emerald-600" : "text-destructive"}`}>
                    {branch.trend === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {branch.trendPercent}%
                  </p>
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
              <p className="text-xs text-muted-foreground mt-2">Branch is currently offline</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiBranchPage;
