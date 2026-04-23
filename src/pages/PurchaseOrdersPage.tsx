import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, FileText, Loader2, PackageCheck, Plus, Trash2, Truck } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type PurchaseOrderStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
}

interface PurchaseOrderItemRow {
  id: string;
  ingredient_id: string | null;
  ingredient_name: string;
  quantity: number;
  received_quantity: number | null;
  unit: string;
  unit_cost: number;
  total_cost: number;
  expiry_date: string | null;
}

interface PurchaseOrderRow {
  id: string;
  po_number: number;
  vendor_name: string;
  vendor_phone: string | null;
  status: PurchaseOrderStatus;
  total_amount: number;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  created_at: string;
  purchase_order_items: PurchaseOrderItemRow[] | null;
}

interface DraftLine {
  ingredient_id: string;
  quantity: string;
  unit_cost: string;
  expiry_date: string | null;
}

const statusStyles: Record<PurchaseOrderStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-primary/10 text-primary",
  partial: "bg-accent text-accent-foreground",
  received: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const emptyLine: DraftLine = {
  ingredient_id: "",
  quantity: "",
  unit_cost: "",
  expiry_date: null,
};

const PurchaseOrdersPage = () => {
  const [filter, setFilter] = useState<string>("all");
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, roles } = useAuth();

  const branchId = useMemo(() => roles.find((role) => role.branch_id)?.branch_id ?? null, [roles]);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);

    const [ordersRes, ingredientsRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          vendor_name,
          vendor_phone,
          status,
          total_amount,
          expected_date,
          received_date,
          notes,
          created_at,
          purchase_order_items (
            id,
            ingredient_id,
            ingredient_name,
            quantity,
            received_quantity,
            unit,
            unit_cost,
            total_cost,
            expiry_date
          )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("ingredients").select("id, name, unit, cost_per_unit").order("name"),
    ]);

    if (ordersRes.error) {
      toast({ title: "Could not load purchase orders", description: ordersRes.error.message, variant: "destructive" });
    } else {
      setOrders((ordersRes.data as PurchaseOrderRow[]) || []);
    }

    if (ingredientsRes.error) {
      toast({ title: "Could not load ingredients", description: ingredientsRes.error.message, variant: "destructive" });
    } else {
      setIngredients(
        (ingredientsRes.data || []).map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          cost_per_unit: Number(item.cost_per_unit),
        })),
      );
    }

    if (showLoader) setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setVendorName("");
    setVendorPhone("");
    setLines([{ ...emptyLine }]);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        const nextLine = { ...line, ...patch };
        if (patch.ingredient_id !== undefined) {
          const ingredient = ingredients.find((item) => item.id === patch.ingredient_id);
          if (ingredient) {
            nextLine.unit_cost = ingredient.cost_per_unit.toString();
          }
        }
        return nextLine;
      }),
    );
  };

  const addLine = () => setLines((current) => [...current, { ...emptyLine }]);
  const removeLine = (index: number) => setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));

  const orderTotal = lines.reduce((sum, line) => {
    const qty = Number(line.quantity || 0);
    const rate = Number(line.unit_cost || 0);
    return sum + qty * rate;
  }, 0);

  const handleCreatePurchaseOrder = async () => {
    const trimmedVendorName = vendorName.trim();
    const preparedLines = lines
      .map((line) => {
        const ingredient = ingredients.find((item) => item.id === line.ingredient_id);
        return {
          ingredient,
          quantity: Number(line.quantity || 0),
          unitCost: Number(line.unit_cost || 0),
          expiry_date: line.expiry_date,
        };
      })
      .filter((line) => line.ingredient && line.quantity > 0);

    if (!trimmedVendorName) {
      toast({ title: "Vendor name required", description: "Enter the supplier name before saving.", variant: "destructive" });
      return;
    }

    if (preparedLines.length === 0) {
      toast({ title: "Add at least one item", description: "Choose an ingredient and quantity for this purchase order.", variant: "destructive" });
      return;
    }

    if (preparedLines.some((line) => line.unitCost < 0)) {
      toast({ title: "Invalid unit cost", description: "Unit cost cannot be negative.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const totalAmount = preparedLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        vendor_name: trimmedVendorName,
        vendor_phone: vendorPhone.trim() || null,
        status: "received",
        total_amount: totalAmount,
        created_by: user?.id ?? null,
        branch_id: branchId,
        received_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      toast({ title: "Could not create purchase order", description: orderError?.message || "Please try again.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(
      preparedLines.map((line) => ({
        purchase_order_id: order.id,
        ingredient_id: line.ingredient!.id,
        ingredient_name: line.ingredient!.name,
        quantity: line.quantity,
        received_quantity: line.quantity,
        unit: line.ingredient!.unit,
        unit_cost: line.unitCost,
        total_cost: line.quantity * line.unitCost,
        expiry_date: line.expiry_date,
      })),
    );

    if (itemsError) {
      await supabase.from("purchase_orders").delete().eq("id", order.id);
      toast({ title: "Could not save purchase order items", description: itemsError.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    await applyStockIn(order.id, preparedLines.map((line) => ({
      ingredient_id: line.ingredient!.id,
      ingredient_name: line.ingredient!.name,
      quantity: line.quantity,
      unit: line.ingredient!.unit,
      unit_cost: line.unitCost,
      expiry_date: line.expiry_date,
    })));

    toast({ title: "Purchase order received", description: "Stock has been added to your inventory." });
    resetForm();
    setDialogOpen(false);
    setSubmitting(false);
    fetchData(false);
  };

  const applyStockIn = async (
    purchaseOrderId: string,
    items: { ingredient_id: string; ingredient_name: string; quantity: number; unit: string; unit_cost: number; expiry_date?: string | null }[],
  ) => {
    for (const item of items) {
      const { data: ing } = await supabase
        .from("ingredients")
        .select("id, current_stock, min_threshold, expiry_date")
        .eq("id", item.ingredient_id)
        .maybeSingle();
      if (!ing) continue;
      const newStock = Number(ing.current_stock || 0) + item.quantity;
      const minThreshold = Number(ing.min_threshold || 0);
      const effectiveExpiry = item.expiry_date ?? ing.expiry_date;
      const newStatus =
        newStock <= 0
          ? "out"
          : newStock <= minThreshold
            ? "low"
            : effectiveExpiry && new Date(effectiveExpiry) <= new Date(Date.now() + 7 * 86400000)
              ? "expiring"
              : "good";
      const updatePayload: {
        current_stock: number;
        status: string;
        last_restocked: string;
        cost_per_unit?: number;
        expiry_date?: string;
      } = {
        current_stock: newStock,
        status: newStatus,
        last_restocked: new Date().toISOString(),
      };
      if (item.unit_cost > 0) updatePayload.cost_per_unit = item.unit_cost;
      if (item.expiry_date) updatePayload.expiry_date = item.expiry_date;
      await supabase.from("ingredients").update(updatePayload).eq("id", ing.id);
      await supabase.from("stock_transactions").insert({
        ingredient_id: ing.id,
        type: "in",
        quantity: item.quantity,
        unit: item.unit,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
        reference_id: purchaseOrderId,
        reference_type: "purchase_order",
        branch_id: branchId,
        created_by: user?.id ?? null,
        notes: `Restock: ${item.ingredient_name} +${item.quantity} ${item.unit}`,
      });
    }
  };

  const handleMarkReceived = async (order: PurchaseOrderRow) => {
    if (order.status === "received") return;
    setReceivingId(order.id);
    const items = (order.purchase_order_items || []).map((item) => ({
      ingredient_id: item.ingredient_id || "",
      ingredient_name: item.ingredient_name,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      unit_cost: Number(item.unit_cost || 0),
    })).filter((item) => item.ingredient_id && item.quantity > 0);

    if (items.length === 0) {
      toast({ title: "No valid items to receive", variant: "destructive" });
      setReceivingId(null);
      return;
    }

    await applyStockIn(order.id, items);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "received", received_date: new Date().toISOString().slice(0, 10) })
      .eq("id", order.id);

    if (error) {
      toast({ title: "Could not mark as received", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stock updated", description: `Ingredients added to inventory from PO-${String(order.po_number).padStart(3, "0")}.` });
      fetchData(false);
    }
    setReceivingId(null);
  };

  const filteredOrders = filter === "all" ? orders : orders.filter((order) => order.status === filter);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inward stock & vendor invoices</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "draft", "sent", "partial", "received", "cancelled"].map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {value === "all" ? "All Orders" : value}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredOrders.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">{order.vendor_name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">PO-{String(order.po_number).padStart(3, "0")}</span>
                    {order.vendor_phone && <span>{order.vendor_phone}</span>}
                    <span className="flex items-center gap-1 font-mono">
                      <FileText className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", statusStyles[order.status])}>
                  {order.status}
                </span>
                <span className="font-mono text-lg font-bold text-card-foreground">₹{Number(order.total_amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="py-2 text-left font-medium">Item</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Rate</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.purchase_order_items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border/30">
                      <td className="py-2 text-card-foreground">{item.ingredient_name}</td>
                      <td className="py-2 text-right font-mono">{Number(item.quantity)} {item.unit}</td>
                      <td className="py-2 text-right font-mono">₹{Number(item.unit_cost).toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-card-foreground">₹{Number(item.total_cost).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[10px] font-mono text-muted-foreground">
              {order.received_date
                ? `Received: ${new Date(order.received_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                : "Not received yet"}
            </p>
            {order.notes && <p className="mt-2 text-xs text-muted-foreground">{order.notes}</p>}

            {order.status !== "received" && order.status !== "cancelled" && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleMarkReceived(order)}
                  disabled={receivingId === order.id}
                >
                  {receivingId === order.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackageCheck className="h-4 w-4" />
                  )}
                  Mark as Received & Add to Stock
                </Button>
              </div>
            )}
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No purchase orders found for this filter.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create purchase order</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor name</Label>
              <Input id="vendor-name" value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Fresh Farm Supplies" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Vendor phone</Label>
              <Input id="vendor-phone" value={vendorPhone} onChange={(event) => setVendorPhone(event.target.value)} placeholder="9876543210" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value: PurchaseOrderStatus) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Invoice notes or delivery instructions" rows={3} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Order items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => {
                const selectedIngredient = ingredients.find((item) => item.id === line.ingredient_id);
                const lineTotal = Number(line.quantity || 0) * Number(line.unit_cost || 0);

                return (
                  <div key={`${index}-${line.ingredient_id || "new"}`} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,2fr)_120px_120px_auto]">
                    <div className="space-y-2">
                      <Label>Ingredient</Label>
                      <Select value={line.ingredient_id} onValueChange={(value) => updateLine(index, { ingredient_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ingredient" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ingredient) => (
                            <SelectItem key={ingredient.id} value={ingredient.id}>
                              {ingredient.name} ({ingredient.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Qty</Label>
                      <Input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate</Label>
                      <Input type="number" min="0" step="0.01" value={line.unit_cost} onChange={(event) => updateLine(index, { unit_cost: event.target.value })} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="min-w-[88px] pb-2 text-right text-xs text-muted-foreground">
                        <div>Total</div>
                        <div className="font-mono text-sm text-foreground">₹{lineTotal.toLocaleString()}</div>
                        {selectedIngredient && <div>{selectedIngredient.unit}</div>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={lines.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Order total</span>
            <span className="font-mono text-lg font-bold text-foreground">₹{orderTotal.toLocaleString()}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreatePurchaseOrder} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save purchase order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrdersPage;