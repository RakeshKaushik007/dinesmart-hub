import { useState, useEffect } from "react";
import { Search, Loader2, RotateCcw, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ReopenBillDialog from "@/components/checkout/ReopenBillDialog";
import AdjustBillDialog from "@/components/checkout/AdjustBillDialog";

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-destructive/10 text-destructive",
  pending_adjustment: "bg-amber-500/10 text-amber-600",
};

const OrderHistoryPage = () => {
  const { isAtLeast } = useAuth();
  const isManager = isAtLeast("branch_manager");

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [reopenOrder, setReopenOrder] = useState<any>(null);
  const [adjustOrder, setAdjustOrder] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_number, order_source, status, subtotal, service_charge, tax, discount, total, payment_mode, customer_name, completed_at, cancelled_at, created_at, reopen_reason")
      .in("status", ["completed", "cancelled", "pending_adjustment"] as any)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!ordersData) { setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, item_name, quantity")
      .in("order_id", orderIds);

    const enriched = ordersData.map(o => ({
      ...o,
      items: (itemsData || []).filter(i => i.order_id === o.id).map(i => `${i.item_name} x${i.quantity}`),
    }));

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter(o =>
    String(o.order_number).includes(search) || (o.customer_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order History</h1>
        <p className="text-sm text-muted-foreground mt-1">Past orders & status tracking</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Search by order # or name..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Order #</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Source</th>
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Items</th>
                <th className="text-right px-5 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Payment</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Time</th>
                {isManager && <th className="text-left px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-semibold text-card-foreground">#{order.order_number}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell uppercase text-xs">{order.order_source}</td>
                  <td className="px-5 py-3.5 text-card-foreground">{order.customer_name || "Walk-in"}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{order.items.join(", ")}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-card-foreground">₹{Number(order.total).toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status] || "bg-muted text-muted-foreground"}`}>
                      {order.status === "pending_adjustment" ? "Adjusting" : order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell uppercase text-xs">{order.payment_mode}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs hidden lg:table-cell">
                    {new Date(order.completed_at || order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  {isManager && (
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {order.status === "completed" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setReopenOrder(order)}>
                            <RotateCcw className="h-3 w-3" /> Reopen
                          </Button>
                        )}
                        {order.status === "pending_adjustment" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdjustOrder(order)}>
                            <Wrench className="h-3 w-3" /> Adjust
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">No orders found.</div>}
      </div>

      {/* Manager-only dialogs */}
      {reopenOrder && (
        <ReopenBillDialog
          open={!!reopenOrder}
          onClose={() => setReopenOrder(null)}
          orderId={reopenOrder.id}
          orderNumber={reopenOrder.order_number}
          onReopened={fetchOrders}
        />
      )}
      {adjustOrder && (
        <AdjustBillDialog
          open={!!adjustOrder}
          onClose={() => setAdjustOrder(null)}
          order={adjustOrder}
          onSettled={fetchOrders}
        />
      )}
    </div>
  );
};

export default OrderHistoryPage;
