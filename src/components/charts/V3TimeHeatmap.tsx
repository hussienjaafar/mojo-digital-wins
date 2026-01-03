/**
 * V3TimeHeatmap - Premium Time-of-Day × Day-of-Week Heatmap
 * 
 * A world-class ECharts heatmap for visualizing temporal patterns.
 * Supports revenue, count, and average donation metrics with interactive
 * cell selection, accessible tooltips, and export functionality.
 */

import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { cn } from "@/lib/utils";
import { cssVar, colors } from "@/lib/design-tokens";
import { formatCurrency, formatNumber, formatPercent, type ValueType } from "@/lib/chart-formatters";
import {
  type HeatmapDataPoint,
  type HeatmapMetric,
  type RankedCell,
  type HeatmapStats,
  DAY_LABELS_SHORT,
  HOUR_LABELS_SHORT,
  formatTimeSlot,
  formatTimeSlotShort,
  toEChartsData,
  isSameCell,
  calculateHeatmapStats,
  getCellRank,
  getMetricLabel,
  TOTAL_TIME_SLOTS,
} from "@/lib/heatmap-utils";
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award, X, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface V3TimeHeatmapProps {
  /** Normalized 7×24 grid data */
  data: HeatmapDataPoint[];
  /** Metric being displayed */
  metric?: HeatmapMetric;
  /** Value type for formatting */
  valueType?: ValueType;
  /** Label for the metric */
  valueLabel?: string;
  /** Chart height */
  height?: number | string;
  /** Additional class names */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Currently selected cell */
  selectedCell?: { dayOfWeek: number; hour: number } | null;
  /** Callback when cell is clicked */
  onCellSelect?: (cell: HeatmapDataPoint | null) => void;
  /** Color scheme */
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
  /** Scale mode for color mapping */
  scaleMode?: 'linear' | 'log' | 'quantized';
  /** Compact mode for mobile */
  compact?: boolean;
  /** Total value for percent-of-total calculations */
  totalValue?: number;
}

// Resolve CSS variable to concrete RGB color for ECharts
const resolveToRgb = (tokenName: string, alpha?: number): string => {
  if (typeof window === "undefined") return cssVar(tokenName, alpha);

  const themeRoot = document.querySelector('.portal-theme') ?? document.documentElement;
  const temp = document.createElement('div');
  temp.style.position = 'absolute';
  temp.style.visibility = 'hidden';
  temp.style.color = alpha !== undefined 
    ? `hsl(var(--${tokenName}) / ${alpha})`
    : `hsl(var(--${tokenName}))`;
  
  themeRoot.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  themeRoot.removeChild(temp);

  return computed || cssVar(tokenName, alpha);
};

