import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
  className?: string;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className = "",
}: EmptyStateProps) => {
  const PrimaryIcon = primaryAction?.icon;
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 ${className}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 ring-1 ring-primary/20">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} size="sm">
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4 mr-1.5" />}
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} size="sm" variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
};

export default EmptyState;