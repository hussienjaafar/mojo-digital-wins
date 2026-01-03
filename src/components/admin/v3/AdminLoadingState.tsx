import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminLoadingStateProps {
  /** Loading variant */
  variant?: "page" | "card" | "table" | "stats";
  /** Number of skeleton items */
  count?: number;
  /** Additional class names */
  className?: string;
}

export const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  variant = "page",
  count = 4,
  className,
}) => {
  if (variant === "stats") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-4 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))] animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] p-6 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] overflow-hidden", className)}>
        {/* Table header */}
        <div className="p-4 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]">
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {/* Table rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="p-4 border-b border-[hsl(var(--portal-border))] last:border-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-5 flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: page layout
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
};

AdminLoadingState.displayName = "AdminLoadingState";
