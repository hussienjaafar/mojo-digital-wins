import * as React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
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
  type KpiKey,
} from "@/stores/dashboardStore";

// ============================================================================
// Types
// ============================================================================

export type HeroKpiAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

export interface SparklineDataPoint {
  date: string;
  value: number;
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
                  r: 3,
                  fill: color,
                  stroke: "hsl(var(--portal-bg-secondary))",
                  strokeWidth: 2,
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
}) => {
  const setSelectedKpi = useDashboardStore((s) => s.setSelectedKpiKey);
  const setHighlightedKpi = useDashboardStore((s) => s.setHighlightedKpiKey);
  const selectedKpiKey = useSelectedKpiKey();
  const highlightedKpiKey = useHighlightedKpiKey();

  const isSelected = selectedKpiKey === kpiKey;
  const isHighlighted = highlightedKpiKey === kpiKey;
  const config = accentConfig[accent];

  const handleClick = () => {
    setSelectedKpi(isSelected ? null : kpiKey);
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
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
      className={cn(
        // Base styles using tokens
        "relative p-4 rounded-xl border cursor-pointer",
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
      aria-label={`${label}: ${value}${trend ? `, ${trend.value > 0 ? "up" : "down"} ${Math.abs(trend.value)}%` : ""}`}
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

      {/* Subtitle / Previous Value */}
      {(subtitle || previousValue) && (
        <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-3 truncate">
          {subtitle || (previousValue && `Previous: ${previousValue}`)}
        </p>
      )}

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
    </motion.article>
  );

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

export default HeroKpiCard;