export const V3TimeHeatmap: React.FC<V3TimeHeatmapProps> = ({
  data,
  metric = 'revenue',
  valueType = 'currency',
  valueLabel = 'Net Revenue',
  height = 300,
  className,
  isLoading = false,
  selectedCell = null,
  onCellSelect,
  colorScheme = 'blue',
  scaleMode = 'linear',
  compact = false,
}) => {
  // Calculate totals and stats
  const stats = React.useMemo<HeatmapStats>(() => {
    return calculateHeatmapStats(data, 5);
  }, [data]);

  // Format value based on type
  const formatValue = React.useCallback((value: number, compact = false): string => {
    switch (valueType) {
      case 'currency':
        return formatCurrency(value, compact);
      case 'percent':
        return formatPercent(value);
      default:
        return formatNumber(value, compact);
    }
  }, [valueType]);

  // Generate color stops for visualMap - use piecewise for clearer buckets
  const colorConfig = React.useMemo(() => {
    const noDataColor = resolveToRgb(colors.bg.tertiary);
    
    const accentMap: Record<string, string> = {
      blue: colors.accent.blue,
      green: colors.status.success,
      purple: colors.accent.purple,
      amber: colors.status.warning,
    };
    
    const accentToken = accentMap[colorScheme] || accentMap.blue;
    
    // Create distinct color stops with clear visual separation
    return {
      noDataColor,
      // 6-stop gradient with more separation at low end
      colors: [
        noDataColor,                          // 0 - no data
        resolveToRgb(accentToken, 0.2),       // very low
        resolveToRgb(accentToken, 0.4),       // low  
        resolveToRgb(accentToken, 0.6),       // medium
        resolveToRgb(accentToken, 0.8),       // high
        resolveToRgb(accentToken, 1.0),       // very high
      ],
    };
  }, [colorScheme]);

  // Transform data to ECharts format
  const echartsData = React.useMemo(() => toEChartsData(data), [data]);

  // Determine max for scale (use p95 to handle outliers)
  const scaleMax = React.useMemo(() => {
    if (scaleMode === 'log' && stats.maxValue > 0) {
      return Math.log10(stats.maxValue + 1);
    }
    return stats.p95Value || 1;
  }, [stats.p95Value, stats.maxValue, scaleMode]);

  // Calculate piecewise thresholds for clearer bucket separation
  const visualMapPieces = React.useMemo(() => {
    const max = scaleMax;
    // Create 5 buckets with clear boundaries
    return [
      { min: 0, max: 0, color: colorConfig.noDataColor, label: 'None' },
      { min: 0.01, max: max * 0.1, color: colorConfig.colors[1], label: 'Very Low' },
      { min: max * 0.1, max: max * 0.3, color: colorConfig.colors[2], label: 'Low' },
      { min: max * 0.3, max: max * 0.6, color: colorConfig.colors[3], label: 'Medium' },
      { min: max * 0.6, max: max * 0.85, color: colorConfig.colors[4], label: 'High' },
      { min: max * 0.85, max: max * 2, color: colorConfig.colors[5], label: 'Very High' },
    ];
  }, [scaleMax, colorConfig]);

  // Build ECharts option
  const option = React.useMemo<EChartsOption>(() => {
    const selectedIndex = selectedCell 
      ? data.findIndex(d => d.dayOfWeek === selectedCell.dayOfWeek && d.hour === selectedCell.hour)
      : -1;

    return {
      animation: true,
      animationDuration: 300,
      aria: {
        enabled: true,
        decal: { show: false },
        label: {
          description: `${valueLabel} heatmap showing activity by day of week and hour of day. Peak: ${
            stats.peakCells[0] 
              ? `${formatValue(stats.peakCells[0].value)} on ${formatTimeSlot(stats.peakCells[0].dayOfWeek, stats.peakCells[0].hour)}`
              : 'No data'
          }`,
        },
      },
      tooltip: {
        show: true,
        trigger: 'item',
        confine: true,
        position: 'top',
        backgroundColor: 'hsl(var(--portal-bg-secondary) / 0.98)',
        borderColor: 'hsl(var(--portal-border))',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: 'hsl(var(--portal-text-primary))',
          fontSize: 13,
        },
        extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px hsl(215 25% 15% / 0.15); backdrop-filter: blur(8px);',
        formatter: (params: any) => {
          const [hour, day, value] = params.data;
          const cell = data.find(d => d.dayOfWeek === day && d.hour === hour);
          const rank = getCellRank(data, day, hour);
          const percentOfTotal = stats.totalValue > 0 ? (value / stats.totalValue) * 100 : 0;
          const isAboveAvg = value > stats.avgValue;
          const isBelowAvg = value < stats.avgValue && value > 0;
          // Check hasData based on count - cell exists and has count > 0
          const hasNoData = !cell || (cell.count === undefined || cell.count === 0);
          
          // Above/below average indicator
          const avgIndicator = hasNoData 
            ? '' 
            : isAboveAvg 
              ? `<span style="color: hsl(var(--portal-success)); font-size: 11px;">↑ Above average</span>`
              : isBelowAvg 
                ? `<span style="color: hsl(var(--portal-warning)); font-size: 11px;">↓ Below average</span>`
                : `<span style="color: hsl(var(--portal-text-muted)); font-size: 11px;">— Average</span>`;
          
          return `
            <div style="min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: hsl(var(--portal-text-primary));">
                ${formatTimeSlot(day, hour)}
              </div>
              ${hasNoData ? `
                <div style="color: hsl(var(--portal-text-muted)); font-size: 12px; font-style: italic;">
                  No donations in this time slot
                </div>
              ` : `
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                  <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">${valueLabel}</span>
                  <span style="font-weight: 600; font-size: 15px; color: hsl(var(--portal-text-primary));">
                    ${formatValue(value)}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: hsl(var(--portal-text-muted)); margin-bottom: 4px;">
                  <span>% of Weekly Total</span>
                  <span>${percentOfTotal.toFixed(1)}%</span>
                </div>
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid hsl(var(--portal-border));">
                  ${avgIndicator}
                </div>
                ${rank && rank <= 5 ? `
                  <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                    <span style="background: hsl(var(--portal-accent-${colorScheme}) / 0.15); color: hsl(var(--portal-accent-${colorScheme})); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      #${rank} of ${TOTAL_TIME_SLOTS} slots
                    </span>
                  </div>
                ` : rank ? `
                  <div style="font-size: 11px; color: hsl(var(--portal-text-muted)); margin-top: 4px;">
                    Rank: #${rank} of ${TOTAL_TIME_SLOTS} slots
                  </div>
                ` : ''}
                ${cell?.count !== undefined ? `
                  <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: hsl(var(--portal-text-muted)); margin-top: 4px;">
                    <span>Transactions</span>
                    <span>${cell.count.toLocaleString()}</span>
                  </div>
                ` : ''}
              `}
            </div>
          `;
        },
      },
      grid: {
        left: compact ? 44 : 52,
        right: compact ? 12 : 16,
        top: 16,
        bottom: compact ? 56 : 64,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: [...HOUR_LABELS_SHORT],
        position: 'bottom',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'hsl(var(--portal-text-muted))',
          fontSize: compact ? 9 : 10,
          interval: compact ? 5 : 2,
          fontFamily: 'inherit',
        },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: [...DAY_LABELS_SHORT],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'hsl(var(--portal-text-muted))',
          fontSize: compact ? 10 : 11,
          fontFamily: 'inherit',
        },
        splitArea: { show: false },
      },
      visualMap: {
        type: 'piecewise',
        pieces: visualMapPieces,
        calculable: false,
        show: false, // Hide built-in legend, we use custom
        outOfRange: {
          color: colorConfig.noDataColor,
        },
      },
      series: [
        {
          name: valueLabel,
          type: 'heatmap',
          data: echartsData,
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0, 0, 0, 0.25)',
              borderColor: 'hsl(var(--portal-accent-blue))',
              borderWidth: 2,
            },
          },
          itemStyle: {
            borderRadius: 4,
            borderWidth: 2,
            borderColor: 'hsl(var(--portal-bg-secondary))',
          },
          select: {
            itemStyle: {
              borderColor: 'hsl(var(--portal-accent-blue))',
              borderWidth: 3,
              shadowBlur: 16,
              shadowColor: 'hsl(var(--portal-accent-blue) / 0.4)',
            },
          },
          selectedMode: 'single',
        },
      ],
    };
  }, [data, echartsData, stats, scaleMax, visualMapPieces, colorConfig, valueLabel, formatValue, colorScheme, selectedCell, compact]);

  // Handle cell click events
  const handleEvents = React.useMemo(() => {
    if (!onCellSelect) return undefined;
    return {
      click: (params: any) => {
        if (params.data) {
          const [hour, dayOfWeek, value] = params.data;
          const cell = data.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour);
          
          // Toggle selection if clicking same cell
          if (selectedCell && isSameCell(selectedCell, { dayOfWeek, hour })) {
            onCellSelect(null);
          } else if (cell) {
            onCellSelect(cell);
          }
        }
      },
    };
  }, [onCellSelect, data, selectedCell]);

  // Accessible summary
  const accessibleSummary = React.useMemo(() => {
    if (!stats.peakCells.length) return `${valueLabel} heatmap with no data.`;
    const peak = stats.peakCells[0];
    return `${valueLabel} heatmap showing activity by day and hour. Peak: ${formatValue(peak.value)} on ${formatTimeSlot(peak.dayOfWeek, peak.hour)}. Total: ${formatValue(stats.totalValue)}.`;
  }, [valueLabel, stats, formatValue]);

  return (
    <div className={cn("w-full", className)}>
      {/* Screen reader summary */}
      <div className="sr-only" role="img" aria-label={accessibleSummary}>
        {accessibleSummary}
      </div>
      
      <EChartsBase
        option={option}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
    </div>
  );
};

