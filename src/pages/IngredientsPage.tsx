import { useState } from "react";
import { Search, Filter, Plus } from "lucide-react";
import StockBadge from "@/components/inventory/StockBadge";
import { ingredients } from "@/data/mockInventory";
import type { StockStatus } from "@/data/mockInventory";

const categories = ["All", ...new Set(ingredients.map((i) => i.category))];
const statusFilters: { label: string; value: StockStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "In Stock", value: "good" },
  { label: "Low", value: "low" },
  { label: "Out", value: "out" },
  { label: "Expiring", value: "expiring" },
];

const IngredientsPage = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");

  const filtered = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ingredients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage raw materials and stock levels</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Ingredient
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {statusFilters.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Ingredient</th>
              <th className="text-left px-5 py-3 font-medium">Category</th>
              <th className="text-right px-5 py-3 font-medium">Stock</th>
              <th className="text-right px-5 py-3 font-medium">Min Threshold</th>
              <th className="text-right px-5 py-3 font-medium">Cost/Unit</th>
              <th className="text-left px-5 py-3 font-medium">Expiry</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5 font-medium text-card-foreground">{item.name}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{item.category}</td>
                <td className="px-5 py-3.5 text-right font-mono text-card-foreground">
                  {item.currentStock} {item.unit}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                  {item.minThreshold} {item.unit}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-card-foreground">₹{item.costPerUnit}</td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <StockBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No ingredients match your filters.</div>
        )}
      </div>
    </div>
  );
};

export default IngredientsPage;
