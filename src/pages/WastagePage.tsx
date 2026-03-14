import { useState } from "react";
import { Trash2, Plus, AlertTriangle } from "lucide-react";

interface WastageLog {
  id: string;
  ingredientName: string;
  category: string;
  quantity: number;
  unit: string;
  reason: "expired" | "spoiled" | "spilled" | "overcooked" | "discrepancy";
  cost: number;
  loggedBy: string;
  timestamp: string;
  notes: string;
}

const mockLogs: WastageLog[] = [
  { id: "w1", ingredientName: "Tomatoes", category: "Vegetables", quantity: 2, unit: "kg", reason: "expired", cost: 80, loggedBy: "Ravi K.", timestamp: "2026-03-14T08:30:00", notes: "Found soft and moldy in cold storage" },
  { id: "w2", ingredientName: "Cream", category: "Dairy", quantity: 0.5, unit: "L", reason: "spoiled", cost: 110, loggedBy: "Anita S.", timestamp: "2026-03-13T17:00:00", notes: "Sour smell, discarded" },
  { id: "w3", ingredientName: "Chicken Breast", category: "Protein", quantity: 1, unit: "kg", reason: "overcooked", cost: 280, loggedBy: "Chef Manoj", timestamp: "2026-03-13T13:45:00", notes: "Burnt during rush hour" },
  { id: "w4", ingredientName: "Cooking Oil", category: "Oils", quantity: 2, unit: "L", reason: "spilled", cost: 360, loggedBy: "Ravi K.", timestamp: "2026-03-12T11:00:00", notes: "Container fell off shelf" },
  { id: "w5", ingredientName: "Basmati Rice", category: "Grains", quantity: 3, unit: "kg", reason: "discrepancy", cost: 255, loggedBy: "Anita S.", timestamp: "2026-03-11T20:00:00", notes: "Physical count 3kg less than system" },
];

const reasonStyles: Record<string, string> = {
  expired: "bg-destructive/10 text-destructive",
  spoiled: "bg-amber-500/10 text-amber-600",
  spilled: "bg-blue-500/10 text-blue-600",
  overcooked: "bg-orange-500/10 text-orange-600",
  discrepancy: "bg-purple-500/10 text-purple-600",
};

const WastagePage = () => {
  const totalWaste = mockLogs.reduce((s, l) => s + l.cost, 0);

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
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Waste (This Week)</p>
          <p className="mt-2 text-2xl font-bold text-destructive font-mono">₹{totalWaste.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Incidents</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{mockLogs.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Top Reason</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground">Expired</p>
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
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Logged By</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockLogs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-card-foreground">{log.ingredientName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 lg:hidden">{log.notes}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{log.category}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-card-foreground">{log.quantity} {log.unit}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${reasonStyles[log.reason]}`}>
                      {log.reason}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-destructive font-semibold">₹{log.cost}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{log.loggedBy}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs hidden lg:table-cell">
                    {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WastagePage;
