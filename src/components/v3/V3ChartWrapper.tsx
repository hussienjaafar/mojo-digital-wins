import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent } from "./V3Card";

interface V3ChartWrapperProps {
  /** Chart title displayed in header */
  title: string;
  /** Optional icon next to title */
  icon?: LucideIcon;
  /** Accessible label for the chart (required for screen readers) */
  ariaLabel: string;
  /** Optional longer description for screen readers */
  description?: string;
  /** Optional concise data summary for screen readers (e.g., "Latest: $5,000 spend, 120 conversions on Dec 15") */
  dataSummary?: string;
  /** Optional actions to display in header (e.g., filters, toggles) */
  actions?: React.ReactNode;
  /** The chart component to render */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Card accent color */
  accent?: "blue" | "green" | "purple" | "amber" | "red" | "default";
  /** Whether the chart is loading */
  isLoading?: boolean;
  /** Loading skeleton height */
  loadingHeight?: number;
}

export const V3ChartWrapper: React.FC<V3ChartWrapperProps> = ({
  title,
  icon: Icon,
  ariaLabel,
  description,
  dataSummary,
  actions,
  children,
  className,
  accent = "default",
  isLoading = false,
  loadingHeight = 280,
}) => {
  const descriptionId = React.useId();
  const summaryId = React.useId();

  if (isLoading) {
    return (
      <V3Card accent={accent} className={className}>
        <V3CardHeader>
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="h-4 w-4 rounded bg-[hsl(var(--portal-bg-elevated))] animate-pulse" />
            )}
            <div className="h-5 w-32 rounded bg-[hsl(var(--portal-bg-elevated))] animate-pulse" />
          </div>
        </V3CardHeader>
        <V3CardContent>
          <div
            className="w-full rounded-lg bg-[hsl(var(--portal-bg-elevated))] animate-pulse"
            style={{ height: loadingHeight }}
            aria-label="Loading chart"
          />
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card accent={accent} className={className}>
      <V3CardHeader className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <V3CardTitle className="flex items-center gap-2">
            {Icon && (
              <Icon
                className="h-4 w-4 text-[hsl(var(--portal-text-muted))]"
                aria-hidden="true"
              />
            )}
            {title}
          </V3CardTitle>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </V3CardHeader>
      <V3CardContent>
        <div
          role="figure"
          aria-label={ariaLabel}
          aria-describedby={
            [description && descriptionId, dataSummary && summaryId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2",
            "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
            "rounded-lg"
          )}
          tabIndex={0}
        >
          {children}
          {description && (
            <p id={descriptionId} className="sr-only">
              {description}
            </p>
          )}
          {dataSummary && (
            <p id={summaryId} className="sr-only">
              {dataSummary}
            </p>
          )}
        </div>
      </V3CardContent>
    </V3Card>
  );
};

V3ChartWrapper.displayName = "V3ChartWrapper";
