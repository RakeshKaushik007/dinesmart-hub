import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ban, Gift, Download, Search, Undo2 } from "lucide-react";
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

type EntryKind = "void" | "nc" | "refund";

interface LogEntry {
  id: string;
  kind: EntryKind;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  reason: string | null;
  staff_name: string | null;
  timestamp: string;
  order_number: number;
}

const VoidNCLogPage = () => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | EntryKind>("all");

  useEffect(() => {
    const fetchData = async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select(
          "id, item_name, quantity, unit_price, total_price, is_void, is_nc, is_refunded, void_reason, nc_reason, refund_reason, voided_by, refunded_by, refunded_at, created_at, order_id"
        )
        .or("is_void.eq.true,is_nc.eq.true,is_refunded.eq.true")
        .order("created_at", { ascending: false });

      if (!items || items.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const orderIds = [...new Set(items.map((i) => i.order_id))];
      const staffIds = [
        ...new Set(
          items.flatMap((i) => [i.voided_by, i.refunded_by]).filter(Boolean) as string[]
        ),
      ];

      const [ordersRes, profilesRes] = await Promise.all([
        supabase.from("orders").select("id, order_number").in("id", orderIds),
        staffIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", staffIds)
          : Promise.resolve({ data: [] }),
      ]);

      const orderMap = Object.fromEntries(
        (ordersRes.data || []).map((o) => [o.id, o.order_number])
      );
      const profileMap = Object.fromEntries(
        (profilesRes.data || []).map((p) => [p.user_id, p.full_name])
      );

      const expanded: LogEntry[] = [];
      items.forEach((i) => {
        const orderNum = orderMap[i.order_id] || 0;
        if (i.is_void) {
          expanded.push({
            id: `${i.id}-void`,
            kind: "void",
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.total_price,
            reason: i.void_reason,
            staff_name: i.voided_by ? profileMap[i.voided_by] || "Unknown" : null,
            timestamp: i.created_at,
            order_number: orderNum,
          });
        }
        if (i.is_nc) {
          expanded.push({
            id: `${i.id}-nc`,
            kind: "nc",
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.unit_price * i.quantity,
            reason: i.nc_reason || i.void_reason,
            staff_name: i.voided_by ? profileMap[i.voided_by] || "Unknown" : null,
            timestamp: i.created_at,
            order_number: orderNum,
          });
        }
        if (i.is_refunded) {
          expanded.push({
            id: `${i.id}-refund`,
            kind: "refund",
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.total_price,
            reason: i.refund_reason,
            staff_name: i.refunded_by ? profileMap[i.refunded_by] || "Unknown" : null,
            timestamp: i.refunded_at || i.created_at,
            order_number: orderNum,
          });
        }
      });

      expanded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEntries(expanded);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = entries.filter((e) => {
    if (filter !== "all" && e.kind !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.item_name.toLowerCase().includes(q) || String(e.order_number).includes(q);
    }
    return true;
  });

  const totals = {
    void: entries.filter((e) => e.kind === "void").reduce((s, e) => s + e.total_price, 0),
    nc: entries.filter((e) => e.kind === "nc").reduce((s, e) => s + e.total_price, 0),
    refund: entries.filter((e) => e.kind === "refund").reduce((s, e) => s + e.total_price, 0),
  };
  const counts = {
    void: entries.filter((e) => e.kind === "void").length,
    nc: entries.filter((e) => e.kind === "nc").length,
    refund: entries.filter((e) => e.kind === "refund").length,
  };

  const exportCSV = () => {
    const header = "Order#,Item,Qty,Price,Type,Reason,Staff,Time\n";
    const rows = filtered.map((e) =>
      [
        e.order_number,
        `"${e.item_name}"`,
        e.quantity,
        e.total_price,
        e.kind.toUpperCase(),
        `"${e.reason || ""}"`,
        `"${e.staff_name || ""}"`,
        new Date(e.timestamp).toLocaleString("en-IN"),
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `void-nc-refund-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderBadge = (kind: EntryKind) => {
    if (kind === "void")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
          <Ban className="h-3 w-3" /> CANCELLED
        </span>
      );
    if (kind === "nc")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Gift className="h-3 w-3" /> NC
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
        <Undo2 className="h-3 w-3" /> REFUND
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Cancelled Orders & Non-Chargeable Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all cancelled, non-chargeable, and refunded items
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cancelled</p>
          <p className="text-2xl font-bold text-destructive tabular-nums mt-1">
            {counts.void}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            ₹{totals.void.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Non-Chargeable</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {counts.nc}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            ₹{totals.nc.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Refunded</p>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums mt-1">
            {counts.refund}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            ₹{totals.refund.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search item or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "void", "nc", "refund"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "all" ? "All" : f === "void" ? "Cancelled" : f === "nc" ? "NC" : "Refunded"}
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
                  No entries found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium tabular-nums">#{e.order_number}</TableCell>
                  <TableCell>{e.item_name}</TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">{e.quantity}</TableCell>
                  <TableCell>{renderBadge(e.kind)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {e.reason || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {e.staff_name || "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    ₹{e.total_price.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {new Date(e.timestamp).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
