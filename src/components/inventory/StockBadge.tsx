import type { StockStatus } from "@/data/mockInventory";

const statusConfig: Record<StockStatus, { label: string; className: string }> = {
  good: { label: "In Stock", className: "bg-stock-good/10 text-stock-good" },
  low: { label: "Low Stock", className: "bg-stock-low/10 text-stock-low" },
  out: { label: "Out of Stock", className: "bg-stock-out/10 text-stock-out" },
  expiring: { label: "Expiring Soon", className: "bg-stock-expiring/10 text-stock-expiring" },
  expired: { label: "Expired", className: "bg-destructive/15 text-destructive" },
};

const StockBadge = ({ status }: { status: StockStatus }) => {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StockBadge;
