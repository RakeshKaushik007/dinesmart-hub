import { useEffect, useState } from "react";
import { Package, AlertTriangle, PackageX, TrendingDown, Loader2 } from "lucide-react";
import StatCard from "@/components/inventory/StatCard";
import StockBadge from "@/components/inventory/StockBadge";
import AlertItem from "@/components/inventory/AlertItem";
import { supabase } from "@/integrations/supabase/client";
import type { StockStatus } from "@/data/mockInventory";

interface IngredientRow {
  id: string;
  name: string;
  category: string | null;
  current_stock: number;
  unit: string;
  cost_per_unit: number;
  status: string;
}

interface AlertRow {
  id: string;
  type: string;
  ingredient_name: string;
  message: string;
  created_at: string;
  resolved: boolean;
}

const InventoryOverview = () => {
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [ingRes, alertRes] = await Promise.all([
        supabase.from("ingredients").select("id, name, category, current_stock, unit, cost_per_unit, status").order("name"),
        supabase.from("stock_alerts").select("id, type, ingredient_name, message, created_at, resolved").order("created_at", { ascending: false }).limit(20),
      ]);
      if (!ingRes.error) setIngredients((ingRes.data as IngredientRow[]) ?? []);
      if (!alertRes.error) setAlerts((alertRes.data as AlertRow[]) ?? []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalItems = ingredients.length;
  const lowStockItems = ingredients.filter((i) => i.status === "low").length;
  const outOfStockItems = ingredients.filter((i) => i.status === "out").length;
  const expiringItems = ingredients.filter((i) => i.status === "expiring").length;
  const totalValue = ingredients.reduce((sum, i) => sum + (Number(i.current_stock) || 0) * (Number(i.cost_per_unit) || 0), 0);
  const activeAlerts = alerts.filter((a) => !a.resolved);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time stock health across all categories</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Items" value={totalItems} icon={Package} trend={`₹${Math.round(totalValue).toLocaleString()} value`} variant="default" />
        <StatCard label="Low Stock" value={lowStockItems} icon={TrendingDown} trend="Below threshold" variant="warning" />
        <StatCard label="Out of Stock" value={outOfStockItems} icon={PackageX} trend="Dishes disabled" variant="danger" />
        <StatCard label="Expiring Soon" value={expiringItems} icon={AlertTriangle} trend="Within 7 days" variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick stock table */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground">Stock Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Item</th>
                  <th className="text-left px-5 py-3 font-medium">Category</th>
                  <th className="text-right px-5 py-3 font-medium">Stock</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">No ingredients added yet.</td>
                  </tr>
                )}
                {ingredients.slice(0, 8).map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-card-foreground">{item.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.category ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-mono text-card-foreground">
                      {Number(item.current_stock)} {item.unit}
                    </td>
                    <td className="px-5 py-3">
                      <StockBadge status={item.status as StockStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts panel */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-card-foreground">Active Alerts</h2>
            <span className="text-xs font-mono bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
              {activeAlerts.length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {activeAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No active alerts.</p>
            ) : (
              activeAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={{
                    id: alert.id,
                    type: (alert.type === "out_of_stock" || alert.type === "expiring" ? alert.type : "low_stock") as "low_stock" | "out_of_stock" | "expiring",
                    ingredientName: alert.ingredient_name,
                    message: alert.message,
                    timestamp: alert.created_at,
                    resolved: alert.resolved,
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryOverview;
