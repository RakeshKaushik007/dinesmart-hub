import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Wifi, WifiOff, Check, X, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AggregatorOrder {
  id: string;
  platform: "swiggy" | "zomato";
  customerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "incoming" | "accepted" | "preparing" | "ready" | "dispatched";
  receivedAt: Date;
}

const mockIncoming = (): AggregatorOrder => {
  const platforms: ("swiggy" | "zomato")[] = ["swiggy", "zomato"];
  const names = ["Rahul S.", "Priya M.", "Amit K.", "Sneha R.", "Vikram J.", "Neha P.", "Arjun D."];
  const dishes = [
    { name: "Paneer Butter Masala", price: 280 },
    { name: "Chicken Biryani", price: 320 },
    { name: "Masala Dosa", price: 150 },
    { name: "Veg Fried Rice", price: 200 },
    { name: "Butter Naan", price: 60 },
    { name: "Dal Makhani", price: 220 },
    { name: "Gulab Jamun", price: 80 },
  ];
  const itemCount = 1 + Math.floor(Math.random() * 3);
  const items = Array.from({ length: itemCount }, () => {
    const d = dishes[Math.floor(Math.random() * dishes.length)];
    return { name: d.name, qty: 1 + Math.floor(Math.random() * 2), price: d.price };
  });
  return {
    id: crypto.randomUUID(),
    platform: platforms[Math.floor(Math.random() * 2)],
    customerName: names[Math.floor(Math.random() * names.length)],
    items,
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    status: "incoming",
    receivedAt: new Date(),
  };
};

const platformStyles = {
  swiggy: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  zomato: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
};

const statusColors: Record<string, string> = {
  incoming: "bg-primary/10 text-primary",
  accepted: "bg-sky-500/10 text-sky-600",
  preparing: "bg-amber-500/10 text-amber-600",
  ready: "bg-emerald-500/10 text-emerald-600",
  dispatched: "bg-muted text-muted-foreground",
};

