import { useState } from "react";
import { Ban, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const VOID_REASONS = [
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
  onConfirm: (reason: string, pin: string) => void;
}

const VoidItemDialog = ({ open, onClose, itemName, onConfirm }: VoidItemDialogProps) => {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");

  const handleConfirm = () => {
    if (!reason || !pin) return;
    onConfirm(reason, pin);
    setReason("");
    setPin("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Void Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 rounded-lg p-3 text-sm">
            <span className="text-muted-foreground">Voiding:</span>{" "}
            <span className="font-semibold text-foreground">{itemName}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason Code *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {VOID_REASONS.map((r) => (
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

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!reason || !pin} className="flex-1">
              Confirm Void
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoidItemDialog;
