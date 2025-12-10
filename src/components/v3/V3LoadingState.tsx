import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface V3LoadingStateProps {
  /** Type of content being loaded */
  variant: "kpi" | "kpi-grid" | "chart" | "table" | "card" | "channel";
  /** Number of items to show (for grids) */
  count?: number;
  /** Custom height for chart/card variants */
  height?: number;
  /** Additional class names */
  className?: string;
}

export const V3LoadingState: React.FC<V3LoadingStateProps> = ({
  variant,
  count = 4,
  height = 280,
  className,
}) => {
  switch (variant) {
    case "kpi":
      return (
        <div
          className={cn(
            "rounded-lg p-4 border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-elevated))]",
            className
          )}
          aria-busy="true"
          aria-label="Loading metric"
        >
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      );

    case "kpi-grid":
      return (
        <div
          className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}
          aria-busy="true"
          aria-label="Loading metrics"
        >
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg p-4 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-20 mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      );

    case "chart":
      return (
        <div
          className={cn(
            "rounded-xl border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-card))] p-4 sm:p-6",
            className
          )}
          aria-busy="true"
          aria-label="Loading chart"
        >
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="w-full rounded-lg" style={{ height }} />
        </div>
      );

    case "table":
      return (
        <div
          className={cn(
            "rounded-xl border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-card))] p-4 sm:p-6",
            className
          )}
          aria-busy="true"
          aria-label="Loading table"
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      );

    case "card":
      return (
        <div
          className={cn(
            "rounded-xl border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-card))] p-4 sm:p-6",
            className
          )}
          aria-busy="true"
          aria-label="Loading content"
        >
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="w-full" style={{ height }} />
        </div>
      );

    case "channel":
      return (
        <div
          className={cn(
            "rounded-xl border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-card))]",
            className
          )}
          aria-busy="true"
          aria-label="Loading channel metrics"
        >
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};

V3LoadingState.displayName = "V3LoadingState";
