/**
 * V3TimeHeatmap - Premium Time-of-Day × Day-of-Week Heatmap
 * 
 * A world-class ECharts heatmap for visualizing temporal patterns.
 * Supports revenue, count, and unique donor metrics with interactive
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
  type RankedCell,
  DAY_LABELS_SHORT,
  HOUR_LABELS_SHORT,
  formatTimeSlot,
  formatTimeSlotShort,
  toEChartsData,
  isSameCell,
  getRankedCells,
  calculateP95,
} from "@/lib/heatmap-utils";

export interface V3TimeHeatmapProps {
  /** Normalized 7×24 grid data */
  data: HeatmapDataPoint[];
  /** Metric being displayed */
  metric?: 'revenue' | 'count';
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
  const stats = React.useMemo(() => {
    const values = data.map(d => d.value);
    const totalValue = values.reduce((sum, v) => sum + v, 0);
    const maxValue = Math.max(...values, 0);
    const p95Value = calculateP95(values);
    const peakCells = getRankedCells(data, 5);
    
    return { totalValue, maxValue, p95Value, peakCells };
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

  // Generate color range for visualMap
  const colorRange = React.useMemo<string[]>(() => {
    const noDataColor = resolveToRgb(colors.bg.tertiary);
    
    const accentMap: Record<string, string> = {
      blue: colors.accent.blue,
      green: colors.status.success,
      purple: colors.accent.purple,
      amber: colors.status.warning,
    };
    
    const accentToken = accentMap[colorScheme] || accentMap.blue;
    
    // 5-stop gradient for smooth transitions
    return [
      noDataColor,
      resolveToRgb(accentToken, 0.15),
      resolveToRgb(accentToken, 0.35),
      resolveToRgb(accentToken, 0.6),
      resolveToRgb(accentToken, 0.85),
    ];
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
          const rank = stats.peakCells.find(p => p.dayOfWeek === day && p.hour === hour);
          const percentOfTotal = stats.totalValue > 0 ? (value / stats.totalValue) * 100 : 0;
          
          return `
            <div style="min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: hsl(var(--portal-text-primary));">
                ${formatTimeSlot(day, hour)}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">${valueLabel}</span>
                <span style="font-weight: 600; font-size: 15px; color: hsl(var(--portal-text-primary));">
                  ${formatValue(value)}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: hsl(var(--portal-text-muted));">
                <span>% of Total</span>
                <span>${percentOfTotal.toFixed(1)}%</span>
              </div>
              ${rank ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid hsl(var(--portal-border)); display: flex; align-items: center; gap: 6px;">
                  <span style="background: hsl(var(--portal-accent-${colorScheme}) / 0.15); color: hsl(var(--portal-accent-${colorScheme})); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    #${rank.rank} Peak
                  </span>
                </div>
              ` : ''}
              ${cell?.count !== undefined ? `
                <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: hsl(var(--portal-text-muted)); margin-top: 4px;">
                  <span>Transactions</span>
                  <span>${cell.count.toLocaleString()}</span>
                </div>
              ` : ''}
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
        min: 0,
        max: scaleMax,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: compact ? 12 : 14,
        itemHeight: compact ? 80 : 120,
        inRange: {
          color: colorRange,
        },
        outOfRange: {
          color: resolveToRgb(colors.bg.tertiary),
        },
        text: [formatValue(stats.p95Value, true), '0'],
        textGap: 8,
        textStyle: {
          color: 'hsl(var(--portal-text-muted))',
          fontSize: 10,
          fontFamily: 'inherit',
        },
        formatter: (value: number) => formatValue(value, true),
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
  }, [data, echartsData, stats, scaleMax, colorRange, valueLabel, formatValue, colorScheme, selectedCell, compact]);

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
// Subcomponents
// ============================================================================

export interface V3TimeHeatmapLegendProps {
  valueLabel?: string;
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
  minValue?: number;
  maxValue?: number;
  formatValue?: (value: number) => string;
}

/**
 * Visual legend component for the heatmap
 */
export const V3TimeHeatmapLegend: React.FC<V3TimeHeatmapLegendProps> = ({
  valueLabel = 'Intensity',
  colorScheme = 'blue',
  minValue = 0,
  maxValue = 100,
  formatValue = (v) => v.toString(),
}) => {
  const accentVar = colorScheme === 'blue' ? 'portal-accent-blue' 
    : colorScheme === 'green' ? 'portal-success' 
    : colorScheme === 'purple' ? 'portal-accent-purple' 
    : 'portal-warning';

  return (
    <div className="flex items-center justify-center gap-3 text-xs text-[hsl(var(--portal-text-muted))]">
      <span className="font-medium">{valueLabel}:</span>
      <span>{formatValue(minValue)}</span>
      <div className="flex gap-0.5">
        {[0.1, 0.25, 0.45, 0.65, 0.85].map((opacity, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded"
            style={{
              backgroundColor: `hsl(var(--${accentVar}) / ${opacity})`,
              border: '1px solid hsl(var(--portal-border))',
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>{formatValue(maxValue)}</span>
    </div>
  );
};

V3TimeHeatmapLegend.displayName = "V3TimeHeatmapLegend";

export interface V3TimeHeatmapPeakChipsProps {
  peakCells: RankedCell[];
  selectedCell?: { dayOfWeek: number; hour: number } | null;
  onSelect?: (cell: RankedCell) => void;
  formatValue?: (value: number) => string;
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
}

/**
 * Interactive peak time chips
 */
export const V3TimeHeatmapPeakChips: React.FC<V3TimeHeatmapPeakChipsProps> = ({
  peakCells,
  selectedCell = null,
  onSelect,
  formatValue = (v) => `$${v.toLocaleString()}`,
  colorScheme = 'blue',
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
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
              "transition-all duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              `focus-visible:ring-[hsl(var(--${accentVar})/0.5)]`,
              isSelected
                ? `bg-[hsl(var(--${accentVar})/0.2)] text-[hsl(var(--${accentVar}))] ring-2 ring-[hsl(var(--${accentVar})/0.4)]`
                : `bg-[hsl(var(--${accentVar})/0.1)] text-[hsl(var(--${accentVar}))] hover:bg-[hsl(var(--${accentVar})/0.15)]`
            )}
            aria-pressed={isSelected}
            aria-label={`Peak #${peak.rank}: ${formatTimeSlotShort(peak.dayOfWeek, peak.hour)}, ${formatValue(peak.value)}`}
          >
            <span className="font-bold opacity-60">#{peak.rank}</span>
            <span>{formatTimeSlotShort(peak.dayOfWeek, peak.hour)}</span>
            <span className="opacity-80">—</span>
            <span className="font-semibold">{formatValue(peak.value)}</span>
          </button>
        );
      })}
    </div>
  );
};

