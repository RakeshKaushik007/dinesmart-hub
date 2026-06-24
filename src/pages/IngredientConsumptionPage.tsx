import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, TrendingDown, Package, IndianRupee, ChevronLeft, ChevronRight, Scale, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ConsumptionRow {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  category: string | null;
  total_quantity: number;
  total_cost: number;
  txn_count: number;
}

interface VarianceRow {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  theoretical_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_pct: number | null;
  cost_per_unit: number;
  variance_cost: number;
}

const monthLabel = (d: Date) =>
  d.toLocaleString("en-IN", { month: "long", year: "numeric" });

const IngredientConsumptionPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);
  const [varianceRows, setVarianceRows] = useState<VarianceRow[]>([]);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = prev, etc.

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [monthStart]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Pull all OUT stock transactions in the month
      const { data: txns } = await supabase
        .from("stock_transactions")
        .select("ingredient_id, quantity, total_cost, unit")
        .eq("type", "out")
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", monthEnd.toISOString());

      const ingIds = [...new Set((txns || []).map((t) => t.ingredient_id).filter(Boolean) as string[])];
      // Theoretical: completed orders in the month → order_items × recipe_ingredients
      const { data: completedOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("status", "completed")
        .gte("completed_at", monthStart.toISOString())
        .lt("completed_at", monthEnd.toISOString());
      const orderIds = (completedOrders || []).map((o) => o.id);

      const { data: orderItems } = orderIds.length
        ? await supabase
            .from("order_items")
            .select("menu_item_id, quantity, is_void, is_refunded")
            .in("order_id", orderIds)
        : { data: [] as { menu_item_id: string | null; quantity: number; is_void: boolean | null; is_refunded: boolean | null }[] };

      const menuItemIds = [
        ...new Set(
          (orderItems || [])
            .filter((oi) => oi.menu_item_id && !oi.is_void && !oi.is_refunded)
            .map((oi) => oi.menu_item_id as string)
        ),
      ];

      const { data: recipes } = menuItemIds.length
        ? await supabase
            .from("recipe_ingredients")
            .select("menu_item_id, ingredient_id, quantity")
            .in("menu_item_id", menuItemIds)
        : { data: [] as { menu_item_id: string; ingredient_id: string; quantity: number }[] };

      const recipeByItem = new Map<string, { ingredient_id: string; quantity: number }[]>();
      for (const r of recipes || []) {
        const arr = recipeByItem.get(r.menu_item_id) || [];
        arr.push({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity || 0) });
        recipeByItem.set(r.menu_item_id, arr);
      }

      const theoreticalByIng = new Map<string, number>();
      for (const oi of orderItems || []) {
        if (!oi.menu_item_id || oi.is_void || oi.is_refunded) continue;
        const lines = recipeByItem.get(oi.menu_item_id) || [];
        for (const line of lines) {
          const add = line.quantity * Number(oi.quantity || 0);
          theoreticalByIng.set(
            line.ingredient_id,
            (theoreticalByIng.get(line.ingredient_id) || 0) + add
          );
        }
      }

      const allIngIds = [...new Set([...ingIds, ...theoreticalByIng.keys()])];
      const { data: ings } = allIngIds.length
        ? await supabase
            .from("ingredients")
            .select("id, name, unit, category, cost_per_unit")
            .in("id", allIngIds)
        : { data: [] as { id: string; name: string; unit: string; category: string | null; cost_per_unit: number }[] };

      const ingMap = new Map((ings || []).map((i) => [i.id, i]));
      const agg = new Map<string, ConsumptionRow>();

      for (const t of txns || []) {
        if (!t.ingredient_id) continue;
        const ing = ingMap.get(t.ingredient_id);
        if (!ing) continue;
        const existing = agg.get(t.ingredient_id);
        if (existing) {
          existing.total_quantity += Number(t.quantity || 0);
          existing.total_cost += Number(t.total_cost || 0);
          existing.txn_count += 1;
        } else {
          agg.set(t.ingredient_id, {
            ingredient_id: t.ingredient_id,
            ingredient_name: ing.name,
            unit: ing.unit,
            category: ing.category,
            total_quantity: Number(t.quantity || 0),
            total_cost: Number(t.total_cost || 0),
            txn_count: 1,
          });
        }
      }

      const sorted = [...agg.values()].sort((a, b) => b.total_cost - a.total_cost);
      setRows(sorted);

      // Build variance rows
      const variance: VarianceRow[] = [];
      for (const ingId of allIngIds) {
        const ing = ingMap.get(ingId);
        if (!ing) continue;
        const theoretical = theoreticalByIng.get(ingId) || 0;
        const actual = agg.get(ingId)?.total_quantity || 0;
        if (theoretical === 0 && actual === 0) continue;
        const varianceQty = actual - theoretical;
        const variancePct = theoretical > 0 ? (varianceQty / theoretical) * 100 : null;
        const cpu = Number(ing.cost_per_unit || 0);
        variance.push({
          ingredient_id: ingId,
          ingredient_name: ing.name,
          unit: ing.unit,
          theoretical_qty: theoretical,
          actual_qty: actual,
          variance_qty: varianceQty,
          variance_pct: variancePct,
          cost_per_unit: cpu,
          variance_cost: varianceQty * cpu,
        });
      }
      variance.sort((a, b) => Math.abs(b.variance_cost) - Math.abs(a.variance_cost));
      setVarianceRows(variance);

      setLoading(false);
    };
    load();
  }, [monthStart, monthEnd]);

  const totals = useMemo(() => {
    return {
      ingredientCount: rows.length,
      totalCost: rows.reduce((s, r) => s + r.total_cost, 0),
      totalQty: rows.reduce((s, r) => s + r.total_quantity, 0),
    };
  }, [rows]);

  const varianceTotals = useMemo(() => {
    const theoreticalCost = varianceRows.reduce(
      (s, r) => s + r.theoretical_qty * r.cost_per_unit,
      0
    );
    const actualCost = varianceRows.reduce(
      (s, r) => s + r.actual_qty * r.cost_per_unit,
      0
    );
    const netVarianceCost = actualCost - theoreticalCost;
    const flagged = varianceRows.filter(
      (r) => r.variance_pct !== null && Math.abs(r.variance_pct) >= 5
    ).length;
    return { theoreticalCost, actualCost, netVarianceCost, flagged };
  }, [varianceRows]);

  const exportCSV = () => {
    const header = "Ingredient,Category,Unit,Total Quantity,Total Cost (INR),Transactions\n";
    const lines = rows.map((r) =>
      [
        `"${r.ingredient_name}"`,
        `"${r.category || ""}"`,
        r.unit,
        r.total_quantity.toFixed(3),
        r.total_cost.toFixed(2),
        r.txn_count,
      ].join(",")
    );
    const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ingredient-consumption-${monthStart.toISOString().slice(0, 7)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Ingredient Consumption Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total raw ingredient usage deducted from sold orders, per month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums w-36 text-center">
            {monthLabel(monthStart)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={monthOffset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <Package className="h-3.5 w-3.5" /> Ingredients Consumed
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
            {totals.ingredientCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <IndianRupee className="h-3.5 w-3.5" /> Total Consumption Cost
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
            ₹{totals.totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <TrendingDown className="h-3.5 w-3.5" /> Stock-Out Transactions
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
            {rows.reduce((s, r) => s + r.txn_count, 0)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-sm">
            No ingredient consumption recorded for {monthLabel(monthStart)}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Transactions</TableHead>
                <TableHead className="text-right">Cost (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ingredient_id}>
                  <TableCell className="font-medium">{r.ingredient_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {r.category || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.total_quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 })} {r.unit}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                    {r.txn_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    ₹{r.total_cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Consumption vs. Deductions panel */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Scale className="h-5 w-5" /> Consumption vs. Deductions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Theoretical usage (from sales × recipes) compared to actual stock deductions.
              Variance highlights waste, over-portioning, or untracked consumption.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={varianceRows.length === 0}
            onClick={() => {
              const header =
                "Ingredient,Unit,Theoretical Qty,Actual Qty,Variance Qty,Variance %,Cost/Unit,Variance Cost (INR)\n";
              const lines = varianceRows.map((r) =>
                [
                  `"${r.ingredient_name}"`,
                  r.unit,
                  r.theoretical_qty.toFixed(3),
                  r.actual_qty.toFixed(3),
                  r.variance_qty.toFixed(3),
                  r.variance_pct === null ? "" : r.variance_pct.toFixed(2),
                  r.cost_per_unit.toFixed(2),
                  r.variance_cost.toFixed(2),
                ].join(",")
              );
              const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `consumption-vs-deductions-${monthStart.toISOString().slice(0, 7)}.csv`;
              a.click();
            }}
          >
            <Download className="h-4 w-4 mr-2" /> Export Variance CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Theoretical Cost</div>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
              ₹{varianceTotals.theoreticalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Based on sales × recipes</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Actual Cost</div>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
              ₹{varianceTotals.actualCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Deducted from stock</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Net Variance</div>
            <p
              className={`text-2xl font-bold tabular-nums mt-1 ${
                Math.abs(varianceTotals.netVarianceCost) < 1
                  ? "text-foreground"
                  : varianceTotals.netVarianceCost > 0
                  ? "text-stock-out"
                  : "text-stock-low"
              }`}
            >
              {varianceTotals.netVarianceCost >= 0 ? "+" : ""}
              ₹{varianceTotals.netVarianceCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Actual − Theoretical</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5" /> Flagged Items
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{varianceTotals.flagged}</p>
            <p className="text-xs text-muted-foreground mt-1">Variance ≥ 5%</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : varianceRows.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">
              No comparable data for {monthLabel(monthStart)}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Theoretical</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Variance %</TableHead>
                  <TableHead className="text-right">Cost Impact (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varianceRows.map((r) => {
                  const flagged = r.variance_pct !== null && Math.abs(r.variance_pct) >= 5;
                  const over = r.variance_qty > 0;
                  return (
                    <TableRow key={r.ingredient_id}>
                      <TableCell className="font-medium">{r.ingredient_name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.theoretical_qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })} {r.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.actual_qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })} {r.unit}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          flagged ? (over ? "text-stock-out" : "text-stock-low") : "text-foreground"
                        }`}
                      >
                        {r.variance_qty >= 0 ? "+" : ""}
                        {r.variance_qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })} {r.unit}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums hidden sm:table-cell ${
                          flagged ? (over ? "text-stock-out" : "text-stock-low") : "text-muted-foreground"
                        }`}
                      >
                        {r.variance_pct === null
                          ? "—"
                          : `${r.variance_pct >= 0 ? "+" : ""}${r.variance_pct.toFixed(1)}%`}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-semibold ${
                          flagged ? (over ? "text-stock-out" : "text-stock-low") : "text-foreground"
                        }`}
                      >
                        {r.variance_cost >= 0 ? "+" : ""}
                        ₹{r.variance_cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngredientConsumptionPage;