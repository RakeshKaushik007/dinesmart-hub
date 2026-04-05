import { useState, useEffect } from "react";
import { Clock, CheckCircle2, ChefHat, Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; bg: string; icon: typeof Clock }> = {
  new: { label: "Queued", bg: "border-amber-500/40 bg-amber-500/5", icon: Clock },
  accepted: { label: "Queued", bg: "border-amber-500/40 bg-amber-500/5", icon: Clock },
  preparing: { label: "Cooking", bg: "border-orange-500/40 bg-orange-500/5", icon: Flame },
  ready: { label: "Done", bg: "border-emerald-500/40 bg-emerald-500/5 opacity-60", icon: CheckCircle2 },
};

interface KOTOrder {
  id: string;
  order_number: number;
  order_source: string;
  status: string;
  customer_name: string | null;
  created_at: string;
  items: { item_name: string; quantity: number; notes: string | null }[];
}

const KitchenDisplayPage = () => {
  const [orders, setOrders] = useState<KOTOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_number, order_source, status, customer_name, created_at")
      .in("status", ["new", "accepted", "preparing", "ready"])
      .order("created_at", { ascending: true });

    if (!ordersData) { setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, item_name, quantity, notes")
      .in("order_id", orderIds);

    const enriched: KOTOrder[] = ordersData.map(o => ({
      ...o,
      items: (itemsData || []).filter(i => i.order_id === o.id),
    }));

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("kot-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const queued = orders.filter(k => k.status === "new" || k.status === "accepted");
  const cooking = orders.filter(k => k.status === "preparing");
  const done = orders.filter(k => k.status === "ready");

  const renderKOT = (order: KOTOrder) => {
    const config = statusConfig[order.status] || statusConfig.new;
    const StatusIcon = config.icon;
    return (
      <div key={order.id} className={`rounded-xl border-2 p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold font-mono text-card-foreground">#{order.order_number}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusIcon className="h-3.5 w-3.5" />
            {config.label}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span className="font-semibold text-card-foreground">{order.customer_name || "Walk-in"}</span>
          <span>•</span>
          <span className="uppercase">{order.order_source}</span>
          <span>•</span>
          <span className="font-mono">{new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-bold font-mono text-secondary-foreground min-w-[24px] text-center">{item.quantity}</span>
              <div>
                <p className="text-sm font-medium text-card-foreground">{item.item_name}</p>
                {item.notes && <p className="text-[10px] text-muted-foreground italic">— {item.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChefHat className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen Display (KOT)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live kitchen order tickets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Queued <span className="rounded-full bg-amber-500/10 text-amber-600 px-1.5 text-[10px]">{queued.length}</span>
          </h2>
          <div className="space-y-3">{queued.map(renderKOT)}</div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5" /> Cooking <span className="rounded-full bg-orange-500/10 text-orange-600 px-1.5 text-[10px]">{cooking.length}</span>
          </h2>
          <div className="space-y-3">{cooking.map(renderKOT)}</div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Done <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-1.5 text-[10px]">{done.length}</span>
          </h2>
          <div className="space-y-3">{done.map(renderKOT)}</div>
        </div>
      </div>
    </div>
  );
};

export default KitchenDisplayPage;
