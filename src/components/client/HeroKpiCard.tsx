import * as React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { cssVar, colors, spacing, radius } from "@/lib/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDashboardStore,
  useSelectedKpiKey,
  useHighlightedKpiKey,
  useIsDrilldownOpen,
  type KpiKey,
} from "@/stores/dashboardStore";
import { V3KPIDrilldownDrawer, type KPIDrilldownData } from "@/components/v3/V3KPIDrilldownDrawer";
import { InlineKpiExpansion, type ValueType } from "./InlineKpiExpansion";
import type { LineSeriesConfig } from "@/components/charts/echarts";

// KPI to ValueType mapping for chart formatting
const KPI_VALUE_TYPE_MAP: Partial<Record<KpiKey, ValueType>> = {
  netRevenue: "currency",
  netRoi: "number", // ROI multiplier like 2.5x
  refundRate: "percent",
  recurringHealth: "currency",
  attributionQuality: "percent",
  uniqueDonors: "number",
};

// ============================================================================
// Types
// ============================================================================

export type HeroKpiAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

export interface SparklineDataPoint {
  date: string;
  value: number;
}

/** Breakdown item for drilldown table */
export interface BreakdownItem {
  label: string;
  value: string | number;
  percentage?: number;
}

export interface HeroKpiCardProps {
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
  /** Previous period value for context */
  previousValue?: string;
  /** Subtitle or context text */
  subtitle?: string;
  /** Accent color theme */
  accent?: HeroKpiAccent;
  /** Sparkline data points */
  sparklineData?: SparklineDataPoint[] | number[];
  /** Description shown in tooltip */
  description?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;

  // ========== Drilldown Props ==========
  /** Time series data for drill-down chart */
  trendData?: Record<string, unknown>[];
  /** X-axis key for trend data (default: "date") */
  trendXAxisKey?: string;
  /** Breakdown items for drill-down table */
  breakdown?: BreakdownItem[];
  /** Whether card is expandable (auto-detected if trendData or breakdown present) */
  expandable?: boolean;
  /** Expansion mode: "drawer" opens side drawer, "inline" expands within grid */
  expansionMode?: "drawer" | "inline";
  /** Callback when inline expansion state changes */
  onInlineExpandChange?: (expanded: boolean) => void;
}

// ============================================================================
// Token-based Accent Mappings
// ============================================================================

const accentConfig: Record<HeroKpiAccent, {
  iconBg: string;
  iconColor: string;
  sparkline: string;
  border: string;
  glow: string;
}> = {
  blue: {
    iconBg: `bg-[${cssVar(colors.accent.blue, 0.1)}]`,
    iconColor: `text-[${cssVar(colors.accent.blue)}]`,
    sparkline: `hsl(var(--${colors.accent.blue}))`,
    border: `border-[${cssVar(colors.accent.blue, 0.3)}]`,
    glow: `shadow-[0_0_20px_${cssVar(colors.accent.blue, 0.15)}]`,
  },
  green: {
    iconBg: `bg-[${cssVar(colors.status.success, 0.1)}]`,
    iconColor: `text-[${cssVar(colors.status.success)}]`,
    sparkline: `hsl(var(--${colors.status.success}))`,
    border: `border-[${cssVar(colors.status.success, 0.3)}]`,
    glow: `shadow-[0_0_20px_${cssVar(colors.status.success, 0.15)}]`,
  },
  purple: {
    iconBg: `bg-[${cssVar(colors.accent.purple, 0.1)}]`,
    iconColor: `text-[${cssVar(colors.accent.purple)}]`,
    sparkline: `hsl(var(--${colors.accent.purple}))`,
    border: `border-[${cssVar(colors.accent.purple, 0.3)}]`,
    glow: `shadow-[0_0_20px_${cssVar(colors.accent.purple, 0.15)}]`,
  },
  amber: {
    iconBg: `bg-[${cssVar(colors.status.warning, 0.1)}]`,
    iconColor: `text-[${cssVar(colors.status.warning)}]`,
    sparkline: `hsl(var(--${colors.status.warning}))`,
    border: `border-[${cssVar(colors.status.warning, 0.3)}]`,
    glow: `shadow-[0_0_20px_${cssVar(colors.status.warning, 0.15)}]`,
  },
  red: {
    iconBg: `bg-[${cssVar(colors.status.error, 0.1)}]`,
    iconColor: `text-[${cssVar(colors.status.error)}]`,
    sparkline: `hsl(var(--${colors.status.error}))`,
    border: `border-[${cssVar(colors.status.error, 0.3)}]`,
    glow: `shadow-[0_0_20px_${cssVar(colors.status.error, 0.15)}]`,
  },
  default: {
    iconBg: `bg-[${cssVar(colors.bg.elevated)}]`,
    iconColor: `text-[${cssVar(colors.text.secondary)}]`,
    sparkline: `hsl(var(--${colors.text.muted}))`,
    border: `border-[${cssVar(colors.border.default)}]`,
    glow: "",
  },
};

// ============================================================================
// Sparkline Component (Lazy Loaded)
// ============================================================================

interface SparklineProps {
  data: SparklineDataPoint[] | number[];
  color: string;
  ariaLabel: string;
}

/**
 * Skeleton shown while Recharts loads
 */
const SparklineSkeleton: React.FC<{ ariaLabel: string }> = ({ ariaLabel }) => (
  <div
    className="h-10 w-full flex items-center justify-center"
    role="figure"
    aria-label={ariaLabel}
  >
    <Skeleton className="w-full h-8 rounded" />
  </div>
);

/**
 * Lazy-loaded Sparkline inner component
 * Recharts is only imported when this component renders
 */
const LazySparklineInner = React.lazy(() =>
  import("recharts").then((mod) => ({
    default: function SparklineInner({
      data,
      color,
      ariaLabel,
    }: SparklineProps & { data: SparklineDataPoint[] }) {
      const { ResponsiveContainer, LineChart, Line, Tooltip } = mod;

      return (
        <div className="h-10 w-full" role="figure" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as SparklineDataPoint;
                  return (
                    <div className="rounded-md px-2 py-1 text-xs bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))] shadow-lg">
                      <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {typeof point.value === "number"
                          ? point.value.toLocaleString()
                          : point.value}
                      </span>
                      <span className="text-[hsl(var(--portal-text-muted))] ml-1">
                        {point.date}
                      </span>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: color,
                  stroke: "hsl(var(--portal-bg-secondary))",
                  strokeWidth: 2,
                  // CSS filter for glow effect in dark mode
                  style: {
                    filter: "drop-shadow(0 0 4px currentColor)",
                  },
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    },
  }))
);

/**
 * Sparkline wrapper with lazy loading and Suspense
 */
const Sparkline: React.FC<SparklineProps> = ({ data, color, ariaLabel }) => {
  const normalizedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    if (typeof data[0] === "number") {
      return (data as number[]).map((value, index) => ({
        date: `Day ${index + 1}`,
        value,
      }));
    }
    return data as SparklineDataPoint[];
  }, [data]);

  if (normalizedData.length < 2) return null;

  return (
    <React.Suspense fallback={<SparklineSkeleton ariaLabel={ariaLabel} />}>
      <LazySparklineInner
        data={normalizedData}
        color={color}
        ariaLabel={ariaLabel}
      />
    </React.Suspense>
  );
};

// ============================================================================
// Trend Indicator Component
// ============================================================================

interface TrendBadgeProps {
  value: number;
  isPositive?: boolean;
  label?: string;
}

const TrendBadge: React.FC<TrendBadgeProps> = ({ value, isPositive, label }) => {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const displayPositive = isPositive ?? value > 0;

  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        "transition-colors duration-200",
        displayPositive
          ? "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]"
          : "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]"
      )}
      aria-label={`${displayPositive ? "Positive" : "Negative"} trend: ${Math.abs(value)}%${label ? `, ${label}` : ""}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
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
// Loading Skeleton
// ============================================================================

const HeroKpiCardSkeleton: React.FC = () => (
  <div className="p-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
    <div className="flex items-start justify-between mb-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-8 w-24 mb-1" />
    <Skeleton className="h-4 w-32 mb-3" />
    <Skeleton className="h-10 w-full rounded" />
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const HeroKpiCard: React.FC<HeroKpiCardProps> = ({
  kpiKey,
  label,
  value,
  icon: Icon,
  trend,
  previousValue,
  subtitle,
  accent = "default",
  sparklineData,
  description,
  isLoading,
  onClick,
  className,
  // Drilldown props
  trendData,
  trendXAxisKey = "date",
  breakdown,
  expandable,
  expansionMode = "drawer",
  onInlineExpandChange,
}) => {
  const cardRef = React.useRef<HTMLElement>(null);
  // Local state for inline expansion mode
  const [isInlineExpanded, setIsInlineExpanded] = React.useState(false);
  const setSelectedKpi = useDashboardStore((s) => s.setSelectedKpiKey);
  const setHighlightedKpi = useDashboardStore((s) => s.setHighlightedKpiKey);
  const setDrilldownOpen = useDashboardStore((s) => s.setDrilldownOpen);
  const selectedKpiKey = useSelectedKpiKey();
  const highlightedKpiKey = useHighlightedKpiKey();
  const isDrilldownOpen = useIsDrilldownOpen();

  const isSelected = selectedKpiKey === kpiKey;
  const isHighlighted = highlightedKpiKey === kpiKey;
  const config = accentConfig[accent];

  // Auto-detect if expandable based on drilldown data
  const isExpandable = expandable ?? Boolean(trendData || breakdown);
  const hasDrilldownData = Boolean(trendData || breakdown);

  // Build drilldown data for the drawer
  const drilldownData = React.useMemo((): KPIDrilldownData | null => {
    if (!hasDrilldownData) return null;

    // Determine series color based on accent
    const seriesColor =
      accent === "green" ? "hsl(var(--portal-success))" :
      accent === "purple" ? "hsl(var(--portal-accent-purple))" :
      accent === "amber" ? "hsl(var(--portal-warning))" :
      accent === "red" ? "hsl(var(--portal-error))" :
      "hsl(var(--portal-accent-blue))";

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
          dataKey: "value",
          name: label,
          color: seriesColor,
          type: "area",
          areaStyle: { opacity: 0.1 },
        }] as LineSeriesConfig[],
      } : undefined,
      breakdown,
    };
  }, [label, value, Icon, trend, description, trendData, trendXAxisKey, breakdown, accent, hasDrilldownData]);

  const handleClick = () => {
    if (isExpandable && hasDrilldownData) {
      if (expansionMode === "inline") {
        // Inline mode: toggle local expansion state
        const newExpanded = !isInlineExpanded;
        setIsInlineExpanded(newExpanded);
        if (onInlineExpandChange) onInlineExpandChange(newExpanded);
        // Still update selected state for visual feedback
        setSelectedKpi(newExpanded ? kpiKey : null);
      } else {
        // Drawer mode: use global drilldown state
        if (isSelected && isDrilldownOpen) {
          // Close drawer if already selected and open
          setDrilldownOpen(false);
          setSelectedKpi(null);
        } else {
          // Open drawer and select this KPI
          setSelectedKpi(kpiKey);
          setDrilldownOpen(true);
        }
      }
    } else {
      // Toggle selection for non-expandable cards (cross-highlighting)
      setSelectedKpi(isSelected ? null : kpiKey);
    }
    if (onClick) onClick();
  };

  // Close inline expansion handler
  const handleInlineClose = () => {
    setIsInlineExpanded(false);
    if (onInlineExpandChange) onInlineExpandChange(false);
    setSelectedKpi(null);
    // Restore focus to card
    cardRef.current?.focus();
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrilldownOpen(open);
    if (!open) {
      setSelectedKpi(null);
      // Restore focus to the card after drawer closes
      cardRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    } else if (e.key === "Escape" && expansionMode === "inline" && isInlineExpanded) {
      e.preventDefault();
      handleInlineClose();
    }
  };

  const handleMouseEnter = () => {
    setHighlightedKpi(kpiKey);
  };

  const handleMouseLeave = () => {
    setHighlightedKpi(null);
  };

  if (isLoading) {
    return <HeroKpiCardSkeleton />;
  }

  const cardContent = (
    <motion.article
      ref={cardRef}
      className={cn(
        // Base styles using tokens
        "group relative p-4 rounded-xl border cursor-pointer",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border-[hsl(var(--portal-border))]",
        // Transitions
        "transition-all duration-200",
        // Hover state
        "hover:bg-[hsl(var(--portal-bg-hover))]",
        "hover:border-[hsl(var(--portal-border-hover))]",
        "hover:shadow-md",
        // Focus state
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[hsl(var(--portal-accent-blue))]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-primary))]",
        // Selected/Highlighted states
        isSelected && [
          "border-[hsl(var(--portal-accent-blue))]",
          "bg-[hsl(var(--portal-accent-blue)/0.05)]",
          "shadow-[0_0_20px_hsl(var(--portal-accent-blue)/0.15)]",
        ],
        isHighlighted && !isSelected && [
          "border-[hsl(var(--portal-accent-blue)/0.5)]",
          "bg-[hsl(var(--portal-accent-blue)/0.02)]",
        ],
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-expanded={isExpandable ? (expansionMode === "inline" ? isInlineExpanded : (isSelected && isDrilldownOpen)) : undefined}
      aria-label={`${label}: ${value}${trend ? `, ${trend.value > 0 ? "up" : "down"} ${Math.abs(trend.value)}%` : ""}${isExpandable ? ", click to expand details" : ""}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header: Icon + Trend */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "p-2.5 rounded-lg transition-transform duration-200",
            "bg-[hsl(var(--portal-accent-blue)/0.1)]",
            accent === "green" && "bg-[hsl(var(--portal-success)/0.1)]",
            accent === "purple" && "bg-[hsl(var(--portal-accent-purple)/0.1)]",
            accent === "amber" && "bg-[hsl(var(--portal-warning)/0.1)]",
            accent === "red" && "bg-[hsl(var(--portal-error)/0.1)]",
            accent === "default" && "bg-[hsl(var(--portal-bg-elevated))]"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              "text-[hsl(var(--portal-accent-blue))]",
              accent === "green" && "text-[hsl(var(--portal-success))]",
              accent === "purple" && "text-[hsl(var(--portal-accent-purple))]",
              accent === "amber" && "text-[hsl(var(--portal-warning))]",
              accent === "red" && "text-[hsl(var(--portal-error))]",
              accent === "default" && "text-[hsl(var(--portal-text-muted))]"
            )}
            aria-hidden="true"
          />
        </div>

        {trend && (
          <TrendBadge
            value={trend.value}
            isPositive={trend.isPositive}
            label={trend.label}
          />
        )}
      </div>

      {/* Primary Value */}
      <div className="mb-1">
        <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tracking-tight tabular-nums">
          {value}
        </p>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-1">
        {label}
      </p>

      {/* Subtitle / Previous Value - Always render for consistent card height */}
      <p className={cn(
        "text-xs text-[hsl(var(--portal-text-muted))] mb-3 truncate",
        "min-h-[var(--portal-space-md)]" // Token-based min-height (16px) for alignment
      )}>
        {subtitle || (previousValue ? `Previous: ${previousValue}` : "—")}
      </p>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-auto pt-2 border-t border-[hsl(var(--portal-border)/0.5)]">
          <Sparkline
            data={sparklineData}
            color={
              accent === "green" ? "hsl(var(--portal-success))" :
              accent === "purple" ? "hsl(var(--portal-accent-purple))" :
              accent === "amber" ? "hsl(var(--portal-warning))" :
              accent === "red" ? "hsl(var(--portal-error))" :
              "hsl(var(--portal-accent-blue))"
            }
            ariaLabel={`${label} trend over time`}
          />
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-0.5 bg-[hsl(var(--portal-accent-blue))] rounded-b-xl"
          layoutId="kpi-selection-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {/* Expand affordance (chevron) - shows on hover for expandable cards */}
      {isExpandable && (
        <motion.div
          className={cn(
            "absolute top-3 right-3 transition-opacity",
            // Show chevron when expanded (inline) or on hover when collapsed
            (expansionMode === "inline" && isInlineExpanded) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: (expansionMode === "inline" && isInlineExpanded) ? 1 : undefined }}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[hsl(var(--portal-text-muted))]",
              "transition-transform duration-200",
              // Rotate when expanded (either inline or drawer mode)
              ((expansionMode === "inline" && isInlineExpanded) || (expansionMode === "drawer" && isSelected && isDrilldownOpen)) && "rotate-180"
            )}
            aria-hidden="true"
          />
        </motion.div>
      )}

      {/* Inline Expansion Content */}
      <AnimatePresence>
        {expansionMode === "inline" && isInlineExpanded && hasDrilldownData && (
          <InlineKpiExpansion
            label={label}
            value={value}
            icon={Icon}
            trend={trend}
            description={description}
            trendData={trendData}
            trendXAxisKey={trendXAxisKey}
            breakdown={breakdown}
            accent={accent}
            valueType={KPI_VALUE_TYPE_MAP[kpiKey] || "currency"}
            onClose={handleInlineClose}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );

  // Render with tooltip and/or drawer
  const renderContent = () => {
    // Wrap with tooltip if description provided
    if (description) {
      return (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs text-sm bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
            >
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return cardContent;
  };

  return (
    <>
      {renderContent()}

      {/* Drilldown Drawer - only render in drawer mode */}
      {expansionMode === "drawer" && isExpandable && drilldownData && (
        <V3KPIDrilldownDrawer
          open={isSelected && isDrilldownOpen}
          onOpenChange={handleDrawerOpenChange}
          data={drilldownData}
        />
      )}
    </>
  );
};

export default HeroKpiCard;
