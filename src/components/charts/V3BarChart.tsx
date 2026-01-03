/**
 * V3BarChart - Premium Analytics Bar Chart
 * 
 * Features:
 * - Automatic sorting (desc by default)
 * - Top N + "Other" aggregation
 * - Label truncation with full label in tooltip
 * - Rank indicators for top items
 * - % of total in tooltip
 * - Click-to-select with selection state
 * - ARIA accessibility
 * - Premium styling with rounded bars
 */

import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { getChartColors } from "@/lib/design-tokens";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/chart-formatters";
import {
  processBarChartData,
  truncateLabel,
  calculatePercentOfTotal,
  mergeDuplicateCategories,
  type BarDataItem,
  type BarChartProcessOptions,
} from "@/lib/bar-chart-utils";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { AlertTriangle } from "lucide-react";

export type V3BarValueType = "number" | "currency" | "percent";

export interface V3BarChartProps {
  /** Raw data array */
  data: Record<string, unknown>[];
  /** Key for category/name */
  nameKey?: string;
  /** Key for value */
  valueKey?: string;
  /** Display name for the value */
  valueName?: string;
  /** Chart height */
  height?: number | string;
  /** Additional class name */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Value format type */
  valueType?: V3BarValueType;
  /** Horizontal orientation (default: true for better label readability) */
  horizontal?: boolean;
  /** Maximum items before grouping into "Other" */
  topN?: number;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Show rank badges on top 3 bars */
  showRankBadges?: boolean;
  /** Maximum label length before truncation */
  maxLabelLength?: number;
  /** Currently selected category (for controlled selection) */
  selectedCategory?: string | null;
  /** Callback when a bar is clicked */
  onCategorySelect?: (category: string | null, item: BarDataItem | null) => void;
  /** Color for bars (uses theme accent by default) */
  barColor?: string;
  /** Show value labels on bars */
  showValueLabels?: boolean;
  /** Merge duplicate categories (case-insensitive) */
  mergeDuplicates?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Show "Other dominates" warning */
  showOtherWarning?: boolean;
}

const colorPalette = getChartColors();

