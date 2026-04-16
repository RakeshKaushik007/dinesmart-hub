import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REASON_CODES = [
  "Customer refused Service Charge",
  "Incorrect items billed",
  "Wrong payment mode recorded",
  "Discount not applied",
  "Price correction needed",
  "Customer complaint",
  "Other",
] as const;

interface ReopenBillDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: number;
  onReopened: () => void;
}

const ReopenBillDialog = ({ open, onClose, orderId, orderNumber, onReopened }: ReopenBillDialogProps) => {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReopen = async () => {
    const fullReason = reason === "Other" ? `Other: ${notes}` : reason;
    if (!fullReason) return;

    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending_adjustment" as any,
        reopen_reason: fullReason,
        completed_at: null,
      })
      .eq("id", orderId);

    setSaving(false);
    if (error) {
      toast.error("Failed to reopen bill");
      return;
    }
    toast.success(`Bill #${orderNumber} reopened for adjustment`);
    setReason("");
    setNotes("");
    onReopened();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen Bill #{orderNumber}</DialogTitle>
          <DialogDescription>This will unlock the settled bill for adjustment. A reason is mandatory for audit purposes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Reason Code *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "Other" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Details *</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe the reason..." rows={3} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleReopen}
            disabled={saving || !reason || (reason === "Other" && !notes.trim())}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Reopen Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReopenBillDialog;
