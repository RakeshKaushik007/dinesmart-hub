import { useState } from "react";
import { ShoppingBag, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Order {
  id: string;
  source: "zomato" | "swiggy" | "qr" | "dine-in";
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "new" | "preparing" | "ready" | "dispatched";
  table?: string;
  customerName: string;
  orderedAt: string;
}

const mockOrders: Order[] = [
  { id: "ORD-4201", source: "dine-in", table: "T-03", customerName: "Table 3", items: [{ name: "Paneer Butter Masala", qty: 2, price: 320 }, { name: "Jeera Rice", qty: 2, price: 150 }], total: 940, status: "preparing", orderedAt: "2026-03-14T12:30:00" },
  { id: "ORD-4202", source: "zomato", customerName: "Rahul Sharma", items: [{ name: "Chicken Biryani", qty: 1, price: 380 }, { name: "Dal Tadka", qty: 1, price: 220 }], total: 600, status: "new", orderedAt: "2026-03-14T12:35:00" },
  { id: "ORD-4203", source: "swiggy", customerName: "Priya Patel", items: [{ name: "Paneer Butter Masala", qty: 1, price: 320 }], total: 320, status: "ready", orderedAt: "2026-03-14T12:20:00" },
  { id: "ORD-4204", source: "qr", table: "T-07", customerName: "Table 7 (QR)", items: [{ name: "Chicken Biryani", qty: 2, price: 380 }, { name: "Jeera Rice", qty: 1, price: 150 }], total: 910, status: "preparing", orderedAt: "2026-03-14T12:25:00" },
  { id: "ORD-4205", source: "dine-in", table: "T-12", customerName: "Table 12", items: [{ name: "Dal Tadka", qty: 2, price: 220 }, { name: "Jeera Rice", qty: 2, price: 150 }], total: 740, status: "new", orderedAt: "2026-03-14T12:38:00" },
];

const sourceStyles: Record<string, string> = {
  zomato: "bg-red-500/10 text-red-600",
  swiggy: "bg-orange-500/10 text-orange-600",
  qr: "bg-blue-500/10 text-blue-600",
  "dine-in": "bg-emerald-500/10 text-emerald-600",
};

const statusStyles: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  preparing: "bg-amber-500/10 text-amber-600",
  ready: "bg-emerald-500/10 text-emerald-600",
  dispatched: "bg-muted text-muted-foreground",
};

const ActiveOrdersPage = () => {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const filtered = sourceFilter === "all" ? mockOrders : mockOrders.filter(o => o.source === sourceFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Active Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified feed — Zomato, Swiggy, QR & Dine-in</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "dine-in", "zomato", "swiggy", "qr"].map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              sourceFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All Sources" : s === "qr" ? "QR Order" : s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-card-foreground">{order.id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceStyles[order.source]}`}>
                  {order.source === "qr" ? "QR" : order.source}
                </span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status]}`}>
                {order.status}
              </span>
            </div>
            <p className="text-sm text-card-foreground font-medium">{order.customerName}</p>
            {order.table && <p className="text-xs text-muted-foreground">{order.table}</p>}
            <div className="mt-3 space-y-1 flex-1">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.qty}× {item.name}</span>
                  <span className="font-mono text-card-foreground">₹{item.qty * item.price}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(order.orderedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-sm font-bold font-mono text-card-foreground">₹{order.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActiveOrdersPage;
