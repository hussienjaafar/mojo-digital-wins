/**
 * V3 Table Cell Components
 * 
 * Premium cell renderers with inline bars, ranks, and percent context.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { Trophy, Medal, Award } from "lucide-react";

export type CellValueType = "number" | "currency" | "percent";

/**
 * Format value based on type
 */
function formatValue(value: number, type: CellValueType, compact = false): string {
  switch (type) {
    case "currency":
      return formatCurrency(value, compact);
    case "percent":
      return formatPercent(value, 1);
    default:
      return formatNumber(value, compact);
  }
}

// ============================================================================
// Inline Bar Cell
// ============================================================================

export interface V3InlineBarCellProps {
  /** The numeric value */
  value: number;
  /** Maximum value for bar scaling */
  maxValue: number;
  /** Value formatting type */
  valueType?: CellValueType;
  /** Bar color variant */
  variant?: "default" | "success" | "warning" | "accent";
  /** Show percent of total */
  percentOfTotal?: number;
  /** Use compact number formatting */
  compact?: boolean;
  /** Additional class */
  className?: string;
}

const barColorMap = {
  default: "hsl(var(--portal-accent-blue))",
  success: "hsl(var(--portal-success))",
  warning: "hsl(var(--portal-warning))",
  accent: "hsl(var(--portal-accent-purple))",
};

export const V3InlineBarCell: React.FC<V3InlineBarCellProps> = ({
  value,
  maxValue,
  valueType = "number",
  variant = "default",
  percentOfTotal,
  compact = false,
  className,
}) => {
  const barWidth = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  const barColor = barColorMap[variant];

  return (
    <div className={cn("relative min-w-[100px]", className)}>
      {/* Background bar */}
      <div
        className="absolute inset-y-0 left-0 rounded-sm opacity-15 transition-all duration-300"
        style={{
          width: `${barWidth}%`,
          backgroundColor: barColor,
        }}
      />
      {/* Value text */}
      <div className="relative flex items-baseline gap-1.5">
        <span className="font-semibold text-[hsl(var(--portal-text-primary))]">
          {formatValue(value, valueType, compact)}
        </span>
        {percentOfTotal !== undefined && (
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
            ({percentOfTotal.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Rank Cell
// ============================================================================

export interface V3RankCellProps {
  /** Rank number (1-indexed) */
  rank: number;
  /** Show icon for top 3 */
  showIcon?: boolean;
  /** Additional class */
  className?: string;
}

export const V3RankCell: React.FC<V3RankCellProps> = ({
  rank,
  showIcon = true,
  className,
}) => {
  const isTop3 = rank <= 3;

  const getIcon = () => {
    if (!showIcon) return null;
    switch (rank) {
      case 1:
        return <Trophy className="h-3.5 w-3.5 text-amber-500" />;
      case 2:
        return <Medal className="h-3.5 w-3.5 text-slate-400" />;
      case 3:
        return <Award className="h-3.5 w-3.5 text-amber-700" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-medium tabular-nums",
        isTop3 ? "text-[hsl(var(--portal-text-primary))]" : "text-[hsl(var(--portal-text-muted))]",
        className
      )}
    >
      {getIcon()}
      <span className={cn(isTop3 && "font-semibold")}>{rank}</span>
    </div>
  );
};

// ============================================================================
// Primary Entity Cell (strong visual hierarchy)
// ============================================================================

export interface V3PrimaryCellProps {
  /** Main label */
  label: string;
  /** Secondary label or metadata */
  sublabel?: string;
  /** Whether this row is in top 3 */
  isTopRank?: boolean;
  /** Additional class */
  className?: string;
}

export const V3PrimaryCell: React.FC<V3PrimaryCellProps> = ({
  label,
  sublabel,
  isTopRank = false,
  className,
}) => {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "truncate text-[hsl(var(--portal-text-primary))]",
          isTopRank ? "font-semibold" : "font-medium"
        )}
      >
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
          {sublabel}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Metric Cell (right-aligned numeric with optional delta)
// ============================================================================

export interface V3MetricCellProps {
  /** The numeric value */
  value: number;
  /** Value formatting type */
  valueType?: CellValueType;
  /** Previous value for delta calculation */
  previousValue?: number;
  /** Use compact number formatting */
  compact?: boolean;
  /** Additional class */
  className?: string;
}

export const V3MetricCell: React.FC<V3MetricCellProps> = ({
  value,
  valueType = "number",
  previousValue,
  compact = false,
  className,
}) => {
  const delta = previousValue !== undefined ? value - previousValue : undefined;
  const deltaPercent =
    previousValue !== undefined && previousValue !== 0
      ? ((value - previousValue) / previousValue) * 100
      : undefined;

  return (
    <div className={cn("text-right", className)}>
      <div className="font-medium text-[hsl(var(--portal-text-primary))] tabular-nums">
        {formatValue(value, valueType, compact)}
      </div>
      {deltaPercent !== undefined && (
        <div
          className={cn(
            "text-xs tabular-nums",
            delta && delta > 0
              ? "text-[hsl(var(--portal-success))]"
              : delta && delta < 0
              ? "text-[hsl(var(--portal-error))]"
              : "text-[hsl(var(--portal-text-muted))]"
          )}
        >
          {delta && delta > 0 ? "+" : ""}
          {deltaPercent.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Status/Badge Cell
// ============================================================================

export interface V3StatusCellProps {
  /** Status text */
  status: string;
  /** Status variant */
  variant?: "default" | "success" | "warning" | "error" | "info";
  /** Additional class */
  className?: string;
}

const statusVariantStyles = {
  default: "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-secondary))]",
  success: "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]",
  warning: "bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))]",
  error: "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]",
  info: "bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]",
};

export const V3StatusCell: React.FC<V3StatusCellProps> = ({
  status,
  variant = "default",
  className,
}) => {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
        statusVariantStyles[variant],
        className
      )}
    >
      {status}
    </span>
  );
};

// ============================================================================
// Compound Cell (combines rank + inline bar)
// ============================================================================

export interface V3RankedMetricCellProps {
  /** Rank number */
  rank: number;
  /** The numeric value */
  value: number;
  /** Maximum value for bar scaling */
  maxValue: number;
  /** Value formatting type */
  valueType?: CellValueType;
  /** Bar color variant */
  variant?: "default" | "success" | "warning" | "accent";
  /** Show percent of total */
  percentOfTotal?: number;
  /** Additional class */
  className?: string;
}

export const V3RankedMetricCell: React.FC<V3RankedMetricCellProps> = ({
  rank,
  value,
  maxValue,
  valueType = "number",
  variant = "default",
  percentOfTotal,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <V3RankCell rank={rank} showIcon={rank <= 3} />
      <V3InlineBarCell
        value={value}
        maxValue={maxValue}
        valueType={valueType}
        variant={variant}
        percentOfTotal={percentOfTotal}
      />
    </div>
  );
};
