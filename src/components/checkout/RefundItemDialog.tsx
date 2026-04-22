import { useState } from "react";
import { Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const REFUND_REASONS = [
  "Bad taste",
  "Undercooked",
  "Overcooked",
  "Wrong dish served",
  "Customer unhappy",
  "Cold food",
  "Foreign object",
  "Allergic reaction",
  "Other",
];

interface Props {
  open: boolean;
  itemName: string;
  amount: number;
  onClose: () => void;
  onConfirm: (reason: string, wasPrepared: boolean) => Promise<void> | void;
}

const RefundItemDialog = ({ open, itemName, amount, onClose, onConfirm }: Props) => {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [wasPrepared, setWasPrepared] = useState(true);

  const finalReason = reason === "Other" ? customReason.trim() : reason;
  const canSubmit = finalReason.length > 0;

  const handleClose = () => {
    setReason("");
    setCustomReason("");
    setWasPrepared(true);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onConfirm(finalReason, wasPrepared);
    setSubmitting(false);
    setReason("");
    setCustomReason("");
    setWasPrepared(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-destructive" />
            Refund Item
          </DialogTitle>
          <DialogDescription>
            Refund <span className="font-semibold text-foreground">{itemName}</span>{" "}
            (<span className="font-mono">₹{amount.toFixed(2)}</span>). The amount will be deducted from the order total.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Refund reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
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
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Checkbox
              id="refund-prepared"
              checked={wasPrepared}
              onCheckedChange={(v) => setWasPrepared(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="refund-prepared" className="text-xs text-foreground cursor-pointer leading-snug">
              <span className="font-semibold">Food was already prepared</span>
              <span className="block text-muted-foreground mt-0.5">
                If checked, ingredients will be logged to the wastage report.
              </span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting} variant="destructive">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
            Confirm Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefundItemDialog;