V3TimeHeatmap.displayName = "V3TimeHeatmap";

// ============================================================================
// Explicit Legend Component
// ============================================================================

export interface V3TimeHeatmapLegendProps {
  /** Metric label */
  metricLabel: string;
  /** Minimum value */
  minValue: number;
  /** Maximum value */
  maxValue: number;
  /** Average value */
  avgValue?: number;
  /** Format function */
  formatValue: (value: number) => string;
  /** Color scheme */
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
  /** Show help tooltip */
  showHelp?: boolean;
  /** Scale mode label */
  scaleMode?: 'linear' | 'log' | 'quantized';
}

export const V3TimeHeatmapLegend: React.FC<V3TimeHeatmapLegendProps> = ({
  metricLabel,
  minValue,
  maxValue,
  avgValue,
  formatValue,
  colorScheme = 'blue',
  showHelp = true,
  scaleMode = 'linear',
}) => {
  const accentVar = colorScheme === 'blue' ? 'portal-accent-blue' 
    : colorScheme === 'green' ? 'portal-success' 
    : colorScheme === 'purple' ? 'portal-accent-purple' 
    : 'portal-warning';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
      {/* Legend Label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[hsl(var(--portal-text-primary))]">
          {metricLabel}
        </span>
        {showHelp && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))] transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs">
                  Color intensity shows {metricLabel.toLowerCase()} per hour.
                  {scaleMode === 'linear' && ' Using linear scale.'}
                  {scaleMode === 'quantized' && ' Using quantized bins.'}
                  Click any cell to see details.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Color Scale */}
      <div className="flex items-center gap-2">
        {/* No Data indicator */}
        <div className="flex items-center gap-1.5">
          <div 
            className="w-4 h-4 rounded border border-[hsl(var(--portal-border))]"
            style={{ backgroundColor: 'hsl(var(--portal-bg-tertiary))' }}
          />
          <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">No data</span>
        </div>

        <div className="w-px h-4 bg-[hsl(var(--portal-border))]" />

        {/* Value range */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-[hsl(var(--portal-text-muted))]">
            {formatValue(minValue)}
          </span>
          <div className="flex">
            {[0.15, 0.3, 0.45, 0.65, 0.85].map((opacity, i) => (
              <div
                key={i}
                className="w-5 h-4 first:rounded-l last:rounded-r"
                style={{
                  backgroundColor: `hsl(var(--${accentVar}) / ${opacity})`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-medium text-[hsl(var(--portal-text-muted))]">
            {formatValue(maxValue)}
          </span>
        </div>

        {/* Average marker */}
        {avgValue !== undefined && avgValue > 0 && (
          <>
            <div className="w-px h-4 bg-[hsl(var(--portal-border))]" />
            <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--portal-text-muted))]">
              <Minus className="h-3 w-3" />
              <span>Avg: {formatValue(avgValue)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

V3TimeHeatmapLegend.displayName = "V3TimeHeatmapLegend";

// ============================================================================
// Metric Toggle Component
// ============================================================================

export interface V3TimeHeatmapMetricToggleProps {
  /** Currently selected metric */
  metric: HeatmapMetric;
  /** Callback when metric changes */
  onMetricChange: (metric: HeatmapMetric) => void;
  /** Available metrics */
  availableMetrics?: HeatmapMetric[];
  /** Compact mode */
  compact?: boolean;
}

export const V3TimeHeatmapMetricToggle: React.FC<V3TimeHeatmapMetricToggleProps> = ({
  metric,
  onMetricChange,
  availableMetrics = ['revenue', 'count', 'avg_donation'],
  compact = false,
}) => {
  const metricOptions: { value: HeatmapMetric; label: string; shortLabel: string }[] = [
    { value: 'revenue', label: 'Net Revenue', shortLabel: 'Revenue' },
    { value: 'count', label: 'Donation Count', shortLabel: 'Count' },
    { value: 'avg_donation', label: 'Average Donation', shortLabel: 'Avg' },
  ];

  const visibleOptions = metricOptions.filter(opt => availableMetrics.includes(opt.value));

  return (
    <div className="inline-flex rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))] p-0.5">
      {visibleOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onMetricChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
            metric === opt.value
              ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-sm"
              : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))]"
          )}
          aria-pressed={metric === opt.value}
        >
          {compact ? opt.shortLabel : opt.label}
        </button>
      ))}
    </div>
  );
};

