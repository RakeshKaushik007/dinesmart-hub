import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, Search, Calendar, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface VoidNCEntry {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_void: boolean;
  is_nc: boolean;
  void_reason: string | null;
  voided_by: string | null;
  created_at: string;
  order_number: number;
  voided_by_name: string | null;
}

const VoidNCLogPage = () => {
  const [entries, setEntries] = useState<VoidNCEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  const fetchEntries = async () => {
    setLoading(true);

    const startOfDay = `${dateFilter}T00:00:00`;
    const endOfDay = `${dateFilter}T23:59:59`;

    const { data: items, error } = await supabase
      .from("order_items")
      .select("id, item_name, quantity, unit_price, total_price, is_void, is_nc, void_reason, voided_by, created_at, order_id")
      .or("is_void.eq.true,is_nc.eq.true")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (error || !items) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Fetch order numbers
    const orderIds = [...new Set(items.map((i) => i.order_id))];
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number")
      .in("id", orderIds);

    const orderMap = new Map(orders?.map((o) => [o.id, o.order_number]) || []);

    // Fetch staff names for voided_by
    const staffIds = [...new Set(items.filter((i) => i.voided_by).map((i) => i.voided_by!))];
    let staffMap = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", staffIds);
      staffMap = new Map(profiles?.map((p) => [p.user_id, p.full_name || "Unknown"]) || []);
    }

    const mapped: VoidNCEntry[] = items.map((item) => ({
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      is_void: item.is_void ?? false,
      is_nc: item.is_nc ?? false,
      void_reason: item.void_reason,
      voided_by: item.voided_by,
      created_at: item.created_at,
      order_number: orderMap.get(item.order_id) ?? 0,
      voided_by_name: item.voided_by ? staffMap.get(item.voided_by) || "Unknown" : null,
    }));

    setEntries(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [dateFilter]);

  const filtered = entries.filter(
    (e) =>
      e.item_name.toLowerCase().includes(search.toLowerCase()) ||
      e.void_reason?.toLowerCase().includes(search.toLowerCase()) ||
      String(e.order_number).includes(search)
  );

  const totalVoidValue = filtered.filter((e) => e.is_void).reduce((sum, e) => sum + e.total_price, 0);
  const totalNCValue = filtered.filter((e) => e.is_nc).reduce((sum, e) => sum + e.total_price, 0);

  const exportCSV = () => {
    const headers = ["Order #", "Item", "Qty", "Price", "Type", "Reason", "By", "Time"];
    const rows = filtered.map((e) => [
      e.order_number,
      e.item_name,
      e.quantity,
      e.total_price.toFixed(2),
      e.is_void ? "Void" : "NC",
      e.void_reason || "-",
      e.voided_by_name || "-",
      new Date(e.created_at).toLocaleTimeString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `void-nc-log-${dateFilter}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Ban className="h-6 w-6 text-destructive" />
            Voids & Non-Chargeable Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all voided and non-chargeable items with reasons and timestamps
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Entries</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-xl p-4">
          <p className="text-xs text-destructive uppercase tracking-wide">Void Value</p>
          <p className="text-2xl font-bold text-destructive mt-1">₹{totalVoidValue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-yellow-500/30 rounded-xl p-4">
          <p className="text-xs text-yellow-500 uppercase tracking-wide">NC Value</p>
          <p className="text-2xl font-bold text-yellow-500 mt-1">₹{totalNCValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, reason, or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-10 w-48"
          />
        </div>
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Ban className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No void or NC entries found</p>
          <p className="text-sm mt-1">No items were voided or marked non-chargeable on this date.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-4 ${
                entry.is_void ? "border-destructive/30" : "border-yellow-500/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{entry.item_name}</span>
                  <Badge variant={entry.is_void ? "destructive" : "outline"} className={entry.is_nc ? "border-yellow-500 text-yellow-500" : ""}>
                    {entry.is_void ? "Void" : "NC"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Order #{entry.order_number}</span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span>Qty: {entry.quantity}</span>
                  <span>₹{entry.total_price.toFixed(2)}</span>
                  {entry.void_reason && <span>Reason: {entry.void_reason}</span>}
                  {entry.voided_by_name && <span>By: {entry.voided_by_name}</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(entry.created_at).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoidNCLogPage;
