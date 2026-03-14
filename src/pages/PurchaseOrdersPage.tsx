import { useState } from "react";
import { Plus, Truck, FileText, Search, Filter } from "lucide-react";

interface PurchaseOrder {
  id: string;
  vendor: string;
  items: { name: string; qty: number; unit: string; rate: number }[];
  total: number;
  status: "pending" | "received" | "partial" | "cancelled";
  orderedAt: string;
  receivedAt: string | null;
  invoiceNo: string;
}

const mockOrders: PurchaseOrder[] = [
  {
    id: "PO-001", vendor: "Fresh Farm Supplies", invoiceNo: "INV-2026-4421",
    items: [
      { name: "Chicken Breast", qty: 20, unit: "kg", rate: 280 },
      { name: "Paneer", qty: 10, unit: "kg", rate: 320 },
    ],
    total: 8800, status: "received", orderedAt: "2026-03-10T09:00:00", receivedAt: "2026-03-11T14:00:00",
  },
  {
    id: "PO-002", vendor: "Metro Wholesale", invoiceNo: "INV-2026-7802",
    items: [
      { name: "Cooking Oil", qty: 15, unit: "L", rate: 180 },
      { name: "Basmati Rice", qty: 50, unit: "kg", rate: 85 },
    ],
    total: 6950, status: "pending", orderedAt: "2026-03-13T11:30:00", receivedAt: null,
  },
  {
    id: "PO-003", vendor: "Spice World Traders", invoiceNo: "INV-2026-1190",
    items: [
      { name: "Garam Masala", qty: 5, unit: "kg", rate: 650 },
      { name: "Salt", qty: 10, unit: "kg", rate: 20 },
    ],
    total: 3450, status: "partial", orderedAt: "2026-03-12T08:00:00", receivedAt: null,
  },
  {
    id: "PO-004", vendor: "Daily Dairy Co.", invoiceNo: "INV-2026-3345",
    items: [
      { name: "Cream", qty: 8, unit: "L", rate: 220 },
      { name: "Curd", qty: 12, unit: "kg", rate: 60 },
    ],
    total: 2480, status: "cancelled", orderedAt: "2026-03-08T10:00:00", receivedAt: null,
  },
];

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  received: "bg-emerald-500/10 text-emerald-600",
  partial: "bg-blue-500/10 text-blue-600",
  cancelled: "bg-destructive/10 text-destructive",
};

const PurchaseOrdersPage = () => {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? mockOrders : mockOrders.filter(o => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Inward stock & vendor invoices</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Purchase Order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "pending", "received", "partial", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All Orders" : s}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">{order.vendor}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{order.id}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />{order.invoiceNo}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status]}`}>
                  {order.status}
                </span>
                <span className="text-lg font-bold font-mono text-card-foreground">₹{order.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-right py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-2 text-card-foreground">{item.name}</td>
                      <td className="py-2 text-right font-mono">{item.qty} {item.unit}</td>
                      <td className="py-2 text-right font-mono">₹{item.rate}</td>
                      <td className="py-2 text-right font-mono text-card-foreground">₹{(item.qty * item.rate).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 font-mono">
              Ordered: {new Date(order.orderedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {order.receivedAt && ` • Received: ${new Date(order.receivedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PurchaseOrdersPage;