V3TimeHeatmapMetricToggle.displayName = "V3TimeHeatmapMetricToggle";

// ============================================================================
// Peak Chips Component
// ============================================================================

export interface V3TimeHeatmapPeakChipsProps {
  peakCells: RankedCell[];
  selectedCell?: { dayOfWeek: number; hour: number } | null;
  onSelect?: (cell: RankedCell) => void;
  formatValue?: (value: number) => string;
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
  metricLabel?: string;
}

const RankIcon: React.FC<{ rank: number; className?: string }> = ({ rank, className }) => {
  if (rank === 1) return <Trophy className={cn("h-3.5 w-3.5", className)} />;
  if (rank === 2) return <Medal className={cn("h-3.5 w-3.5", className)} />;
  if (rank === 3) return <Award className={cn("h-3.5 w-3.5", className)} />;
  return null;
};

export const V3TimeHeatmapPeakChips: React.FC<V3TimeHeatmapPeakChipsProps> = ({
  peakCells,
  selectedCell = null,
  onSelect,
  formatValue = (v) => `$${v.toLocaleString()}`,
  colorScheme = 'blue',
  metricLabel,
}) => {
  if (!peakCells.length) return null;

  const accentVar = colorScheme === 'blue' ? 'portal-accent-blue' 
    : colorScheme === 'green' ? 'portal-success' 
    : colorScheme === 'purple' ? 'portal-accent-purple' 
    : 'portal-warning';

  return (
    <div className="flex flex-wrap gap-2">
      {peakCells.slice(0, 3).map((peak) => {
        const isSelected = selectedCell && isSameCell(selectedCell, peak);
        
        return (
          <button
            key={`${peak.dayOfWeek}-${peak.hour}`}
            onClick={() => onSelect?.(peak)}
            className={cn(
              "group inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
              "transition-all duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              `focus-visible:ring-[hsl(var(--${accentVar})/0.5)]`,
              isSelected
                ? `bg-[hsl(var(--${accentVar})/0.2)] text-[hsl(var(--${accentVar}))] ring-2 ring-[hsl(var(--${accentVar})/0.4)]`
                : `bg-[hsl(var(--${accentVar})/0.08)] text-[hsl(var(--${accentVar}))] hover:bg-[hsl(var(--${accentVar})/0.15)]`
            )}
            aria-pressed={isSelected}
            aria-label={`Peak #${peak.rank}: ${formatTimeSlotShort(peak.dayOfWeek, peak.hour)}, ${formatValue(peak.value)}`}
          >
            <span className="flex items-center gap-1.5">
              <RankIcon rank={peak.rank} className="opacity-70" />
              <span className="font-bold">#{peak.rank}</span>
            </span>
            <span className="opacity-80">·</span>
            <span>{formatTimeSlotShort(peak.dayOfWeek, peak.hour)}</span>
            <span className="opacity-60">→</span>
            <span className="font-semibold">{formatValue(peak.value)}</span>
          </button>
        );
      })}
    </div>
  );
};

