import { useState } from "react";
import { Search, FileText, Clock } from "lucide-react";

interface HistoryOrder {
  id: string;
  source: string;
  customerName: string;
  items: string[];
  total: number;
  status: "completed" | "cancelled" | "refunded";
  paymentMode: string;
  completedAt: string;
}

const mockHistory: HistoryOrder[] = [
  { id: "ORD-4195", source: "Dine-in", customerName: "Table 5", items: ["Paneer Butter Masala x2", "Jeera Rice x2"], total: 940, status: "completed", paymentMode: "UPI", completedAt: "2026-03-14T11:45:00" },
  { id: "ORD-4190", source: "Zomato", customerName: "Amit Kumar", items: ["Chicken Biryani x1"], total: 380, status: "completed", paymentMode: "Online", completedAt: "2026-03-14T11:20:00" },
  { id: "ORD-4188", source: "Swiggy", customerName: "Neha Gupta", items: ["Dal Tadka x1", "Jeera Rice x1"], total: 370, status: "cancelled", paymentMode: "—", completedAt: "2026-03-14T10:55:00" },
  { id: "ORD-4185", source: "QR", customerName: "Table 9 (QR)", items: ["Paneer Butter Masala x1", "Chicken Biryani x1"], total: 700, status: "completed", paymentMode: "Card", completedAt: "2026-03-14T10:30:00" },
  { id: "ORD-4180", source: "Dine-in", customerName: "Table 2", items: ["Dal Tadka x3", "Jeera Rice x3"], total: 1110, status: "refunded", paymentMode: "Cash", completedAt: "2026-03-14T09:50:00" },
  { id: "ORD-4175", source: "Zomato", customerName: "Kiran Rao", items: ["Chicken Biryani x2"], total: 760, status: "completed", paymentMode: "Online", completedAt: "2026-03-13T21:00:00" },
];

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-amber-500/10 text-amber-600",
};

const OrderHistoryPage = () => {
  const [search, setSearch] = useState("");
  const filtered = mockHistory.filter(o => o.id.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order History</h1>
        <p className="text-sm text-muted-foreground mt-1">Past orders & status tracking</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by order ID or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Order ID</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Source</th>
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Items</th>
                <th className="text-right px-5 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Payment</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-semibold text-card-foreground">{order.id}</td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{order.source}</td>
                  <td className="px-5 py-3.5 text-card-foreground">{order.customerName}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{order.items.join(", ")}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-card-foreground">₹{order.total}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">{order.paymentMode}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs hidden lg:table-cell">
                    {new Date(order.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderHistoryPage;
