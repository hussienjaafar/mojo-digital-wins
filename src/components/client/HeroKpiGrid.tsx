import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type LucideIcon, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroKpiCard, type HeroKpiAccent, type SparklineDataPoint, type BreakdownItem } from "./HeroKpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { KpiKey } from "@/stores/dashboardStore";

// ============================================================================
// Types
// ============================================================================

export interface HeroKpiData {
  /** Unique identifier for cross-highlighting */
  kpiKey: KpiKey;
  /** Display label */
  label: string;
  /** Formatted primary value */
  value: string;
  /** Icon component */
  icon: LucideIcon;
  /** Trend data */
  trend?: {
    value: number;
    isPositive?: boolean;
    label?: string;
  };
  /** Previous period value */
  previousValue?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Accent color */
  accent?: HeroKpiAccent;
  /** Sparkline data */
  sparklineData?: SparklineDataPoint[] | number[];
  /** Description for tooltip */
  description?: string;

  // ========== Drilldown Props ==========
  /** Time series data for drill-down chart */
  trendData?: Record<string, unknown>[];
  /** X-axis key for trend data (default: "date") */
  trendXAxisKey?: string;
  /** Breakdown items for drill-down table */
  breakdown?: BreakdownItem[];
  /** Whether card is expandable (auto-detected if trendData or breakdown present) */
  expandable?: boolean;
}

export interface HeroKpiGridProps {
  /** Array of KPI data to display */
  data: HeroKpiData[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Retry callback for errors */
  onRetry?: () => void;
  /** Number of columns on mobile (default: 2) */
  mobileColumns?: 1 | 2;
  /** Number of columns on tablet (default: 3) */
  tabletColumns?: 2 | 3 | 4;
  /** Number of columns on desktop (default: 6) */
  desktopColumns?: 3 | 4 | 5 | 6;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
};

// ============================================================================
// Loading Skeleton Grid
// ============================================================================

interface SkeletonGridProps {
  count: number;
  className?: string;
}

const SkeletonGrid: React.FC<SkeletonGridProps> = ({ count, className }) => (
  <div className={cn("grid gap-4", className)}>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="p-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]"
      >
        <div className="flex items-start justify-between mb-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-24 mb-1" />
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-full rounded" />
      </div>
    ))}
  </div>
);

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  message?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message = "No KPI data available" }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center py-12 px-4",
      "rounded-xl border border-dashed",
      "border-[hsl(var(--portal-border))]",
      "bg-[hsl(var(--portal-bg-tertiary)/0.5)]"
    )}
    role="status"
    aria-label={message}
  >
    <div className="p-3 rounded-full bg-[hsl(var(--portal-bg-elevated))] mb-4">
      <AlertCircle
        className="h-6 w-6 text-[hsl(var(--portal-text-muted))]"
        aria-hidden="true"
      />
    </div>
    <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center">
      {message}
    </p>
  </div>
);

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center py-12 px-4",
      "rounded-xl border",
      "border-[hsl(var(--portal-error)/0.3)]",
      "bg-[hsl(var(--portal-error)/0.05)]"
    )}
    role="alert"
    aria-label={`Error: ${message}`}
  >
    <div className="p-3 rounded-full bg-[hsl(var(--portal-error)/0.1)] mb-4">
      <AlertCircle
        className="h-6 w-6 text-[hsl(var(--portal-error))]"
        aria-hidden="true"
      />
    </div>
    <p className="text-sm font-medium text-[hsl(var(--portal-error))] text-center mb-4">
      {message}
    </p>
    {onRetry && (
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="gap-2 border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    )}
  </div>
);

// ============================================================================
// Main Grid Component
// ============================================================================

export const HeroKpiGrid: React.FC<HeroKpiGridProps> = ({
  data,
  isLoading = false,
  error = null,
  onRetry,
  mobileColumns = 2,
  tabletColumns = 3,
  desktopColumns = 6,
  className,
}) => {
  // Build responsive grid classes based on column props
  const gridClasses = cn(
    "grid gap-4",
    // Mobile columns
    mobileColumns === 1 ? "grid-cols-1" : "grid-cols-2",
    // Tablet columns (md breakpoint)
    tabletColumns === 2 && "md:grid-cols-2",
    tabletColumns === 3 && "md:grid-cols-3",
    tabletColumns === 4 && "md:grid-cols-4",
    // Desktop columns (xl breakpoint)
    desktopColumns === 3 && "xl:grid-cols-3",
    desktopColumns === 4 && "xl:grid-cols-4",
    desktopColumns === 5 && "xl:grid-cols-5",
    desktopColumns === 6 && "xl:grid-cols-6",
    className
  );

  // Loading state
  if (isLoading) {
    return (
      <SkeletonGrid
        count={data.length || 6}
        className={gridClasses}
      />
    );
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Empty state
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  // Render grid
  return (
    <motion.div
      className={gridClasses}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      role="region"
      aria-label="Key performance indicators"
    >
      <AnimatePresence mode="popLayout">
        {data.map((kpi) => (
          <motion.div
            key={kpi.kpiKey}
            variants={itemVariants}
            layout
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <HeroKpiCard
              kpiKey={kpi.kpiKey}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              trend={kpi.trend}
              previousValue={kpi.previousValue}
              subtitle={kpi.subtitle}
              accent={kpi.accent}
              sparklineData={kpi.sparklineData}
              description={kpi.description}
              // Drilldown props
              trendData={kpi.trendData}
              trendXAxisKey={kpi.trendXAxisKey ?? "date"}
              breakdown={kpi.breakdown}
              expandable={kpi.expandable ?? Boolean(kpi.trendData || kpi.breakdown)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default HeroKpiGrid;
