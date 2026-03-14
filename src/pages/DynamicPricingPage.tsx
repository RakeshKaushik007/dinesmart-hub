import { useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Edit3 } from "lucide-react";

interface PricedIngredient {
  id: string;
  name: string;
  category: string;
  manualPrice: number | null;
  marketPrice: number;
  currentPrice: number;
  unit: string;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
}

const mockPricing: PricedIngredient[] = [
  { id: "1", name: "Paneer", category: "Dairy", manualPrice: 320, marketPrice: 340, currentPrice: 320, unit: "kg", trend: "up", lastUpdated: "2026-03-14T08:00:00" },
  { id: "2", name: "Chicken Breast", category: "Protein", manualPrice: null, marketPrice: 295, currentPrice: 295, unit: "kg", trend: "up", lastUpdated: "2026-03-14T08:00:00" },
  { id: "3", name: "Basmati Rice", category: "Grains", manualPrice: 85, marketPrice: 82, currentPrice: 85, unit: "kg", trend: "down", lastUpdated: "2026-03-14T08:00:00" },
  { id: "4", name: "Tomatoes", category: "Vegetables", manualPrice: null, marketPrice: 45, currentPrice: 45, unit: "kg", trend: "up", lastUpdated: "2026-03-14T08:00:00" },
  { id: "5", name: "Cooking Oil", category: "Oils", manualPrice: 180, marketPrice: 190, currentPrice: 180, unit: "L", trend: "up", lastUpdated: "2026-03-14T08:00:00" },
  { id: "6", name: "Garam Masala", category: "Spices", manualPrice: 650, marketPrice: 680, currentPrice: 650, unit: "kg", trend: "stable", lastUpdated: "2026-03-14T08:00:00" },
  { id: "7", name: "Onions", category: "Vegetables", manualPrice: null, marketPrice: 30, currentPrice: 30, unit: "kg", trend: "down", lastUpdated: "2026-03-14T08:00:00" },
  { id: "8", name: "Cream", category: "Dairy", manualPrice: 220, marketPrice: 235, currentPrice: 220, unit: "L", trend: "up", lastUpdated: "2026-03-14T08:00:00" },
];

const DynamicPricingPage = () => {
  const autoCount = mockPricing.filter(p => !p.manualPrice).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dynamic Base Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">Auto-sync market prices or set manual overrides</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <RefreshCw className="h-4 w-4" />
          Sync Market Prices
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Items</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{mockPricing.length}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Auto-Priced</p>
          <p className="mt-2 text-2xl font-bold text-primary font-mono">{autoCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Using market rates</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Manual Override</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{mockPricing.length - autoCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Ingredient</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-right px-5 py-3 font-medium">Market Price</th>
                <th className="text-right px-5 py-3 font-medium">Current Price</th>
                <th className="text-left px-5 py-3 font-medium">Source</th>
                <th className="text-left px-5 py-3 font-medium">Trend</th>
                <th className="text-right px-5 py-3 font-medium hidden md:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPricing.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-card-foreground">{item.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{item.category}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">₹{item.marketPrice}/{item.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-card-foreground">₹{item.currentPrice}/{item.unit}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      item.manualPrice ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                    }`}>
                      {item.manualPrice ? "Manual" : "Auto"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {item.trend === "up" && <TrendingUp className="h-4 w-4 text-destructive" />}
                    {item.trend === "down" && <TrendingDown className="h-4 w-4 text-emerald-500" />}
                    {item.trend === "stable" && <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right hidden md:table-cell">
                    <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
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

export default DynamicPricingPage;
