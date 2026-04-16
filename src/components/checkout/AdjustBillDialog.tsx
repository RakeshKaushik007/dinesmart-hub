import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";

interface AdjustBillDialogProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number: number;
    subtotal: number;
    service_charge: number | null;
    tax: number;
    discount: number;
    total: number;
  } | null;
  onSettled: () => void;
}

const AdjustBillDialog = ({ open, onClose, order, onSettled }: AdjustBillDialogProps) => {
  const settings = useSettings();
  const [includeServiceCharge, setIncludeServiceCharge] = useState(true);
  const [saving, setSaving] = useState(false);

  // Derive the base food subtotal (subtotal without service charge from original order)
  const baseSubtotal = order ? order.subtotal - (order.service_charge || 0) : 0;

  useEffect(() => {
    if (order) {
      setIncludeServiceCharge((order.service_charge || 0) > 0);
    }
  }, [order]);

  if (!order) return null;

  const serviceChargeAmt = includeServiceCharge
    ? Math.round(baseSubtotal * (settings.serviceChargePct / 100) * 100) / 100
    : 0;
  const newSubtotal = baseSubtotal + serviceChargeAmt;
  const newTax = Math.round(newSubtotal * (settings.taxRate / 100) * 100) / 100;
  const newTotal = Math.round((newSubtotal + newTax - order.discount) * 100) / 100;

  const hasChanges =
    serviceChargeAmt !== (order.service_charge || 0) ||
    newTax !== order.tax ||
    newTotal !== order.total;

  const handleResettle = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        subtotal: newSubtotal,
        service_charge: serviceChargeAmt,
        tax: newTax,
        total: newTotal,
        status: "completed" as any,
        completed_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to re-settle bill");
      return;
    }
    toast.success(`Bill #${order.order_number} adjusted and re-settled`);
    onSettled();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Bill #{order.order_number}</DialogTitle>
          <DialogDescription>Toggle charges and review the recalculated totals before re-settling.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Service Charge Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Service Charge ({settings.serviceChargePct}%)</p>
              <p className="text-xs text-muted-foreground">
                {includeServiceCharge ? `₹${serviceChargeAmt.toLocaleString()}` : "Removed"}
              </p>
            </div>
            <Switch checked={includeServiceCharge} onCheckedChange={setIncludeServiceCharge} />
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Food Subtotal</span>
              <span className="font-mono">₹{baseSubtotal.toLocaleString()}</span>
            </div>
            {includeServiceCharge && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service Charge ({settings.serviceChargePct}%)</span>
                <span className="font-mono">₹{serviceChargeAmt.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{settings.taxLabel} ({settings.taxRate}%)</span>
              <span className="font-mono">₹{newTax.toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="font-mono text-emerald-500">-₹{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between font-semibold text-foreground">
              <span>New Total</span>
              <span className="font-mono">₹{newTotal.toLocaleString()}</span>
            </div>
            {hasChanges && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Previous Total</span>
                <span className="font-mono line-through">₹{Number(order.total).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleResettle} disabled={saving || !hasChanges}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Re-Settle Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustBillDialog;
