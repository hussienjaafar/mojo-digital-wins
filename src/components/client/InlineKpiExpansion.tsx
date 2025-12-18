import * as React from "react";
import { motion } from "framer-motion";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakdownItem } from "./HeroKpiCard";

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
  trendData?: Record<string, unknown>[];
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
// Inline Chart Component (Lazy Loaded)
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

// Sanitize label to create a valid SVG gradient id (lowercase, alphanumeric + dashes only)
const sanitizeGradientId = (label: string): string =>
  `gradient-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const LazyInlineChart = React.lazy(() =>
  import("recharts").then((mod) => ({
    default: function InlineChart({ data, xAxisKey, color, label, valueType = "number" }: InlineChartProps) {
      const gradientId = sanitizeGradientId(label);
      const {
        ResponsiveContainer,
        AreaChart,
        Area,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
      } = mod;

      // Format value based on type
      const formatValue = (value: number): string => {
        if (valueType === "currency") {
          if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
          if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
          return `$${value.toFixed(0)}`;
        }
        if (valueType === "percent") {
          return `${value.toFixed(1)}%`;
        }
        if (valueType === "multiplier") {
          return `${value.toFixed(1)}x`;
        }
        if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toFixed(0);
      };

      // Format data for chart
      const chartData = data.map((d) => ({
        ...d,
        [xAxisKey]: d[xAxisKey],
        value: d.value as number,
      }));

      return (
        <div
          className="h-48 w-full"
          role="figure"
          aria-label={`${label} trend chart`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--portal-border))"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--portal-border))" }}
                dy={8}
              />
              <YAxis
                tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(value) =>
                  typeof value === "number" ? formatValue(value) : value
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--portal-bg-tertiary))",
                  border: "1px solid hsl(var(--portal-border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
                labelStyle={{
                  color: "hsl(var(--portal-text-primary))",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
                itemStyle={{
                  color: "hsl(var(--portal-text-secondary))",
                }}
                formatter={(value: number) => [formatValue(value), label]}
                cursor={{
                  stroke: color,
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: "hsl(var(--portal-bg-secondary))",
                  strokeWidth: 2,
                  // Enhanced glow for dark mode visibility
                  style: {
                    filter: "drop-shadow(0 0 6px currentColor)",
                  },
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    },
  }))
);

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
// Breakdown Table Component
// ============================================================================

interface BreakdownTableProps {
  items: BreakdownItem[];
}

const BreakdownTable: React.FC<BreakdownTableProps> = ({ items }) => (
  <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-[hsl(var(--portal-bg-elevated))]">
          <th className="px-4 py-2.5 text-left font-medium text-[hsl(var(--portal-text-muted))]">
            Metric
          </th>
          <th className="px-4 py-2.5 text-right font-medium text-[hsl(var(--portal-text-muted))]">
            Value
          </th>
          {items.some((i) => i.percentage !== undefined) && (
            <th className="px-4 py-2.5 text-right font-medium text-[hsl(var(--portal-text-muted))] w-20">
              %
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-[hsl(var(--portal-border))]">
        {items.map((item, index) => (
          <tr
            key={index}
            className="hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
          >
            <td className="px-4 py-2.5 text-[hsl(var(--portal-text-primary))]">
              {item.label}
            </td>
            <td className="px-4 py-2.5 text-right font-medium text-[hsl(var(--portal-text-primary))] tabular-nums">
              {item.value}
            </td>
            {item.percentage !== undefined && (
              <td className="px-4 py-2.5 text-right text-[hsl(var(--portal-text-muted))] tabular-nums">
                {item.percentage.toFixed(1)}%
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
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
              <React.Suspense fallback={<ChartSkeleton />}>
                <LazyInlineChart
                  data={trendData}
                  xAxisKey={trendXAxisKey}
                  color={chartColor}
                  label={label}
                  valueType={valueType}
                />
              </React.Suspense>
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