export const V3BarChart: React.FC<V3BarChartProps> = ({
  data,
  nameKey = 'name',
  valueKey = 'value',
  valueName = 'Value',
  height = 300,
  className,
  isLoading = false,
  valueType = 'number',
  horizontal = true,
  topN = 10,
  sortDirection = 'desc',
  showRankBadges = true,
  maxLabelLength = 16,
  selectedCategory = null,
  onCategorySelect,
  barColor,
  showValueLabels = false,
  mergeDuplicates = true,
  emptyMessage = 'No data available',
  showOtherWarning = true,
}) => {
  // Format value based on type
  const formatValue = React.useCallback((value: number, compact = false): string => {
    switch (valueType) {
      case 'currency':
        return formatCurrency(value, compact);
      case 'percent':
        return formatPercent(value, 1);
      default:
        return formatNumber(value, compact);
    }
  }, [valueType]);

  // Process data: merge duplicates, sort, top N, other
  const processedData = React.useMemo(() => {
    const cleanData = mergeDuplicates 
      ? mergeDuplicateCategories(data, nameKey, valueKey)
      : data;
    
    return processBarChartData(cleanData, {
      topN,
      sortDirection,
      nameKey,
      valueKey,
      otherLabel: 'Other',
    });
  }, [data, nameKey, valueKey, topN, sortDirection, mergeDuplicates]);

  // Combine items with Other if present
  const chartItems = React.useMemo(() => {
    const items = [...processedData.items];
    if (processedData.otherItem) {
      items.push(processedData.otherItem);
    }
    return items;
  }, [processedData]);

  // Empty state
  if (!isLoading && chartItems.length === 0) {
    return (
      <div className={className} style={{ height: typeof height === 'number' ? height : undefined }}>
        <V3EmptyState
          title={emptyMessage}
          description="There is no data to display."
          accent="blue"
        />
      </div>
    );
  }

  // Build ECharts option
  const option = React.useMemo<EChartsOption>(() => {
    const categories = chartItems.map(item => item.name);
    const primaryColor = barColor || colorPalette[0];
    const otherColor = 'hsl(var(--portal-text-muted) / 0.5)';

    // Create series data with conditional styling
    const seriesData = chartItems.map((item, index) => {
      const isOther = (item as any)._isOther;
      const isSelected = selectedCategory === item.name;
      const rank = index + 1;
      
      return {
        value: item.value,
        name: item.name,
        itemStyle: {
          color: isOther ? otherColor : primaryColor,
          opacity: selectedCategory && !isSelected ? 0.4 : 1,
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          ...(isSelected && {
            borderColor: 'hsl(var(--portal-accent-blue))',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'hsl(var(--portal-accent-blue) / 0.3)',
          }),
        },
        // Store rank for tooltip
        _rank: rank,
        _isOther: isOther,
        _percentOfTotal: calculatePercentOfTotal(item.value, processedData.totalValue),
      };
    });

    // Category axis config with truncation
    const categoryAxisConfig = {
      type: 'category' as const,
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(var(--portal-text-muted))',
        fontSize: 11,
        formatter: (value: string) => truncateLabel(value, maxLabelLength),
        // For horizontal bars, limit width
        ...(horizontal && {
          width: 100,
          overflow: 'truncate' as const,
        }),
      },
    };

    // Value axis config
    const valueAxisConfig = {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(var(--portal-text-muted))',
        fontSize: 10,
        formatter: (value: number) => formatValue(value, true),
      },
      splitLine: {
        lineStyle: {
          color: 'hsl(var(--portal-border) / 0.5)',
          type: 'dashed' as const,
        },
      },
    };

    return {
      animation: true,
      animationDuration: 400,
      animationEasing: 'cubicOut' as const,
      aria: {
        enabled: true,
        label: {
          description: `Bar chart showing ${valueName} by category. Top category: ${chartItems[0]?.name || 'none'} with ${formatValue(chartItems[0]?.value || 0)}.`,
        },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'hsl(var(--portal-bg-secondary) / 0.98)',
        borderColor: 'hsl(var(--portal-border))',
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px hsl(215 25% 15% / 0.15); backdrop-filter: blur(8px);',
        formatter: (params: any) => {
          const item = params.data;
          const rank = item._rank;
          const percentOfTotal = item._percentOfTotal;
          const isOther = item._isOther;
          
          // Find the original item to get full name
          const originalItem = chartItems[params.dataIndex];
          const fullName = originalItem?.name || params.name;
          
          return `
            <div style="min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                ${!isOther && showRankBadges && rank <= 3 ? `
                  <span style="background: hsl(var(--portal-accent-blue) / 0.15); color: hsl(var(--portal-accent-blue)); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                    #${rank}
                  </span>
                ` : ''}
                <span style="font-weight: 600; font-size: 13px; color: hsl(var(--portal-text-primary));">
                  ${fullName}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">${valueName}</span>
                <span style="font-weight: 600; font-size: 14px; color: hsl(var(--portal-text-primary));">
                  ${formatValue(params.value)}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: hsl(var(--portal-text-muted));">
                <span>% of Total</span>
                <span>${percentOfTotal.toFixed(1)}%</span>
              </div>
              ${isOther ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid hsl(var(--portal-border)); font-size: 11px; color: hsl(var(--portal-text-muted)); font-style: italic;">
                  Aggregates ${(originalItem as any)?._itemCount || 'remaining'} categories
                </div>
              ` : ''}
            </div>
          `;
        },
      },
      grid: {
        left: horizontal ? 120 : 12,
        right: 16,
        top: 16,
        bottom: 16,
        containLabel: !horizontal,
      },
      xAxis: horizontal ? valueAxisConfig : categoryAxisConfig,
      yAxis: horizontal ? { ...categoryAxisConfig, inverse: true } : valueAxisConfig,
      series: [
        {
          type: 'bar',
          name: valueName,
          data: seriesData,
          barMaxWidth: 32,
          emphasis: {
            focus: 'self',
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          label: showValueLabels ? {
            show: true,
            position: horizontal ? 'right' : 'top',
            formatter: (params: any) => formatValue(params.value, true),
            fontSize: 10,
            color: 'hsl(var(--portal-text-muted))',
          } : undefined,
        },
      ],
    };
  }, [chartItems, processedData, selectedCategory, horizontal, valueType, valueName, formatValue, maxLabelLength, showRankBadges, showValueLabels, barColor]);

  // Handle bar click
  const handleEvents = React.useMemo(() => {
    if (!onCategorySelect) return undefined;
    return {
      click: (params: any) => {
        const clickedName = params.name;
        // Toggle selection
        if (selectedCategory === clickedName) {
          onCategorySelect(null, null);
        } else {
          const item = chartItems.find(i => i.name === clickedName);
          onCategorySelect(clickedName, item || null);
        }
      },
    };
  }, [onCategorySelect, selectedCategory, chartItems]);

  return (
    <div className={className}>
      <EChartsBase
        option={option}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
      
      {/* "Other dominates" warning */}
      {showOtherWarning && processedData.hasOtherDominating && (
        <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.3)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))] shrink-0 mt-0.5" />
            <p className="text-xs text-[hsl(var(--portal-text-secondary))]">
              <span className="font-medium text-[hsl(var(--portal-warning))]">High "Other" concentration:</span>{' '}
              Most data falls outside the top {topN} categories. Consider improving attribution or expanding category tracking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

V3BarChart.displayName = 'V3BarChart';
