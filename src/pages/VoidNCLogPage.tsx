import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ban, Gift, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VoidNCEntry {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_void: boolean;
  is_nc: boolean;
  void_reason: string | null;
  created_at: string;
  order_number: number;
  voided_by_name: string | null;
}

const VoidNCLogPage = () => {
  const [entries, setEntries] = useState<VoidNCEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "void" | "nc">("all");

  useEffect(() => {
    const fetchData = async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, item_name, quantity, unit_price, total_price, is_void, is_nc, void_reason, voided_by, created_at, order_id")
        .or("is_void.eq.true,is_nc.eq.true")
        .order("created_at", { ascending: false });

      if (!items || items.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const orderIds = [...new Set(items.map((i) => i.order_id))];
      const voidedByIds = [...new Set(items.map((i) => i.voided_by).filter(Boolean))] as string[];

      const [ordersRes, profilesRes] = await Promise.all([
        supabase.from("orders").select("id, order_number").in("id", orderIds),
        voidedByIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", voidedByIds)
          : Promise.resolve({ data: [] }),
      ]);

      const orderMap = Object.fromEntries((ordersRes.data || []).map((o) => [o.id, o.order_number]));
      const profileMap = Object.fromEntries((profilesRes.data || []).map((p) => [p.user_id, p.full_name]));

      setEntries(
        items.map((i) => ({
          id: i.id,
          item_name: i.item_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
          is_void: !!i.is_void,
          is_nc: !!i.is_nc,
          void_reason: i.void_reason,
          created_at: i.created_at,
          order_number: orderMap[i.order_id] || 0,
          voided_by_name: i.voided_by ? profileMap[i.voided_by] || "Unknown" : null,
        }))
      );
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = entries.filter((e) => {
    if (filter === "void" && !e.is_void) return false;
    if (filter === "nc" && !e.is_nc) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.item_name.toLowerCase().includes(q) || String(e.order_number).includes(q);
    }
    return true;
  });

  const totalVoidValue = filtered.filter((e) => e.is_void).reduce((s, e) => s + e.total_price, 0);
  const totalNCValue = filtered.filter((e) => e.is_nc).reduce((s, e) => s + e.unit_price * e.quantity, 0);

  const exportCSV = () => {
    const header = "Order#,Item,Qty,Price,Type,Reason,Staff,Time\n";
    const rows = filtered.map((e) =>
      [
        e.order_number,
        `"${e.item_name}"`,
        e.quantity,
        e.total_price,
        e.is_void ? "VOID" : "NC",
        `"${e.void_reason || ""}"`,
        `"${e.voided_by_name || ""}"`,
        new Date(e.created_at).toLocaleString("en-IN"),
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `void-nc-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Void / NC Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all voided and non-chargeable items</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Void Items</p>
          <p className="text-2xl font-bold text-destructive tabular-nums mt-1">{entries.filter((e) => e.is_void).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Void Value</p>
          <p className="text-2xl font-bold text-destructive tabular-nums mt-1">₹{totalVoidValue.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">NC Items</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">{entries.filter((e) => e.is_nc).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">NC Value</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">₹{totalNCValue.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search item or order #..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(["all", "void", "nc"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f === "all" ? "All" : f === "void" ? "Voided" : "NC"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="hidden sm:table-cell">Qty</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead className="hidden lg:table-cell">Staff</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden sm:table-cell">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No void or NC entries found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium tabular-nums">#{e.order_number}</TableCell>
                  <TableCell>{e.item_name}</TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">{e.quantity}</TableCell>
                  <TableCell>
                    {e.is_void ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        <Ban className="h-3 w-3" /> VOID
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Gift className="h-3 w-3" /> NC
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{e.void_reason || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{e.voided_by_name || "—"}</TableCell>
                  <TableCell className="tabular-nums">₹{e.total_price.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {new Date(e.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default VoidNCLogPage;