V3TimeHeatmapPeakChips.displayName = "V3TimeHeatmapPeakChips";

export interface V3TimeHeatmapDetailsPanelProps {
  selectedCell: HeatmapDataPoint | null;
  totalValue: number;
  peakCells: RankedCell[];
  onClear?: () => void;
  formatValue?: (value: number) => string;
  valueLabel?: string;
}

/**
 * Details panel for selected cell
 */
export const V3TimeHeatmapDetailsPanel: React.FC<V3TimeHeatmapDetailsPanelProps> = ({
  selectedCell,
  totalValue,
  peakCells,
  onClear,
  formatValue = (v) => `$${v.toLocaleString()}`,
  valueLabel = 'Revenue',
}) => {
  if (!selectedCell) return null;

  const percentOfTotal = totalValue > 0 ? (selectedCell.value / totalValue) * 100 : 0;
  const rank = peakCells.find(p => isSameCell(p, selectedCell));

  return (
    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">
              {formatTimeSlot(selectedCell.dayOfWeek, selectedCell.hour)}
            </h4>
            {rank && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]">
                #{rank.rank} Peak
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
          </div>
        </div>
        
        {onClear && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-md text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
            aria-label="Clear selection"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

V3TimeHeatmapDetailsPanel.displayName = "V3TimeHeatmapDetailsPanel";
