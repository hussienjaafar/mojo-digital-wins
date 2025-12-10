import * as React from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface V3EmptyStateProps {
  /** Custom icon (defaults to Inbox) */
  icon?: LucideIcon;
  /** Empty state title */
  title: string;
  /** Empty state description */
  description?: string;
  /** Optional action (e.g., button, link) */
  action?: React.ReactNode;
  /** Size variant */
  variant?: "compact" | "default" | "large";
  /** Additional class names */
  className?: string;
}

export const V3EmptyState: React.FC<V3EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
  className,
}) => {
  const sizeClasses = {
    compact: "py-6 px-4",
    default: "py-10 px-6",
    large: "py-16 px-8",
  };

  const iconSizes = {
    compact: "h-8 w-8",
    default: "h-12 w-12",
    large: "h-16 w-16",
  };

  const titleSizes = {
    compact: "text-sm",
    default: "text-base",
    large: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeClasses[variant],
        className
      )}
      role="status"
      aria-label={title}
    >
      <div
        className={cn(
          "rounded-full p-4 mb-4",
          "bg-[hsl(var(--portal-bg-elevated))]"
        )}
      >
        <Icon
          className={cn(iconSizes[variant], "text-[hsl(var(--portal-text-muted))]")}
          aria-hidden="true"
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-[hsl(var(--portal-text-primary))]",
          titleSizes[variant]
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

V3EmptyState.displayName = "V3EmptyState";
