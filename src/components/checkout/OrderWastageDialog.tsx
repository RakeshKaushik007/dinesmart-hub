import { useState, useEffect } from "react";
import { Trash2, Loader2 } from "lucide-react";
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

const OrderWastageDialog = ({ open, orderId, orderNumber, onClose, onLogged }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("spoiled");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("ingredients")
      .select("id, name, unit, cost_per_unit, category, branch_id, current_stock")
      .order("name")
      .then(({ data }) => setIngredients(data || []));
  }, [open]);

  const reset = () => {
    setIngredientId("");
    setQuantity("");
    setReason("spoiled");
    setNotes("");
  };

  const handleSubmit = async () => {
    const qty = Number(quantity);
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing || !qty || qty <= 0) {
      toast({ title: "Missing fields", description: "Pick an ingredient and enter a positive quantity.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const cost = qty * Number(ing.cost_per_unit || 0);
    const noteText = `Order #${orderNumber}${notes ? ` — ${notes}` : ""}`;

    const { error: logErr } = await supabase.from("wastage_logs").insert({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      category: ing.category,
      quantity: qty,
      unit: ing.unit,
      cost,
      reason,
      notes: noteText,
      branch_id: ing.branch_id,
      logged_by: user?.id || null,
    });

    if (logErr) {
      toast({ title: "Failed to log wastage", description: logErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    await supabase
      .from("ingredients")
      .update({
        current_stock: Math.max(0, Number(ing.current_stock || 0) - qty),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ing.id);

    toast({ title: "Wastage logged", description: `${qty} ${ing.unit} of ${ing.name} added to wastage report.` });
    reset();
    setSubmitting(false);
    onLogged?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Log Wastage — Order #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            Record any extra ingredient wastage tied to this order. The entry will appear in the wastage report and stock will be deducted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Ingredient</Label>
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger>
              <SelectContent>
                {ingredients.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
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
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dropped while plating" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="destructive">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Log Wastage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderWastageDialog;