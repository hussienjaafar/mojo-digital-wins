import * as React from "react";
import { motion } from "framer-motion";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakdownItem } from "./HeroKpiCard";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";

// ============================================================================
// Types
// ============================================================================

export type ValueType = "currency" | "percent" | "number" | "multiplier";

export interface InlineKpiExpansionProps {
  /** KPI label */
  label: string;
  /** Primary value */
  value: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Trend data */
  trend?: {
    value: number;
    isPositive?: boolean;
    label?: string;
  };
  /** Description text */
  description?: string;
  /** Time series data for chart */
  trendData?: { date: string; value: number }[] | Record<string, unknown>[];
  /** X-axis key for trend data */
  trendXAxisKey?: string;
  /** Breakdown items */
  breakdown?: BreakdownItem[];
  /** Accent color */
  accent?: "blue" | "green" | "purple" | "amber" | "red" | "default";
  /** Value type for chart formatting */
  valueType?: ValueType;
  /** Close handler */
  onClose: () => void;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================================
// Animation Variants
// ============================================================================

const expansionVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
      opacity: { duration: 0.2 },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
      opacity: { duration: 0.3, delay: 0.1 },
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: 0.15 },
  },
};

// ============================================================================
// Accent Color Mapping
// ============================================================================

const accentColors: Record<string, string> = {
  blue: "hsl(var(--portal-accent-blue))",
  green: "hsl(var(--portal-success))",
  purple: "hsl(var(--portal-accent-purple))",
  amber: "hsl(var(--portal-warning))",
  red: "hsl(var(--portal-error))",
  default: "hsl(var(--portal-accent-blue))",
};

// ============================================================================
// Inline Chart Component (ECharts-based)
// ============================================================================

interface InlineChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  color: string;
  label: string;
  valueType?: ValueType;
}

const ChartSkeleton: React.FC = () => (
  <div className="h-48 w-full flex items-center justify-center">
    <Skeleton className="w-full h-full rounded-lg" />
  </div>
);

const InlineChart: React.FC<InlineChartProps> = ({ data, xAxisKey, color, label, valueType = "number" }) => {
  // Map valueType to ECharts format type
  const chartValueType = valueType === "multiplier" ? "number" : valueType;

  const series: LineSeriesConfig[] = React.useMemo(() => [{
    dataKey: "value",
    name: label,
    color,
    type: "area",
    areaStyle: { opacity: 0.15 },
    valueType: chartValueType as "number" | "currency" | "percent",
  }], [label, color, chartValueType]);

  return (
    <div
      className="h-48 w-full"
      role="figure"
      aria-label={`${label} trend chart`}
    >
      <EChartsLineChart
        data={data}
        xAxisKey={xAxisKey}
        series={series}
        height={192}
        valueType={chartValueType as "number" | "currency" | "percent"}
      />
    </div>
  );
};

// ============================================================================
// Trend Badge Component
// ============================================================================

interface TrendBadgeProps {
  value: number;
  isPositive?: boolean;
  label?: string;
  size?: "sm" | "md";
}

const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  isPositive,
  label,
  size = "md",
}) => {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const displayPositive = isPositive ?? value > 0;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        displayPositive
          ? "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]"
          : "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]"
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} aria-hidden="true" />
      <span>{Math.abs(value)}%</span>
      {label && (
        <span className="text-[hsl(var(--portal-text-muted))] font-normal ml-0.5">
          {label}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Breakdown Table Component (uses shared PortalBreakdownTable)
// ============================================================================

import { PortalBreakdownTable } from "@/components/v3/PortalTable";

interface BreakdownTableProps {
  items: BreakdownItem[];
}

const BreakdownTable: React.FC<BreakdownTableProps> = ({ items }) => (
  <PortalBreakdownTable
    items={items.map((item) => ({
      label: item.label,
      value: item.value,
      percentage: item.percentage,
    }))}
  />
);

// ============================================================================
// Main Component
// ============================================================================

export const InlineKpiExpansion: React.FC<InlineKpiExpansionProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  description,
  trendData,
  trendXAxisKey = "date",
  breakdown,
  accent = "blue",
  valueType = "currency",
  onClose,
  isLoading = false,
}) => {
  const chartColor = accentColors[accent] || accentColors.default;

  // Handle Escape key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (isLoading) {
    return (
      <motion.div
        variants={expansionVariants}
        initial="collapsed"
        animate="expanded"
        exit="collapsed"
        className="overflow-hidden"
      >
        <div className="pt-4 border-t border-[hsl(var(--portal-border))]">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <ChartSkeleton />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={expansionVariants}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      className="overflow-hidden"
    >
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="pt-4 border-t border-[hsl(var(--portal-border))]"
      >
        {/* Header with close button */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {Icon && (
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    accent === "green" && "bg-[hsl(var(--portal-success)/0.1)]",
                    accent === "purple" && "bg-[hsl(var(--portal-accent-purple)/0.1)]",
                    accent === "amber" && "bg-[hsl(var(--portal-warning)/0.1)]",
                    accent === "red" && "bg-[hsl(var(--portal-error)/0.1)]",
                    accent === "blue" && "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                    accent === "default" && "bg-[hsl(var(--portal-bg-elevated))]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      accent === "green" && "text-[hsl(var(--portal-success))]",
                      accent === "purple" && "text-[hsl(var(--portal-accent-purple))]",
                      accent === "amber" && "text-[hsl(var(--portal-warning))]",
                      accent === "red" && "text-[hsl(var(--portal-error))]",
                      accent === "blue" && "text-[hsl(var(--portal-accent-blue))]",
                      accent === "default" && "text-[hsl(var(--portal-text-muted))]"
                    )}
                    aria-hidden="true"
                  />
                </div>
              )}
              <div>
                <h4 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                  {label} Details
                </h4>
                {description && (
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Hero value + trend */}
            <div className="text-right">
              <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                {value}
              </p>
              {trend && (
                <TrendBadge
                  value={trend.value}
                  isPositive={trend.isPositive}
                  label={trend.label}
                  size="sm"
                />
              )}
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chart Section */}
        {trendData && trendData.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-2">
              Trend Over Time
            </h5>
            <div className="rounded-lg border border-[hsl(var(--portal-border))] p-3 bg-[hsl(var(--portal-bg-elevated))]">
              <InlineChart
                data={trendData}
                xAxisKey={trendXAxisKey}
                color={chartColor}
                  label={label}
                valueType={valueType}
              />
            </div>
          </div>
        )}

        {/* Breakdown Table */}
        {breakdown && breakdown.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-2">
              Breakdown
            </h5>
            <BreakdownTable items={breakdown} />
          </div>
        )}

        {/* Empty state */}
        {!trendData?.length && !breakdown?.length && (
          <div className="py-8 text-center text-[hsl(var(--portal-text-muted))]">
            <p>No detailed data available for this metric.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

InlineKpiExpansion.displayName = "InlineKpiExpansion";

export default InlineKpiExpansion;
