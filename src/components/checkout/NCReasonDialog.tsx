import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const NC_REASONS = [
  "Spoiled / spilled",
  "Overcooked",
  "Wrong dish prepared",
  "Customer complaint",
  "Staff meal",
  "Tasting / sample",
  "Complimentary",
  "Other",
];

interface Props {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

const NCReasonDialog = ({ open, itemName, onClose, onConfirm }: Props) => {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finalReason = reason === "Other" ? customReason.trim() : reason;
  const canSubmit = finalReason.length > 0;

  const handleClose = () => {
    setReason("");
    setCustomReason("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onConfirm(finalReason);
    setSubmitting(false);
    setReason("");
    setCustomReason("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-600" />
            Mark Non-Chargeable
          </DialogTitle>
          <DialogDescription>
            Mark <span className="font-semibold text-foreground">{itemName}</span> as ₹0 (non-chargeable). A reason is required for the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {NC_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reason === "Other" && (
            <div>
              <Label className="text-xs">Specify reason</Label>
              <Input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom reason"
                autoFocus
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting} className="bg-amber-600 hover:bg-amber-700">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
            Confirm NC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NCReasonDialog;
