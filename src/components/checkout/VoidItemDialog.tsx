import { useState } from "react";
import { XCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CANCEL_REASONS = [
  "Cold Food",
  "Wrong Item",
  "Customer Changed Mind",
  "Quality Issue",
  "Long Wait Time",
  "Allergy Concern",
  "Other",
];

interface VoidItemDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  onConfirm: (reason: string, pin: string, wasPrepared: boolean) => void;
}

const VoidItemDialog = ({ open, onClose, itemName, onConfirm }: VoidItemDialogProps) => {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [wasPrepared, setWasPrepared] = useState(false);

  const handleConfirm = () => {
    if (!reason || !pin) return;
    onConfirm(reason, pin, wasPrepared);
    setReason("");
    setPin("");
    setWasPrepared(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Cancel Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 rounded-lg p-3 text-sm">
            <span className="text-muted-foreground">Cancelling:</span>{" "}
            <span className="font-semibold text-foreground">{itemName}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason Code *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Manager PIN *
            </label>
            <Input
              type="password"
              maxLength={6}
              placeholder="Enter manager PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Checkbox
              id="cancel-prepared"
              checked={wasPrepared}
              onCheckedChange={(v) => setWasPrepared(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="cancel-prepared" className="text-xs text-foreground cursor-pointer leading-snug">
              <span className="font-semibold">Food was already prepared</span>
              <span className="block text-muted-foreground mt-0.5">
                If checked, ingredients will be logged to the wastage report.
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Go Back</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!reason || !pin} className="flex-1">
              Confirm Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoidItemDialog;
