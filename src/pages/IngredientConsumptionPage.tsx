import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, TrendingDown, Package, IndianRupee, ChevronLeft, ChevronRight } from "lucide-react";
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

const monthLabel = (d: Date) =>
  d.toLocaleString("en-IN", { month: "long", year: "numeric" });

const IngredientConsumptionPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);
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
      const { data: ings } = ingIds.length
        ? await supabase
            .from("ingredients")
            .select("id, name, unit, category")
            .in("id", ingIds)
        : { data: [] as { id: string; name: string; unit: string; category: string | null }[] };

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
    </div>
  );
};

export default IngredientConsumptionPage;