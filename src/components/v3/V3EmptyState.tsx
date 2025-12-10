import * as React from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export type V3EmptyAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

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
  /** Accent color for the icon background */
  accent?: V3EmptyAccent;
  /** Additional class names */
  className?: string;
}

const accentClasses: Record<V3EmptyAccent, string> = {
  blue: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
  green: "bg-[hsl(var(--portal-success)/0.1)]",
  purple: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
  amber: "bg-[hsl(var(--portal-warning)/0.1)]",
  red: "bg-[hsl(var(--portal-error)/0.1)]",
  default: "bg-[hsl(var(--portal-bg-elevated))]",
};

const accentIconClasses: Record<V3EmptyAccent, string> = {
  blue: "text-[hsl(var(--portal-accent-blue))]",
  green: "text-[hsl(var(--portal-success))]",
  purple: "text-[hsl(var(--portal-accent-purple))]",
  amber: "text-[hsl(var(--portal-warning))]",
  red: "text-[hsl(var(--portal-error))]",
  default: "text-[hsl(var(--portal-text-muted))]",
};

export const V3EmptyState: React.FC<V3EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
  accent = "default",
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
          accentClasses[accent]
        )}
      >
        <Icon
          className={cn(iconSizes[variant], accentIconClasses[accent])}
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
