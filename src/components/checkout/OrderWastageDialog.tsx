import { useState, useEffect } from "react";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  orderId: string;
  orderNumber: number;
  onClose: () => void;
  onLogged?: () => void;
}

const REASONS = [
  { value: "spoiled", label: "Spoiled" },
  { value: "spilled", label: "Spilled" },
  { value: "over_cooking", label: "Over-cooked" },
  { value: "expired", label: "Expired" },
  { value: "discrepancy", label: "Discrepancy" },
];

interface WastageLine {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  cost_per_unit: number;
  category: string | null;
  branch_id: string | null;
  current_stock: number;
  suggested_qty: number;
  quantity: string;
  source_items: string[];
}

const OrderWastageDialog = ({ open, orderId, orderNumber, onClose, onLogged }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<WastageLine[]>([]);
  const [reason, setReason] = useState("spoiled");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 1. Load active order items (skip voided/refunded)
      const { data: items } = await supabase
        .from("order_items")
        .select("menu_item_id, item_name, quantity, is_void, is_refunded")
        .eq("order_id", orderId);
      const activeItems = (items || []).filter(
        (i) => i.menu_item_id && !i.is_void && !i.is_refunded
      );
      if (activeItems.length === 0) {
        if (!cancelled) { setLines([]); setLoading(false); }
        return;
      }
      const menuItemIds = Array.from(new Set(activeItems.map((i) => i.menu_item_id as string)));

      // 2. Load recipes for those menu items
      const { data: recipes } = await supabase
        .from("recipe_ingredients")
        .select("menu_item_id, ingredient_id, quantity, unit")
        .in("menu_item_id", menuItemIds);

      if (!recipes || recipes.length === 0) {
        if (!cancelled) { setLines([]); setLoading(false); }
        return;
      }

      // 3. Load ingredient details
      const ingredientIds = Array.from(new Set(recipes.map((r) => r.ingredient_id)));
      const { data: ingredients } = await supabase
        .from("ingredients")
        .select("id, name, unit, cost_per_unit, category, branch_id, current_stock")
        .in("id", ingredientIds);

      // 4. Aggregate quantity per ingredient based on order item quantities
      const agg = new Map<string, WastageLine>();
      for (const item of activeItems) {
        const itemRecipes = recipes.filter((r) => r.menu_item_id === item.menu_item_id);
        for (const r of itemRecipes) {
          const ing = (ingredients || []).find((i) => i.id === r.ingredient_id);
          if (!ing) continue;
          const qty = Number(r.quantity) * Number(item.quantity);
          const existing = agg.get(ing.id);
          const label = `${item.item_name} x${item.quantity}`;
          if (existing) {
            existing.suggested_qty += qty;
            if (!existing.source_items.includes(label)) existing.source_items.push(label);
          } else {
            agg.set(ing.id, {
              ingredient_id: ing.id,
              ingredient_name: ing.name,
              unit: r.unit || ing.unit,
              cost_per_unit: Number(ing.cost_per_unit || 0),
              category: ing.category,
              branch_id: ing.branch_id,
              current_stock: Number(ing.current_stock || 0),
              suggested_qty: qty,
              quantity: qty.toFixed(2),
              source_items: [label],
            });
          }
        }
      }

      // Refresh quantity string after aggregation
      const finalLines = Array.from(agg.values()).map((l) => ({
        ...l,
        quantity: l.suggested_qty.toFixed(2),
      }));

      if (!cancelled) {
        setLines(finalLines);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, orderId]);

  const reset = () => {
    setLines([]);
    setReason("spoiled");
    setNotes("");
  };

  const updateLineQty = (idx: number, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: value } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalCost = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * l.cost_per_unit,
    0
  );

  const handleSubmit = async () => {
    const valid = lines
      .map((l) => ({ ...l, qty: Number(l.quantity) }))
      .filter((l) => l.qty > 0);

    if (valid.length === 0) {
      toast({
        title: "Nothing to log",
        description: "Enter a positive quantity for at least one ingredient.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const noteSuffix = notes ? ` — ${notes}` : "";
    const rows = valid.map((l) => ({
      ingredient_id: l.ingredient_id,
      ingredient_name: l.ingredient_name,
      category: l.category,
      quantity: l.qty,
      unit: l.unit,
      cost: l.qty * l.cost_per_unit,
      reason,
      notes: `Order #${orderNumber} — from ${l.source_items.join(", ")}${noteSuffix}`,
      branch_id: l.branch_id,
      logged_by: user?.id || null,
    }));

    const { error: logErr } = await supabase.from("wastage_logs").insert(rows);

    if (logErr) {
      toast({ title: "Failed to log wastage", description: logErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Deduct stock for each line
    await Promise.all(
      valid.map((l) =>
        supabase
          .from("ingredients")
          .update({
            current_stock: Math.max(0, l.current_stock - l.qty),
            updated_at: new Date().toISOString(),
          })
          .eq("id", l.ingredient_id)
      )
    );

    toast({
      title: "Wastage logged",
      description: `${valid.length} ingredient${valid.length === 1 ? "" : "s"} added to wastage report.`,
    });
    reset();
    setSubmitting(false);
    onLogged?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Log Wastage — Order #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            Ingredients are auto-loaded from the recipes of items in this order. Adjust quantities if only part was wasted, or remove rows that don't apply. Stock will be deducted accordingly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">No recipe ingredients found</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  None of the items in this order have recipes defined, or all items were voided/refunded. Add recipes in the Recipes dashboard to enable auto wastage.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                <div className="col-span-5">Ingredient</div>
                <div className="col-span-3">Quantity</div>
                <div className="col-span-3 text-right">Cost</div>
                <div className="col-span-1"></div>
              </div>
              <div className="divide-y">
                {lines.map((l, idx) => {
                  const qty = Number(l.quantity) || 0;
                  const cost = qty * l.cost_per_unit;
                  return (
                    <div key={l.ingredient_id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-medium truncate">{l.ingredient_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          From: {l.source_items.join(", ")}
                        </p>
                      </div>
                      <div className="col-span-3 flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.quantity}
                          onChange={(e) => updateLineQty(idx, e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">{l.unit}</span>
                      </div>
                      <div className="col-span-3 text-right text-sm font-mono">
                        ₹{cost.toFixed(2)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center px-3 py-2 border-t bg-muted/30 text-sm">
                <span className="text-muted-foreground">Total wastage cost</span>
                <span className="font-mono font-semibold">₹{totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dropped while plating, kitchen accident" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading || lines.length === 0} variant="destructive">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Log Wastage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderWastageDialog;