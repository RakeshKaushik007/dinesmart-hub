import { useState, useMemo } from "react";
import {
  Receipt, Printer, Loader2, Banknote, Smartphone, CreditCard,
  DoorOpen, Ban, Gift, Percent, IndianRupee, Building2, Plus, XCircle, Undo2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import VoidItemDialog from "./VoidItemDialog";
import AddItemsDialog from "./AddItemsDialog";
import CancelOrderDialog from "./CancelOrderDialog";
import NCReasonDialog from "./NCReasonDialog";
import RefundItemDialog from "./RefundItemDialog";

export interface OrderItem {
  id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_void?: boolean;
  is_nc?: boolean;
  is_refunded?: boolean;
  refund_reason?: string | null;
  nc_reason?: string | null;
}

export interface OrderWithItems {
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
  items: OrderItem[];
  table_number?: number;
}

interface Props {
  order: OrderWithItems | null;
  onClose: () => void;
  onSettled: () => void;
}

const iconForCode = (code: string) => {
  if (code === "cash") return Banknote;
  if (code === "upi") return Smartphone;
  if (code === "card") return CreditCard;
  return Building2;
};

const CheckoutModal = ({ order, onClose, onSettled }: Props) => {
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [releaseTable, setReleaseTable] = useState(true);

  // Discount state
  const [discountType, setDiscountType] = useState<"flat" | "percentage" | "none" | "">("");
  const [discountValue, setDiscountValue] = useState("");

  // Service charge
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);

  // Void / NC / Refund
  const [voidingItem, setVoidingItem] = useState<OrderItem | null>(null);
  const [ncItem, setNcItem] = useState<OrderItem | null>(null);
  const [refundItem, setRefundItem] = useState<OrderItem | null>(null);
  const [localItems, setLocalItems] = useState<OrderItem[]>([]);

  // Add items dialog
  const [showAddItems, setShowAddItems] = useState(false);

  // Cancel order dialog
  const [showCancelOrder, setShowCancelOrder] = useState(false);

  const { toast } = useToast();
  const { user, profile, isAtLeast } = useAuth();
  const settings = useSettings();
  const { methods: paymentMethods } = usePaymentMethods();

  const TAX_PCT = settings.taxRate;
  const TAX_LABEL = settings.taxLabel;
  const SERVICE_CHARGE_PCT = settings.serviceChargePct;

  const directMethods = paymentMethods.filter(m => m.type === "direct");
  const aggregatorMethods = paymentMethods.filter(m => m.type === "aggregator");

  const items = order ? (localItems.length > 0 ? localItems : order.items) : [];

  const resetState = () => {
    setSelectedPayment(null);
    setReleaseTable(true);
    setDiscountType("");
    setDiscountValue("");
    setServiceChargeEnabled(false);
    setLocalItems([]);
    setShowAddItems(false);
    setShowCancelOrder(false);
  };

  // Refunded items contribute ₹0 to subtotal, just like NC and void
  const calculated = useMemo(() => {
    if (!order) return { activeSubtotal: 0, discountAmt: 0, discountedSubtotal: 0, gst: 0, serviceCharge: 0, grandTotal: 0 };

    const activeItems = items.filter(i => !i.is_void);
    const activeSubtotal = activeItems.reduce(
      (sum, i) => sum + ((i.is_nc || i.is_refunded) ? 0 : i.total_price),
      0
    );

    let discountAmt = 0;
    const dv = parseFloat(discountValue) || 0;
    if (discountType === "flat") discountAmt = Math.min(dv, activeSubtotal);
    else if (discountType === "percentage") discountAmt = (dv / 100) * activeSubtotal;

    const discountedSubtotal = activeSubtotal - discountAmt;
    const gst = discountedSubtotal * (TAX_PCT / 100);
    const serviceCharge = serviceChargeEnabled ? discountedSubtotal * (SERVICE_CHARGE_PCT / 100) : 0;
    const grandTotal = discountedSubtotal + gst + serviceCharge;

    return { activeSubtotal, discountAmt, discountedSubtotal, gst, serviceCharge, grandTotal };
  }, [items, discountType, discountValue, serviceChargeEnabled, order, TAX_PCT, SERVICE_CHARGE_PCT]);

  const handleVoidConfirm = async (reason: string, _pin: string) => {
    if (!voidingItem || !order) return;
    if (_pin.length < 4) {
      toast({ title: "Invalid PIN", description: "Manager PIN must be at least 4 digits", variant: "destructive" });
      return;
    }
    if (voidingItem.id) {
      await supabase.from("order_items").update({
        is_void: true,
        void_reason: reason,
        voided_by: user?.id,
      }).eq("id", voidingItem.id);
    }
    setLocalItems(prev => {
      const current = prev.length > 0 ? prev : order.items;
      return current.map(i =>
        i.item_name === voidingItem.item_name && !i.is_void ? { ...i, is_void: true } : i
      );
    });
    toast({ title: "Item Voided", description: `${voidingItem.item_name} removed from bill` });
    setVoidingItem(null);
  };

  const handleNCConfirm = async (reason: string) => {
    if (!ncItem || !order) return;
    if (ncItem.id) {
      await supabase.from("order_items").update({ is_nc: true, nc_reason: reason }).eq("id", ncItem.id);
    }
    setLocalItems(prev => {
      const current = prev.length > 0 ? prev : order.items;
      return current.map(i =>
        i.item_name === ncItem.item_name && !i.is_nc ? { ...i, is_nc: true, nc_reason: reason } : i
      );
    });
    toast({ title: "Marked NC", description: `${ncItem.item_name}: ${reason}` });
    setNcItem(null);
  };

  const handleRefundConfirm = async (reason: string) => {
    if (!refundItem || !order) return;
    if (refundItem.id) {
      await supabase.from("order_items").update({
        is_refunded: true,
        refund_reason: reason,
        refunded_by: user?.id,
        refunded_at: new Date().toISOString(),
      }).eq("id", refundItem.id);
    }
    setLocalItems(prev => {
      const current = prev.length > 0 ? prev : order.items;
      return current.map(i =>
        i.item_name === refundItem.item_name && !i.is_refunded
          ? { ...i, is_refunded: true, refund_reason: reason } : i
      );
    });
    toast({ title: "Item refunded", description: `${refundItem.item_name}: ${reason}` });
    setRefundItem(null);
  };

  const handleSettle = async () => {
    if (!order || !selectedPayment) return;
    setSettling(true);

    await supabase.from("orders").update({
      payment_mode: selectedPayment,
      status: "completed" as const,
      completed_at: new Date().toISOString(),
      subtotal: calculated.discountedSubtotal,
      tax: calculated.gst,
      total: calculated.grandTotal,
      discount: calculated.discountAmt,
      discount_type: discountType || null,
      discount_value: parseFloat(discountValue) || 0,
      service_charge: calculated.serviceCharge,
    }).eq("id", order.id);

    if (releaseTable && order.table_id) {
      await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", order.table_id);
      await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", order.table_id).is("cleared_at", null);
    }

    printReceipt(order, selectedPayment);

    const method = paymentMethods.find(m => m.code === selectedPayment);
    const payLabel = method?.name || selectedPayment.replace(/_/g, " ").toUpperCase();
    toast({ title: "Order Settled!", description: `Order #${order.order_number} paid via ${payLabel}${releaseTable && order.table_id ? " · Table released" : ""}` });
    resetState();
    onSettled();
  };

  const printReceipt = (o: OrderWithItems, paymentMethodCode: string) => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;
    const staffName = profile?.full_name || user?.email || "Staff";
    const staffId = user?.id?.slice(0, 8).toUpperCase() || "N/A";
    const activeItems = items.filter(i => !i.is_void);
    const itemsHtml = activeItems.map(i => {
      const tag = i.is_refunded
        ? ' <em style="color:#c00">(REFUNDED)</em>'
        : i.is_nc ? ' <em style="color:#888">(NC)</em>' : "";
      const amt = (i.is_nc || i.is_refunded) ? "₹0.00" : `₹${i.total_price}`;
      return `
      <tr>
        <td style="padding:3px 0;font-size:12px;">${i.item_name}${tag}</td>
        <td style="text-align:center;font-size:12px;">${i.quantity}</td>
        <td style="text-align:right;font-size:12px;">₹${i.unit_price}</td>
        <td style="text-align:right;font-size:12px;font-weight:bold;">${amt}</td>
      </tr>`;
    }).join("");

    const tableInfo = o.order_type === "dine_in" && o.table_number ? `Table ${o.table_number}` : "Takeaway";
    const discountLine = calculated.discountAmt > 0
      ? `<div><span>Discount${discountType === "percentage" ? ` (${discountValue}%)` : ""}</span><span>-₹${calculated.discountAmt.toFixed(2)}</span></div>` : "";
    const scLine = calculated.serviceCharge > 0
      ? `<div><span>Service Charge (${SERVICE_CHARGE_PCT}%)</span><span>₹${calculated.serviceCharge.toFixed(2)}</span></div>` : "";
    const method = paymentMethods.find(m => m.code === paymentMethodCode);
    const payLabel = method?.name || paymentMethodCode.replace(/_/g, " ");

    printWindow.document.write(`
      <html><head><title>Receipt #${o.order_number}</title>
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
      .staff{text-align:center;font-size:10px;color:#555;margin-top:6px;border-top:1px dashed #000;padding-top:6px;}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:6px;}</style></head>
      <body>
        <h2>${settings.restaurantName.toUpperCase()}</h2>
        <div class="sub">Tax Invoice</div>
        <div class="info">
          <div>Order #${o.order_number} · ${tableInfo}</div>
          <div>${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
          ${o.customer_name ? `<div>Customer: ${o.customer_name}</div>` : ""}
        </div>
        <table>
          <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr>
          ${itemsHtml}
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>₹${calculated.activeSubtotal.toFixed(2)}</span></div>
          ${discountLine}
          <div><span>${TAX_LABEL} (${TAX_PCT}%)</span><span>₹${calculated.gst.toFixed(2)}</span></div>
          ${scLine}
          <div class="grand"><span>Total</span><span>₹${calculated.grandTotal.toFixed(2)}</span></div>
        </div>
        <div class="pay">Paid via ${payLabel}</div>
        <div class="staff">Billed by: ${staffName} (${staffId})</div>
        <div class="footer">Thank you! Visit again.</div>
        <script>setTimeout(()=>{window.print();window.close();},400)<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  if (!order) return null;

  const isManager = isAtLeast("branch_manager");

  return (
    <>
      <Dialog open={!!order} onOpenChange={() => { resetState(); onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Checkout — Order #{order.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Order info */}
            <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{order.order_type === "dine_in" ? "Dining" : "Takeaway"}</span></div>
              {order.table_number && <div className="flex justify-between"><span className="text-muted-foreground">Table</span><span className="font-medium">{order.table_number}</span></div>}
              {order.customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{order.customer_name}</span></div>}
            </div>

            {/* Action buttons: Add Items + Cancel Order */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddItems(true)} className="flex-1">
                <Plus className="h-4 w-4 mr-1.5" /> Add Items
              </Button>
              {isManager && (
                <Button variant="destructive" size="sm" onClick={() => setShowCancelOrder(true)} className="flex-1">
                  <XCircle className="h-4 w-4 mr-1.5" /> Cancel Order
                </Button>
              )}
            </div>

            {/* Items with void/NC/refund actions */}
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className={`flex items-center justify-between text-sm gap-2 ${item.is_void ? "opacity-40 line-through" : ""}`}>
                  <span className="text-muted-foreground flex-1">
                    {item.quantity}× {item.item_name}
                    {item.is_nc && <span className="ml-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">NC</span>}
                    {item.is_refunded && <span className="ml-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">REFUNDED</span>}
                    {item.is_void && <span className="ml-1 text-[10px] font-semibold text-destructive">VOID</span>}
                  </span>
                  <span className="font-mono">{(item.is_nc || item.is_refunded) ? "₹0" : `₹${item.total_price}`}</span>
                  {isManager && !item.is_void && (
                    <div className="flex gap-1">
                      {!item.is_nc && !item.is_refunded && (
                        <button onClick={() => setNcItem(item)} title="Mark NC (₹0)"
                          className="p-1 rounded hover:bg-amber-500/10 text-amber-600">
                          <Gift className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!item.is_refunded && !item.is_nc && (
                        <button onClick={() => setRefundItem(item)} title="Refund item"
                          className="p-1 rounded hover:bg-destructive/10 text-destructive">
                          <Undo2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setVoidingItem(item)} title="Void item"
                        className="p-1 rounded hover:bg-destructive/10 text-destructive">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Discount section (managers only) */}
            {isManager && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Discount
                </p>
                <div className="flex gap-2">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as "flat" | "percentage" | "")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="No discount" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="flat">Flat (₹)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  {discountType && discountType !== "none" && (
                    <Input
                      type="number" min="0" placeholder={discountType === "flat" ? "₹ amount" : "% value"}
                      value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-24"
                    />
                  )}
                </div>
                {calculated.discountAmt > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">Discount: -₹{calculated.discountAmt.toFixed(2)}</p>
                )}
              </div>
            )}

            {/* Service charge toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <label className="text-sm flex items-center gap-1.5 cursor-pointer">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Service Charge ({SERVICE_CHARGE_PCT}%)
              </label>
              <Switch checked={serviceChargeEnabled} onCheckedChange={setServiceChargeEnabled} />
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">₹{calculated.activeSubtotal.toFixed(2)}</span></div>
              {calculated.discountAmt > 0 && (
                <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span className="font-mono">-₹{calculated.discountAmt.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{TAX_LABEL} ({TAX_PCT}%)</span><span className="font-mono">₹{calculated.gst.toFixed(2)}</span></div>
              {calculated.serviceCharge > 0 && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service Charge ({SERVICE_CHARGE_PCT}%)</span><span className="font-mono">₹{calculated.serviceCharge.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1 border-t border-border"><span>Total</span><span className="font-mono">₹{calculated.grandTotal.toFixed(2)}</span></div>
            </div>

            {/* Payment methods - dynamic */}
            <div className="space-y-2">
              {directMethods.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Direct Payment</p>
                  <div className="grid grid-cols-3 gap-2">
                    {directMethods.map(pm => {
                      const Icon = iconForCode(pm.code);
                      const selected = selectedPayment === pm.code;
                      return (
                        <button key={pm.code} onClick={() => setSelectedPayment(pm.code)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                          <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-semibold text-center ${selected ? "text-primary" : "text-muted-foreground"}`}>{pm.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {aggregatorMethods.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-3">Partner / Aggregator</p>
                  <div className="grid grid-cols-3 gap-2">
                    {aggregatorMethods.map(pm => {
                      const Icon = iconForCode(pm.code);
                      const selected = selectedPayment === pm.code;
                      return (
                        <button key={pm.code} onClick={() => setSelectedPayment(pm.code)}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                          <Icon className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-[10px] font-semibold leading-tight text-center ${selected ? "text-primary" : "text-muted-foreground"}`}>{pm.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Table release */}
            {order.table_id && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                <Checkbox id="release-table" checked={releaseTable} onCheckedChange={(v) => setReleaseTable(!!v)} />
                <label htmlFor="release-table" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  Release table after settlement
                </label>
              </div>
            )}

            <Button onClick={handleSettle} disabled={!selectedPayment || settling} className="w-full" size="lg">
              {settling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Print & Settle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VoidItemDialog
        open={!!voidingItem}
        onClose={() => setVoidingItem(null)}
        itemName={voidingItem?.item_name || ""}
        onConfirm={handleVoidConfirm}
      />

      <NCReasonDialog
        open={!!ncItem}
        itemName={ncItem?.item_name || ""}
        onClose={() => setNcItem(null)}
        onConfirm={handleNCConfirm}
      />

      <RefundItemDialog
        open={!!refundItem}
        itemName={refundItem?.item_name || ""}
        amount={refundItem?.total_price || 0}
        onClose={() => setRefundItem(null)}
        onConfirm={handleRefundConfirm}
      />

      {order && (
        <>
          <AddItemsDialog
            open={showAddItems}
            orderId={order.id}
            orderNumber={order.order_number}
            onClose={() => setShowAddItems(false)}
            onAdded={() => { resetState(); onSettled(); }}
          />
          <CancelOrderDialog
            open={showCancelOrder}
            orderId={order.id}
            orderNumber={order.order_number}
            tableId={order.table_id}
            onClose={() => setShowCancelOrder(false)}
            onCancelled={() => { resetState(); onSettled(); }}
          />
        </>
      )}
    </>
  );
};

export default CheckoutModal;
