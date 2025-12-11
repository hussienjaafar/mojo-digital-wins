import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { V3TrendIndicator } from "@/components/v3/V3TrendIndicator";
import { V3MetricLabel } from "@/components/v3/V3MetricLabel";
import { V3KPIDrilldownDrawer, type KPIDrilldownData } from "@/components/v3/V3KPIDrilldownDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  useDashboardStore,
  useSelectedKpiKey,
  useHighlightedKpiKey,
  useIsDrilldownOpen,
  type KpiKey,
} from "@/stores/dashboardStore";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ============================================================================
// Types
// ============================================================================

export type ExpandableKpiAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

interface SparklineDataPoint {
  date: string;
  value: number;
}

interface BreakdownItem {
  label: string;
  value: string | number;
  percentage?: number;
}

export interface ExpandableKpiCardProps {
  /** Unique identifier for this KPI - must match KpiKey type */
  kpiKey: KpiKey;
  /** Display label */
  label: string;
  /** Formatted value to display */
  value: string;
  /** Icon to display */
  icon: LucideIcon;
  /** Trend indicator */
  trend?: {
    value: number;
    /** Override: true = green (good), false = red (bad) */
    isPositive?: boolean;
  };
  /** Subtitle/secondary text */
  subtitle?: string;
  /** Accent color */
  accent?: ExpandableKpiAccent;
  /** Sparkline data (last N days) */
  sparklineData?: SparklineDataPoint[] | number[];
  /** Color for sparkline */
  sparklineColor?: string;
  /** Description for drilldown drawer */
  description?: string;
  /** Time series data for drilldown trend chart */
  trendData?: Record<string, unknown>[];
  /** X-axis key for trend data */
  trendXAxisKey?: string;
  /** Breakdown data for drilldown */
  breakdown?: BreakdownItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Styling
// ============================================================================

const accentIconBg: Record<ExpandableKpiAccent, string> = {
  blue: "bg-[hsl(var(--portal-accent-blue))]/10",
  green: "bg-[hsl(var(--portal-success))]/10",
  purple: "bg-[hsl(var(--portal-accent-purple))]/10",
  amber: "bg-[hsl(var(--portal-warning))]/10",
  red: "bg-[hsl(var(--portal-error))]/10",
  default: "bg-[hsl(var(--portal-bg-elevated))]",
};

const accentIconColor: Record<ExpandableKpiAccent, string> = {
  blue: "text-[hsl(var(--portal-accent-blue))]",
  green: "text-[hsl(var(--portal-success))]",
  purple: "text-[hsl(var(--portal-accent-purple))]",
  amber: "text-[hsl(var(--portal-warning))]",
  red: "text-[hsl(var(--portal-error))]",
  default: "text-[hsl(var(--portal-text-muted))]",
};

const accentSparklineColor: Record<ExpandableKpiAccent, string> = {
  blue: "hsl(var(--portal-accent-blue))",
  green: "hsl(var(--portal-success))",
  purple: "hsl(var(--portal-accent-purple))",
  amber: "hsl(var(--portal-warning))",
  red: "hsl(var(--portal-error))",
  default: "hsl(var(--portal-text-muted))",
};

const accentRingColor: Record<ExpandableKpiAccent, string> = {
  blue: "ring-[hsl(var(--portal-accent-blue))]",
  green: "ring-[hsl(var(--portal-success))]",
  purple: "ring-[hsl(var(--portal-accent-purple))]",
  amber: "ring-[hsl(var(--portal-warning))]",
  red: "ring-[hsl(var(--portal-error))]",
  default: "ring-[hsl(var(--portal-border))]",
};

// ============================================================================
// Component
// ============================================================================

export const ExpandableKpiCard: React.FC<ExpandableKpiCardProps> = ({
  kpiKey,
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
  accent = "default",
  sparklineData,
  sparklineColor,
  description,
  trendData,
  trendXAxisKey = "date",
  breakdown,
  isLoading = false,
  className,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const chartColor = sparklineColor || accentSparklineColor[accent];

  // Store state
  const selectedKpiKey = useSelectedKpiKey();
  const highlightedKpiKey = useHighlightedKpiKey();
  const isDrilldownOpen = useIsDrilldownOpen();
  const { setSelectedKpiKey, setHighlightedKpiKey, setDrilldownOpen } = useDashboardStore();

  // Derived state
  const isSelected = selectedKpiKey === kpiKey;
  const isHighlighted = highlightedKpiKey === kpiKey;
  const showDrawer = isDrilldownOpen && isSelected;

  // Transform sparkline data for Recharts
  const chartData = React.useMemo(() => {
    if (!sparklineData || sparklineData.length === 0) return [];

    // Handle both number[] and SparklineDataPoint[] formats
    if (typeof sparklineData[0] === 'number') {
      return (sparklineData as number[]).map((val, index) => ({
        index,
        value: val
      }));
    }

    return (sparklineData as SparklineDataPoint[]).map((point, index) => ({
      index,
      value: point.value,
      date: point.date,
    }));
  }, [sparklineData]);

  // Build drilldown data
  const drilldownData: KPIDrilldownData | null = React.useMemo(() => {
    if (!isSelected) return null;

    return {
      label,
      value,
      icon: Icon,
      trend,
      description,
      timeSeriesData: trendData,
      timeSeriesConfig: trendData ? {
        xAxisKey: trendXAxisKey,
        series: [{
          dataKey: 'value',
          name: label,
          color: chartColor,
          type: 'area',
          areaStyle: { opacity: 0.1 },
        }],
      } : undefined,
      breakdown,
    };
  }, [isSelected, label, value, Icon, trend, description, trendData, trendXAxisKey, breakdown, chartColor]);

  // Event handlers
  const handleClick = React.useCallback(() => {
    if (isSelected) {
      // Toggle off if already selected
      setSelectedKpiKey(null);
      setDrilldownOpen(false);
    } else {
      setSelectedKpiKey(kpiKey);
      setDrilldownOpen(true);
    }
  }, [kpiKey, isSelected, setSelectedKpiKey, setDrilldownOpen]);

  const handleMouseEnter = React.useCallback(() => {
    setHighlightedKpiKey(kpiKey);
  }, [kpiKey, setHighlightedKpiKey]);

  const handleMouseLeave = React.useCallback(() => {
    setHighlightedKpiKey(null);
  }, [setHighlightedKpiKey]);

  const handleDrawerClose = React.useCallback(() => {
    setDrilldownOpen(false);
    setSelectedKpiKey(null);
  }, [setDrilldownOpen, setSelectedKpiKey]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Motion variants
  const motionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
      };

  // Loading state
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
        <Skeleton className="h-8 w-full mb-1" />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-lg p-4 border text-left w-full",
          "bg-[hsl(var(--portal-bg-elevated))]",
          "transition-all duration-200",
          // Default border
          "border-[hsl(var(--portal-border))]",
          // Hover state
          "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
          // Focus state
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          accentRingColor[accent],
          // Highlighted state (from hover on this card OR chart series)
          isHighlighted && !isSelected && [
            "ring-1 ring-opacity-50",
            accentRingColor[accent],
          ],
          // Selected state (click - solid ring)
          isSelected && [
            "ring-2 ring-opacity-100",
            accentRingColor[accent],
            "border-transparent",
          ],
          className
        )}
        aria-label={`${label}: ${value}. Click to view details.`}
        aria-expanded={isSelected}
        {...motionProps}
      >
        {/* Header: Icon + Label + Trend */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <div className={cn("p-1 rounded", accentIconBg[accent])}>
              <Icon
                className={cn("h-4 w-4", accentIconColor[accent])}
                aria-hidden="true"
              />
            </div>
            <V3MetricLabel label={label} showTooltip />
          </div>
          {trend && (
            <V3TrendIndicator
              value={trend.value}
              isPositive={trend.isPositive}
              size="sm"
            />
          )}
        </div>

        {/* Value */}
        <div
          className="text-xl font-bold text-[hsl(var(--portal-text-primary))] leading-tight"
          aria-label={`${label}: ${value}`}
        >
          {value}
        </div>

        {/* Sparkline */}
        {chartData.length > 0 && (
          <motion.div
            className="h-10 mt-2 -mx-1"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={`sparklineGradient-${kpiKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="px-2 py-1 text-xs bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))] rounded shadow-lg">
                          {typeof payload[0].value === 'number'
                            ? payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                            : payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: chartColor }}
                  fill={`url(#sparklineGradient-${kpiKey})`}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <span className="text-xs text-[hsl(var(--portal-text-muted))] truncate block mt-1">
            {subtitle}
          </span>
        )}
      </motion.button>

      {/* Drilldown Drawer */}
      <V3KPIDrilldownDrawer
        open={showDrawer}
        onOpenChange={(open) => {
          if (!open) handleDrawerClose();
        }}
        data={drilldownData}
      />
    </>
  );
};

ExpandableKpiCard.displayName = "ExpandableKpiCard";
