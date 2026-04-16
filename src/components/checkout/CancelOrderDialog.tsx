import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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

    // Release table if applicable
    if (tableId) {
      await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", tableId);
      await supabase.from("table_sessions").update({ cleared_at: new Date().toISOString() }).eq("table_id", tableId).is("cleared_at", null);
    }

    toast({ title: "Order Cancelled", description: `Order #${orderNumber} has been cancelled` });
    setCancelling(false);
    setReason("");
    setCustomReason("");
    onCancelled();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { setReason(""); setCustomReason(""); onClose(); }}>
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
