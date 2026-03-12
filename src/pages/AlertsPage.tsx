import { useState } from "react";
import AlertItem from "@/components/inventory/AlertItem";
import { stockAlerts } from "@/data/mockInventory";

const AlertsPage = () => {
  const [showResolved, setShowResolved] = useState(false);
  const filtered = showResolved ? stockAlerts : stockAlerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Low stock, out-of-stock, and expiry notifications</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-input accent-primary"
          />
          Show resolved
        </label>
      </div>

      <div className="space-y-3 max-w-2xl">
        {filtered.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No active alerts — everything looks good! 🎉
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
