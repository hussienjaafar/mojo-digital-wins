import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3TrendIndicator } from "./V3TrendIndicator";
import { Skeleton } from "@/components/ui/skeleton";

export type V3KPIAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

interface V3KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    /** Override: true = green (good), false = red (bad) */
    isPositive?: boolean;
  };
  subtitle?: string;
  accent?: V3KPIAccent;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

const accentIconBg: Record<V3KPIAccent, string> = {
  blue: "bg-[hsl(var(--portal-accent-blue))]/10",
  green: "bg-[hsl(var(--portal-success))]/10",
  purple: "bg-[hsl(var(--portal-accent-purple))]/10",
  amber: "bg-[hsl(var(--portal-warning))]/10",
  red: "bg-[hsl(var(--portal-error))]/10",
  default: "bg-[hsl(var(--portal-bg-elevated))]",
};

const accentIconColor: Record<V3KPIAccent, string> = {
  blue: "text-[hsl(var(--portal-accent-blue))]",
  green: "text-[hsl(var(--portal-success))]",
  purple: "text-[hsl(var(--portal-accent-purple))]",
  amber: "text-[hsl(var(--portal-warning))]",
  red: "text-[hsl(var(--portal-error))]",
  default: "text-[hsl(var(--portal-text-muted))]",
};

export const V3KPICard: React.FC<V3KPICardProps> = ({
  icon: Icon,
  label,
  value,
  trend,
  subtitle,
  accent = "default",
  isLoading = false,
  className,
  onClick,
}) => {
  const isInteractive = !!onClick;

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg p-4 border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-elevated))]",
          className
        )}
        aria-busy="true"
        aria-label={`Loading ${label}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-7 w-20 mb-1" />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("p-1 rounded", accentIconBg[accent])}>
          <Icon
            className={cn("h-4 w-4", accentIconColor[accent])}
            aria-hidden="true"
          />
        </div>
        <span className="text-xs text-[hsl(var(--portal-text-secondary))] uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <div
        className="text-xl font-bold text-[hsl(var(--portal-text-primary))] leading-tight"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {trend && (
          <V3TrendIndicator
            value={trend.value}
            isPositive={trend.isPositive}
          />
        )}
        {subtitle && (
          <span className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
            {subtitle}
          </span>
        )}
      </div>
    </>
  );

  const baseClasses = cn(
    "rounded-lg p-4 border border-[hsl(var(--portal-border))]",
    "bg-[hsl(var(--portal-bg-elevated))]",
    "transition-all duration-200",
    className
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClasses,
          "text-left w-full",
          "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2"
        )}
        aria-label={`${label}: ${value}. Click for details.`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClasses} role="status" aria-live="polite">
      {content}
    </div>
  );
};

V3KPICard.displayName = "V3KPICard";
