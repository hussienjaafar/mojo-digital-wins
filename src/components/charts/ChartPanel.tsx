import * as React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { cssVar, colors, spacing, radius, transitions } from "@/lib/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

export type ChartPanelStatus = "success" | "warning" | "error" | "info";

export interface ChartPanelTrend {
  value: number;
  isPositive?: boolean;
  label?: string;
}

export interface ChartPanelProps {
  /** Panel title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional icon to show in header */
  icon?: LucideIcon;
  /** Action slot - buttons, dropdowns, etc. */
  actions?: React.ReactNode;
  /** Trend indicator */
  trend?: ChartPanelTrend;
  /** Status badge text */
  status?: {
    text: string;
    variant: ChartPanelStatus;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error | string | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Message to show when no data */
  emptyMessage?: string;
  /** Whether data is empty */
  isEmpty?: boolean;
  /** Chart content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Minimum height for chart area */
  minHeight?: number;
}

// ============================================================================
// Status Badge Mapping
// ============================================================================

const statusStyles: Record<ChartPanelStatus, string> = {
  success: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]",
  warning: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.2)]",
  error: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]",
  info: "bg-[hsl(var(--portal-info)/0.1)] text-[hsl(var(--portal-info))] border-[hsl(var(--portal-info)/0.2)]",
};

// ============================================================================
// Sub-components
// ============================================================================

interface TrendIndicatorProps {
  trend: ChartPanelTrend;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend }) => {
  const { value, isPositive, label } = trend;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const displayPositive = isPositive ?? value > 0;

  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        "transition-colors duration-200 border",
        displayPositive
          ? "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]"
          : "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]"
      )}
      aria-label={`${displayPositive ? "Positive" : "Negative"} trend: ${Math.abs(value)}%${label ? `, ${label}` : ""}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="tabular-nums">{value > 0 ? "+" : ""}{value.toFixed(1)}%</span>
      {label && (
        <span className="text-[hsl(var(--portal-text-muted))] font-normal ml-0.5">
          {label}
        </span>
      )}
    </div>
  );
};

const ChartPanelSkeleton: React.FC<{ minHeight: number }> = ({ minHeight }) => (
  <div className="space-y-4 animate-pulse">
    {/* Header skeleton */}
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    {/* Chart area skeleton */}
    <div
      className="rounded-lg bg-[hsl(var(--portal-bg-elevated)/0.5)]"
      style={{ minHeight }}
    >
      <div className="flex items-center justify-center h-full py-16">
        <div className="space-y-3 text-center">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-3 w-32 mx-auto" />
        </div>
      </div>
    </div>
  </div>
);

interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
  minHeight: number;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, minHeight }) => {
  const message = typeof error === "string" ? error : error.message || "An error occurred";

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg bg-[hsl(var(--portal-error)/0.05)] border border-[hsl(var(--portal-error)/0.2)]"
      style={{ minHeight }}
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-[hsl(var(--portal-error))] mb-3" aria-hidden="true" />
      <p className="text-sm text-[hsl(var(--portal-text-secondary))] text-center max-w-xs mb-4">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
};

interface EmptyStateProps {
  message: string;
  minHeight: number;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, minHeight }) => (
  <div
    className="flex flex-col items-center justify-center rounded-lg bg-[hsl(var(--portal-bg-elevated)/0.3)] border border-dashed border-[hsl(var(--portal-border))]"
    style={{ minHeight }}
  >
    <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center">
      {message}
    </p>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ChartPanel: React.FC<ChartPanelProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  trend,
  status,
  isLoading = false,
  error,
  onRetry,
  emptyMessage = "No data available",
  isEmpty = false,
  children,
  className,
  minHeight = 280,
}) => {
  // Generate a stable ID for accessibility
  const panelId = React.useId();
  const titleId = `${panelId}-title`;
  const descId = `${panelId}-desc`;

  return (
    <section
      className={cn(
        // Base panel styles
        "rounded-xl border overflow-hidden",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border-[hsl(var(--portal-border))]",
        "transition-all duration-200",
        // Hover state
        "hover:border-[hsl(var(--portal-border-hover))]",
        "hover:shadow-sm",
        className
      )}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-[hsl(var(--portal-border)/0.5)]">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Title + Description */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {Icon && (
              <div
                className={cn(
                  "p-2 rounded-lg shrink-0",
                  "bg-[hsl(var(--portal-accent-blue)/0.1)]"
                )}
              >
                <Icon
                  className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]"
                  aria-hidden="true"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3
                id={titleId}
                className="text-base font-semibold text-[hsl(var(--portal-text-primary))] leading-tight truncate"
              >
                {title}
              </h3>
              {description && (
                <p
                  id={descId}
                  className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5 line-clamp-2"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Trend + Status + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {trend && <TrendIndicator trend={trend} />}
            {status && (
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", statusStyles[status.variant])}
              >
                {status.text}
              </Badge>
            )}
            {actions && <div className="ml-1">{actions}</div>}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="p-4">
        {isLoading ? (
          <ChartPanelSkeleton minHeight={minHeight} />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} minHeight={minHeight} />
        ) : isEmpty ? (
          <EmptyState message={emptyMessage} minHeight={minHeight} />
        ) : (
          <div
            className="w-full"
            style={{ minHeight }}
            role="figure"
            aria-label={`${title} chart`}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

ChartPanel.displayName = "ChartPanel";

export default ChartPanel;