V3TimeHeatmapPeakChips.displayName = "V3TimeHeatmapPeakChips";

// ============================================================================
// Details Panel Component
// ============================================================================

export interface V3TimeHeatmapDetailsPanelProps {
  selectedCell: HeatmapDataPoint | null;
  totalValue: number;
  totalCount?: number;
  allCells: HeatmapDataPoint[];
  onClear?: () => void;
  formatValue?: (value: number) => string;
  valueLabel?: string;
  metric?: HeatmapMetric;
}

export const V3TimeHeatmapDetailsPanel: React.FC<V3TimeHeatmapDetailsPanelProps> = ({
  selectedCell,
  totalValue,
  totalCount = 0,
  allCells,
  onClear,
  formatValue = (v) => `$${v.toLocaleString()}`,
  valueLabel = 'Revenue',
  metric = 'revenue',
}) => {
  if (!selectedCell) return null;

  const percentOfTotal = totalValue > 0 ? (selectedCell.value / totalValue) * 100 : 0;
  const rank = getCellRank(allCells, selectedCell.dayOfWeek, selectedCell.hour);
  const avgDonation = selectedCell.count && selectedCell.count > 0 
    ? (selectedCell.revenue || selectedCell.value) / selectedCell.count 
    : 0;
  const isAboveAvg = selectedCell.value > (totalValue / allCells.filter(c => c.value > 0).length);

  return (
    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">
              {formatTimeSlot(selectedCell.dayOfWeek, selectedCell.hour)}
            </h4>
            {rank && (
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold",
                rank <= 3 
                  ? "bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]"
                  : "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]"
              )}>
                #{rank} of {TOTAL_TIME_SLOTS}
              </span>
            )}
            {isAboveAvg && selectedCell.value > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-[hsl(var(--portal-success))]">
                <TrendingUp className="h-3 w-3" />
                Above avg
              </span>
            )}
          </div>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-0.5">{valueLabel}</p>
              <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {formatValue(selectedCell.value)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-0.5">% of Total</p>
              <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {percentOfTotal.toFixed(1)}%
              </p>
            </div>
            {selectedCell.count !== undefined && (
              <div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-0.5">Transactions</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                  {selectedCell.count.toLocaleString()}
                </p>
              </div>
            )}
            {metric === 'revenue' && avgDonation > 0 && (
              <div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-0.5">Avg Donation</p>
                <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                  {formatCurrency(avgDonation)}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Clear button */}
        {onClear && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-md text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

V3TimeHeatmapDetailsPanel.displayName = "V3TimeHeatmapDetailsPanel";
