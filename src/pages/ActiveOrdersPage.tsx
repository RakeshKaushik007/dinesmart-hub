import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const sourceStyles: Record<string, string> = {
  pos: "bg-emerald-500/10 text-emerald-600",
  zomato: "bg-red-500/10 text-red-600",
  swiggy: "bg-orange-500/10 text-orange-600",
  qr: "bg-blue-500/10 text-blue-600",
  phone: "bg-purple-500/10 text-purple-600",
};

const statusStyles: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  accepted: "bg-sky-500/10 text-sky-600",
  preparing: "bg-amber-500/10 text-amber-600",
  ready: "bg-emerald-500/10 text-emerald-600",
  dispatched: "bg-muted text-muted-foreground",
};

interface OrderWithItems {
  id: string;
  order_number: number;
  order_source: string;
  order_type: string;
  status: string;
  total: number;
  customer_name: string | null;
  table_id: string | null;
  created_at: string;
  items: { item_name: string; quantity: number; total_price: number }[];
}

const ActiveOrdersPage = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");

  const fetchOrders = async () => {
    const activeStatuses = ["new", "accepted", "preparing", "ready", "dispatched"];
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_number, order_source, order_type, status, total, customer_name, table_id, created_at")
      .in("status", activeStatuses)
      .order("created_at", { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, item_name, quantity, total_price")
      .in("order_id", orderIds);

    const enriched: OrderWithItems[] = ordersData.map(o => ({
      ...o,
      items: (itemsData || []).filter(i => i.order_id === o.id),
    }));

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("active-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = sourceFilter === "all" ? orders : orders.filter(o => o.order_source === sourceFilter);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Active Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified feed — all sources</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "pos", "zomato", "swiggy", "qr", "phone"].map((s) => (
          <button key={s} onClick={() => setSourceFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${sourceFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {s === "all" ? "All Sources" : s === "qr" ? "QR Order" : s.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No active orders right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-card-foreground">#{order.order_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceStyles[order.order_source] || "bg-muted text-muted-foreground"}`}>
                    {order.order_source}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status] || "bg-muted text-muted-foreground"}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-card-foreground font-medium">{order.customer_name || "Walk-in"}</p>
              <div className="mt-3 space-y-1 flex-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.quantity}× {item.item_name}</span>
                    <span className="font-mono text-card-foreground">₹{item.total_price}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-sm font-bold font-mono text-card-foreground">₹{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActiveOrdersPage;
