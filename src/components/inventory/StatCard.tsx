import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "good" | "warning" | "danger";
}

const variantStyles = {
  default: "border-border",
  good: "border-stock-good/30",
  warning: "border-stock-low/30",
  danger: "border-stock-out/30",
};

const iconVariantStyles = {
  default: "bg-secondary text-secondary-foreground",
  good: "bg-stock-good/10 text-stock-good",
  warning: "bg-stock-low/10 text-stock-low",
  danger: "bg-stock-out/10 text-stock-out",
};

const StatCard = ({ label, value, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  return (
    <div className={`rounded-xl border bg-card p-5 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${iconVariantStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
