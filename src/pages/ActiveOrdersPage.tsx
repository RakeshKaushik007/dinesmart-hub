import { useState, useEffect } from "react";
import { Clock, Loader2, CreditCard, Banknote, Smartphone, Receipt, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  subtotal: number;
  tax: number;
  total: number;
  payment_mode: string;
  customer_name: string | null;
  table_id: string | null;
  created_at: string;
  items: { item_name: string; quantity: number; unit_price: number; total_price: number }[];
  table_number?: number;
}

const ActiveOrdersPage = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [checkoutOrder, setCheckoutOrder] = useState<OrderWithItems | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "upi" | "card" | null>(null);
  const [settling, setSettling] = useState(false);
  const { toast } = useToast();

  const fetchOrders = async () => {
    const activeStatuses = ["new", "accepted", "preparing", "ready", "dispatched"] as const;
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_number, order_source, order_type, status, subtotal, tax, total, payment_mode, customer_name, table_id, created_at")
      .in("status", activeStatuses)
      .order("created_at", { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const tableIds = ordersData.map(o => o.table_id).filter(Boolean) as string[];

    const [{ data: itemsData }, { data: tablesData }] = await Promise.all([
      supabase.from("order_items").select("order_id, item_name, quantity, unit_price, total_price").in("order_id", orderIds),
      tableIds.length > 0
        ? supabase.from("restaurant_tables").select("id, table_number").in("id", tableIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tableMap: Record<string, number> = {};
    tablesData?.forEach(t => tableMap[t.id] = t.table_number);

    const enriched: OrderWithItems[] = ordersData.map(o => ({
      ...o,
      items: (itemsData || []).filter(i => i.order_id === o.id),
      table_number: o.table_id ? tableMap[o.table_id] : undefined,
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

  const handleSettle = async () => {
    if (!checkoutOrder || !selectedPayment) return;
    setSettling(true);

    await supabase.from("orders").update({
      payment_mode: selectedPayment,
      status: "completed" as const,
      completed_at: new Date().toISOString(),
    }).eq("id", checkoutOrder.id);

    // If dine-in with table, mark table as paid-occupied (yellow state) - don't clear yet
    // Table clearing is manual via Tables page

    // Print receipt
    printReceipt(checkoutOrder, selectedPayment);

    toast({ title: "Order Settled!", description: `Order #${checkoutOrder.order_number} paid via ${selectedPayment.toUpperCase()}` });
    setCheckoutOrder(null);
    setSelectedPayment(null);
    setSettling(false);
  };

  const printReceipt = (order: OrderWithItems, paymentMethod: string) => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;
    const itemsHtml = order.items.map(i => `
      <tr>
        <td style="padding:3px 0;font-size:12px;">${i.item_name}</td>
        <td style="text-align:center;font-size:12px;">${i.quantity}</td>
        <td style="text-align:right;font-size:12px;">₹${i.unit_price}</td>
        <td style="text-align:right;font-size:12px;font-weight:bold;">₹${i.total_price}</td>
      </tr>
    `).join("");

    const tableInfo = order.order_type === "dine_in" && order.table_number
      ? `Table ${order.table_number}` : "Takeaway";

    printWindow.document.write(`
      <html><head><title>Receipt #${order.order_number}</title>
      <style>body{font-family:monospace;margin:0;padding:16px;width:260px;}
      h2{text-align:center;margin:0 0 2px;font-size:16px;}
      .sub{text-align:center;font-size:11px;color:#666;margin-bottom:8px;}
      .info{font-size:12px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;}
      table{width:100%;border-collapse:collapse;}
      th{text-align:left;font-size:11px;border-bottom:1px solid #ccc;padding:2px 0;}
      .totals{border-top:1px dashed #000;margin-top:8px;padding-top:6px;}
      .totals div{display:flex;justify-content:space-between;font-size:12px;padding:2px 0;}
      .grand{font-size:16px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px;}
      .pay{text-align:center;margin-top:8px;padding:6px;background:#f0f0f0;font-size:12px;font-weight:bold;text-transform:uppercase;}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:12px;border-top:1px dashed #000;padding-top:8px;}</style></head>
      <body>
        <h2>BLENNIX</h2>
        <div class="sub">Tax Invoice</div>
        <div class="info">
          <div>Order #${order.order_number} · ${tableInfo}</div>
          <div>${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
          ${order.customer_name ? `<div>Customer: ${order.customer_name}</div>` : ""}
        </div>
        <table>
          <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr>
          ${itemsHtml}
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>₹${Number(order.subtotal).toFixed(2)}</span></div>
          <div><span>GST (5%)</span><span>₹${Number(order.tax).toFixed(2)}</span></div>
          <div class="grand"><span>Total</span><span>₹${Number(order.total).toFixed(2)}</span></div>
        </div>
        <div class="pay">Paid via ${paymentMethod}</div>
        <div class="footer">Thank you! Visit again.</div>
        <script>setTimeout(()=>{window.print();window.close();},400)<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const filtered = sourceFilter === "all" ? orders : orders.filter(o => o.order_source === sourceFilter);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Active Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Click an order to checkout & settle</p>
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
            <button key={order.id} onClick={() => { setCheckoutOrder(order); setSelectedPayment(null); }}
              className="rounded-xl border border-border bg-card p-5 flex flex-col text-left hover:ring-2 hover:ring-primary/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-card-foreground">#{order.order_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceStyles[order.order_source] || "bg-muted text-muted-foreground"}`}>
                    {order.order_source}
                  </span>
                  {order.table_number && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                      T{order.table_number}
                    </span>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[order.status] || "bg-muted text-muted-foreground"}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-card-foreground font-medium">{order.customer_name || "Walk-in"} · {order.order_type === "dine_in" ? "Dining" : "Takeaway"}</p>
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
            </button>
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      <Dialog open={!!checkoutOrder} onOpenChange={() => setCheckoutOrder(null)}>
        <DialogContent className="sm:max-w-md">
          {checkoutOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Checkout — Order #{checkoutOrder.order_number}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{checkoutOrder.order_type === "dine_in" ? "Dining" : "Takeaway"}</span></div>
                  {checkoutOrder.table_number && <div className="flex justify-between"><span className="text-muted-foreground">Table</span><span className="font-medium">{checkoutOrder.table_number}</span></div>}
                  {checkoutOrder.customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{checkoutOrder.customer_name}</span></div>}
                </div>

                <div className="space-y-1">
                  {checkoutOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.quantity}× {item.item_name}</span>
                      <span className="font-mono">₹{item.total_price}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">₹{Number(checkoutOrder.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST (5%)</span><span className="font-mono">₹{Number(checkoutOrder.tax).toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold pt-1 border-t border-border"><span>Total</span><span className="font-mono">₹{Number(checkoutOrder.total).toFixed(2)}</span></div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "cash" as const, label: "Cash", icon: Banknote },
                      { value: "upi" as const, label: "UPI", icon: Smartphone },
                      { value: "card" as const, label: "Card", icon: CreditCard },
                    ]).map(pm => (
                      <button key={pm.value} onClick={() => setSelectedPayment(pm.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${selectedPayment === pm.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <pm.icon className={`h-5 w-5 ${selectedPayment === pm.value ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-semibold ${selectedPayment === pm.value ? "text-primary" : "text-muted-foreground"}`}>{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSettle} disabled={!selectedPayment || settling} className="w-full" size="lg">
                  {settling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                  Print & Settle
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveOrdersPage;