const AggregatorOrdersPage = () => {
  const [orders, setOrders] = useState<AggregatorOrder[]>([]);
  const [autoSync, setAutoSync] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlatform, setManualPlatform] = useState<"swiggy" | "zomato">("swiggy");
  const [manualName, setManualName] = useState("");
  const [manualItems, setManualItems] = useState([{ name: "", qty: 1, price: 0 }]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Auto-sync mock: generate random aggregator order every 15-30s
  useEffect(() => {
    if (autoSync) {
      const generate = () => {
        const newOrder = mockIncoming();
        setOrders((prev) => [newOrder, ...prev]);
        toast({ title: `🔔 New ${newOrder.platform.toUpperCase()} order!`, description: `${newOrder.customerName} · ₹${newOrder.total}` });
      };
      generate(); // immediate first one
      intervalRef.current = setInterval(generate, 15000 + Math.random() * 15000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoSync]);

  const acceptOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Save to DB
    const subtotal = order.total;
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const { data: dbOrder } = await supabase.from("orders").insert({
      order_type: "online" as const,
      order_source: order.platform as any,
      status: "accepted" as const,
      payment_mode: "wallet" as const,
      customer_name: order.customerName,
      subtotal,
      tax,
      total: subtotal + tax,
      accepted_at: new Date().toISOString(),
    }).select("id").single();

    if (dbOrder) {
      await supabase.from("order_items").insert(
        order.items.map((i) => ({
          order_id: dbOrder.id,
          item_name: i.name,
          quantity: i.qty,
          unit_price: i.price,
          total_price: i.price * i.qty,
        }))
      );
    }

    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "accepted" } : o));
    toast({ title: "Order accepted", description: `Sent to kitchen` });
  };

  const updateStatus = (orderId: string, status: AggregatorOrder["status"]) => {
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  };

  const addManualOrder = async () => {
    if (!manualName.trim() || manualItems.every((i) => !i.name.trim())) return;
    const validItems = manualItems.filter((i) => i.name.trim());
    const total = validItems.reduce((s, i) => s + i.price * i.qty, 0);
    const newOrder: AggregatorOrder = {
      id: crypto.randomUUID(),
      platform: manualPlatform,
      customerName: manualName,
      items: validItems,
      total,
      status: "incoming",
      receivedAt: new Date(),
    };
    setOrders((prev) => [newOrder, ...prev]);
    setManualOpen(false);
    setManualName("");
    setManualItems([{ name: "", qty: 1, price: 0 }]);
    toast({ title: `Manual ${manualPlatform} order added` });
  };

  const incoming = orders.filter((o) => o.status === "incoming");
  const active = orders.filter((o) => ["accepted", "preparing", "ready"].includes(o.status));
  const dispatched = orders.filter((o) => o.status === "dispatched");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aggregator Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Swiggy & Zomato order intake</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoSync(!autoSync)}
            className={autoSync ? "border-emerald-500/50 text-emerald-600" : ""}>
            {autoSync ? <Wifi className="h-4 w-4 mr-1.5" /> : <WifiOff className="h-4 w-4 mr-1.5" />}
            {autoSync ? "Auto-Sync ON" : "Auto-Sync OFF"}
          </Button>
          <Button size="sm" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Manual Entry
          </Button>
        </div>
      </div>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Incoming ({incoming.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {incoming.map((order) => {
              const ps = platformStyles[order.platform];
              return (
                <div key={order.id} className={`rounded-xl border-2 ${ps.border} ${ps.bg} p-4 animate-in fade-in`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase ${ps.text}`}>{order.platform}</span>
                    <span className="text-xs text-muted-foreground">{order.receivedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="font-semibold text-card-foreground text-sm">{order.customerName}</p>
                  <div className="mt-2 space-y-0.5">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">{item.qty}× {item.name}</span><span className="font-mono">₹{item.price * item.qty}</span></div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                    <span className="font-bold font-mono">₹{order.total}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => setOrders((p) => p.filter((o) => o.id !== order.id))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => acceptOrder(order.id)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Accept
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active aggregator orders</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {active.map((order) => {
              const ps = platformStyles[order.platform];
              const nextStatus: Record<string, AggregatorOrder["status"]> = { accepted: "preparing", preparing: "ready", ready: "dispatched" };
              return (
                <div key={order.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${ps.bg} ${ps.text}`}>{order.platform}</span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>{order.status}</span>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-card-foreground">{order.customerName}</p>
                  <div className="mt-2 space-y-0.5">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{item.qty}× {item.name}</p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                    <span className="font-bold font-mono text-sm">₹{order.total}</span>
                    {nextStatus[order.status] && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(order.id, nextStatus[order.status])}>
                        {nextStatus[order.status] === "dispatched" ? <><Bike className="h-3 w-3 mr-1" /> Dispatch</> : `Mark ${nextStatus[order.status]}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dispatched */}
      {dispatched.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Dispatched ({dispatched.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {dispatched.map((order) => (
              <div key={order.id} className="rounded-xl border border-border/50 bg-muted/30 p-4 opacity-60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-muted-foreground">{order.platform}</span>
                  <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{order.customerName} · ₹{order.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Entry Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Aggregator Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["swiggy", "zomato"] as const).map((p) => (
                <button key={p} onClick={() => setManualPlatform(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${manualPlatform === p ? (p === "swiggy" ? "bg-orange-500 text-white" : "bg-red-500 text-white") : "bg-secondary text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Customer Name"
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm outline-none placeholder:text-muted-foreground" />
            {manualItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input value={item.name} onChange={(e) => { const n = [...manualItems]; n[i].name = e.target.value; setManualItems(n); }}
                  placeholder="Item name" className="flex-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm outline-none placeholder:text-muted-foreground" />
                <input type="number" value={item.qty} onChange={(e) => { const n = [...manualItems]; n[i].qty = +e.target.value; setManualItems(n); }}
                  className="w-14 px-2 py-2 rounded-lg bg-secondary text-foreground text-sm outline-none text-center" />
                <input type="number" value={item.price || ""} onChange={(e) => { const n = [...manualItems]; n[i].price = +e.target.value; setManualItems(n); }}
                  placeholder="₹" className="w-20 px-2 py-2 rounded-lg bg-secondary text-foreground text-sm outline-none placeholder:text-muted-foreground" />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setManualItems([...manualItems, { name: "", qty: 1, price: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
            <Button className="w-full" onClick={addManualOrder}>Add Order</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AggregatorOrdersPage;
