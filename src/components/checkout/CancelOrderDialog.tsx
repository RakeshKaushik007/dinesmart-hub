import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logWastageForPreparedItem } from "@/lib/wastageHelpers";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CANCEL_REASONS = [
  "Customer cancelled",
  "Kitchen unable to prepare",
  "Duplicate order",
  "Wrong order placed",
  "Customer no-show",
  "Other",
];

interface Props {
  open: boolean;
  orderId: string;
  orderNumber: number;
  tableId: string | null;
  onClose: () => void;
  onCancelled: () => void;
}

const CancelOrderDialog = ({ open, orderId, orderNumber, tableId, onClose, onCancelled }: Props) => {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [wasPrepared, setWasPrepared] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleConfirm = async () => {
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) {
      toast({ title: "Reason required", description: "Please select or enter a cancellation reason", variant: "destructive" });
      return;
    }

    setCancelling(true);

    const { error } = await supabase.from("orders").update({
      status: "cancelled" as const,
      cancellation_reason: finalReason,
      cancelled_at: new Date().toISOString(),
    }).eq("id", orderId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setCancelling(false);
      return;
    }

    // If food was prepared, log wastage for every order item
    let totalWasteLines = 0;
    if (wasPrepared) {
      const { data: items } = await supabase
        .from("order_items")
        .select("menu_item_id, quantity, item_name, is_void, is_refunded")
        .eq("order_id", orderId);
      const { data: ord } = await supabase
        .from("orders")
        .select("order_number, branch_id")
        .eq("id", orderId)
        .maybeSingle();
      const orderNum = ord?.order_number ?? orderNumber;
      for (const it of items || []) {
        if (it.is_void || it.is_refunded) continue;
        const lines = await logWastageForPreparedItem({
          menuItemId: it.menu_item_id,
          itemQuantity: it.quantity,
          itemName: it.item_name,
          orderNumber: orderNum,
          reason: "cancelled",
          reasonDetail: finalReason,
          loggedBy: user?.id,
          branchId: ord?.branch_id,
        });
        totalWasteLines += lines;
      }
    }

    // Release table if applicable
    if (tableId) {
      await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", tableId);
      await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", tableId).is("cleared_at", null);
    }

    toast({
      title: "Order Cancelled",
      description: `Order #${orderNumber} cancelled${totalWasteLines > 0 ? ` · ${totalWasteLines} ingredient line(s) logged to wastage` : ""}`,
    });
    setCancelling(false);
    setReason("");
    setCustomReason("");
    setWasPrepared(false);
    onCancelled();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { setReason(""); setCustomReason(""); setWasPrepared(false); onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Order #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The order will be marked as cancelled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Cancellation Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "Other" && (
            <Textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              className="resize-none"
              rows={3}
            />
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Checkbox
              id="cancelorder-prepared"
              checked={wasPrepared}
              onCheckedChange={(v) => setWasPrepared(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="cancelorder-prepared" className="text-xs text-foreground cursor-pointer leading-snug">
              <span className="font-semibold">Food was already prepared</span>
              <span className="block text-muted-foreground mt-0.5">
                Ingredients for all non-cancelled items will be logged to the wastage report.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Go Back</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={cancelling || (!reason || (reason === "Other" && !customReason.trim()))}>
            {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Confirm Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelOrderDialog;
