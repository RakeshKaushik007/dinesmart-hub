import { useEffect, useState, useMemo } from "react";
import { Loader2, CheckCircle2, Download, Search, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods, classifyPayment } from "@/hooks/usePaymentMethods";
import { resolvePaymentIcon } from "@/lib/paymentIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface PendingOrder {
  id: string;
  order_number: number;
  total: number;
  payment_mode: string;
  customer_name: string | null;
  completed_at: string | null;
  created_at: string;
}

const PendingAggregatorSettlementPage = () => {
  const { user, isAtLeast } = useAuth();
  const { toast } = useToast();
  const { methods } = usePaymentMethods();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [settling, setSettling] = useState(false);

  const isManager = isAtLeast("branch_manager");

  const fetchPending = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total, payment_mode, customer_name, completed_at, created_at, aggregator_settled, status")
      .eq("status", "completed")
      .eq("aggregator_settled", false)
      .order("completed_at", { ascending: false })
      .limit(500);

    const filtered = (data || []).filter(
      (o) => classifyPayment(o.payment_mode, methods) === "aggregator"
    );
    setOrders(filtered as PendingOrder[]);
    setLoading(false);
  };

  useEffect(() => {
    if (methods.length > 0) fetchPending();
  }, [methods]);

  const aggregatorMethods = useMemo(
    () => methods.filter((m) => m.type === "aggregator"),
    [methods]
  );

  const visible = useMemo(() => {
    return orders.filter((o) => {
      if (filterMethod !== "all" && o.payment_mode !== filterMethod) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          String(o.order_number).includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, filterMethod, search]);

  const totalsByMethod = useMemo(() => {
    const m: Record<string, { count: number; amount: number; name: string; code: string }> = {};
    orders.forEach((o) => {
      const meta = methods.find((mm) => mm.code === o.payment_mode);
      const name = meta?.name || o.payment_mode;
      if (!m[o.payment_mode]) m[o.payment_mode] = { count: 0, amount: 0, name, code: o.payment_mode };
      m[o.payment_mode].count += 1;
      m[o.payment_mode].amount += Number(o.total) || 0;
    });
    return Object.values(m);
  }, [orders, methods]);

  const grandTotal = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const selectedTotal = orders
    .filter((o) => selected.has(o.id))
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  const toggleAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((o) => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const markSettled = async () => {
    if (selected.size === 0) return;
    setSettling(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("orders")
      .update({
        aggregator_settled: true,
        aggregator_settled_at: new Date().toISOString(),
        aggregator_settled_by: user?.id,
        aggregator_settlement_notes: notes.trim() || null,
      })
      .in("id", ids);
    setSettling(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `${ids.length} order${ids.length > 1 ? "s" : ""} reconciled`,
      description: `₹${selectedTotal.toLocaleString("en-IN")} marked as settled`,
    });
    setSelected(new Set());
    setNotes("");
    setConfirmOpen(false);
    fetchPending();
  };

  const exportCSV = () => {
    const header = "Order#,Customer,Method,Amount,Completed\n";
    const rows = visible.map((o) =>
      [
        o.order_number,
        `"${o.customer_name || ""}"`,
        o.payment_mode,
        o.total,
        o.completed_at ? new Date(o.completed_at).toLocaleString("en-IN") : "",
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pending-aggregator-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Manager access required.
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Pending Aggregator Settlement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orders paid via third-party aggregators awaiting reconciliation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button size="sm" disabled={selected.size === 0} onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Settled ({selected.size})
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Orders</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Amount</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            ₹{grandTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Selected</p>
          <p className="text-2xl font-bold text-primary tabular-nums mt-1">{selected.size}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Selected Amount</p>
          <p className="text-2xl font-bold text-primary tabular-nums mt-1">
            ₹{selectedTotal.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Per-method breakdown */}
      {totalsByMethod.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            By Aggregator
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {totalsByMethod.map((t) => {
              const meta = methods.find((mm) => mm.code === t.code);
              const Icon = resolvePaymentIcon(t.code, meta?.icon);
              return (
                <button
                  key={t.code}
                  onClick={() => setFilterMethod(filterMethod === t.code ? "all" : t.code)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                    filterMethod === t.code
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/30"
                  }`}
                >
                  <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {t.count} · ₹{t.amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {filterMethod !== "all" && (
          <Button variant="outline" size="sm" onClick={() => setFilterMethod("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={visible.length > 0 && selected.size === visible.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Order #</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="hidden md:table-cell">Completed</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No pending aggregator orders. Everything is reconciled.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((o) => {
                const meta = methods.find((mm) => mm.code === o.payment_mode);
                const Icon = resolvePaymentIcon(o.payment_mode, meta?.icon);
                const checked = selected.has(o.id);
                return (
                  <TableRow key={o.id} className={checked ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(o.id)} />
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">#{o.order_number}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {o.customer_name || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <Icon className="h-3 w-3" />
                        {meta?.name || o.payment_mode}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {o.completed_at
                        ? new Date(o.completed_at).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      ₹{Number(o.total).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mark <span className="font-semibold text-foreground">{selected.size}</span> order
              {selected.size > 1 ? "s" : ""} totaling{" "}
              <span className="font-semibold text-foreground">
                ₹{selectedTotal.toLocaleString("en-IN")}
              </span>{" "}
              as reconciled with the aggregator?
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Settlement notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Zomato payout UTR #123456 on 17-Apr"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={markSettled} disabled={settling}>
              {settling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingAggregatorSettlementPage;
