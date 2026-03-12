import { AlertTriangle, PackageX, Clock } from "lucide-react";
import type { StockAlert } from "@/data/mockInventory";

const typeConfig = {
  low_stock: { icon: AlertTriangle, className: "text-stock-low", bg: "bg-stock-low/10" },
  out_of_stock: { icon: PackageX, className: "text-stock-out", bg: "bg-stock-out/10" },
  expiring: { icon: Clock, className: "text-stock-expiring", bg: "bg-stock-expiring/10" },
};

const AlertItem = ({ alert }: { alert: StockAlert }) => {
  const config = typeConfig[alert.type];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border border-border p-4 ${alert.resolved ? "opacity-50" : ""}`}>
      <div className={`rounded-lg p-2 ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.className}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-card-foreground">{alert.ingredientName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          {new Date(alert.timestamp).toLocaleString()}
        </p>
      </div>
      {alert.resolved && (
        <span className="text-[10px] uppercase tracking-wider text-stock-good font-semibold">Resolved</span>
      )}
    </div>
  );
};

export default AlertItem;
