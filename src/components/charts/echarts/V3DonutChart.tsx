/**
 * V3 Donut Chart - Premium ECharts-based donut/pie visualization
 * 
 * Features:
 * - Clean donut with rounded corners and subtle slice separation
 * - Center label showing total (default) or hovered slice details
 * - Premium tooltip styling consistent with V3 design
 * - Rich legend with value + percent
 * - Top N + Other aggregation built-in
 * - Label normalization and duplicate merging
 * - Stable color assignment
 * - Accessibility (ARIA) support
 * - Click-to-lock selection
 */

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import { 
  processDonutData, 
  ProcessDonutDataOptions,
  getRankSuffix,
} from "@/lib/donut-chart-utils";
import type { DonutDataItem } from "@/lib/donut-chart-utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";

export type DonutValueType = "number" | "currency" | "percent";

export interface V3DonutChartProps {
  /** Raw data items - will be processed (sorted, Top N, normalized) */
  data: DonutDataItem[];
  /** Chart height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Value format type */
  valueType?: DonutValueType;
  /** Label for the center total (e.g., "Total Donors") */
  centerLabel?: string;
  /** Show legend */
  showLegend?: boolean;
  /** Legend position */
  legendPosition?: "bottom" | "right";
  /** Maximum slices before aggregating to "Other" */
  topN?: number;
  /** Include "Not Provided" entries */
  includeNotProvided?: boolean;
  /** Click handler for slices */
  onSliceSelect?: (params: { name: string; value: number; percent: number } | null) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Enable ARIA accessibility descriptions */
  enableAccessibility?: boolean;
  /** Custom data processing options */
  dataOptions?: ProcessDonutDataOptions;
}

export const V3DonutChart: React.FC<V3DonutChartProps> = ({
  data,
  height = 300,
  className,
  isLoading = false,
  valueType = "number",
  centerLabel = "Total",
  showLegend = true,
  legendPosition = "bottom",
  topN = 6,
  includeNotProvided = false,
  onSliceSelect,
  emptyMessage = "No data available",
  emptyDescription = "There is no data to display in this chart.",
  enableAccessibility = true,
  dataOptions,
}) => {
  // Track selected/hovered slice for center label
  const [hoveredSlice, setHoveredSlice] = useState<{ name: string; value: number; percent: number } | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<{ name: string; value: number; percent: number } | null>(null);

  // Format value based on type
  const formatValue = useCallback((value: number, compact = false) => {
    switch (valueType) {
      case "currency":
        return formatCurrency(value, compact);
      case "percent":
        return formatPercent(value, 1);
      default:
        return formatNumber(value, compact);
    }
  }, [valueType]);

  // Process data with Top N + Other aggregation
  const processedData = useMemo(() => {
    return processDonutData(data, {
      topN,
      includeNotProvided,
      mergeDuplicates: true,
      ...dataOptions,
    });
  }, [data, topN, includeNotProvided, dataOptions]);

  // Handle loading
  if (isLoading) {
    return (
      <div className={className} style={{ height: typeof height === 'number' ? height : undefined }}>
        <V3LoadingState variant="chart" />
      </div>
    );
  }

  // Handle empty data
  if (!processedData.items || processedData.items.length === 0) {
    return (
      <div className={className} style={{ height: typeof height === 'number' ? height : undefined }}>
        <V3EmptyState
          title={emptyMessage}
          description={emptyDescription}
          accent="blue"
        />
      </div>
    );
  }

  // Current display state (selected takes priority over hovered)
  const displaySlice = selectedSlice || hoveredSlice;

  // Build ECharts option
  const option = useMemo<EChartsOption>(() => {
    const isRightLegend = showLegend && legendPosition === "right";
    const innerRadius = "55%";
    const outerRadius = isRightLegend ? "75%" : "80%";
    const centerX = isRightLegend ? "30%" : "50%";

    // Build legend data with formatted values
    const legendData = processedData.items.map((item, index) => {
      const percent = processedData.total > 0 
        ? ((item.value / processedData.total) * 100).toFixed(1) 
        : '0';
      return {
        name: item.name,
        displayName: `${item.name}  ${formatValue(item.value, true)}  (${percent}%)`,
      };
    });

    // Chart data with styling
    const chartData = processedData.items.map((item, index) => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.color,
        borderRadius: 6,
        borderColor: "hsl(var(--portal-bg-primary))",
        borderWidth: 3,
      },
      // Add rank for tooltip
      rank: index + 1,
    }));

    // Build center label graphic
    const centerGraphic = {
      elements: [
        {
          type: "text",
          left: "center",
          top: "42%",
          style: {
            text: displaySlice 
              ? displaySlice.name.length > 15 
                ? displaySlice.name.substring(0, 15) + '...'
                : displaySlice.name
              : centerLabel,
            textAlign: "center",
            fill: "hsl(var(--portal-text-muted))",
            fontSize: 12,
            fontWeight: 500,
          },
          silent: true,
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: {
            text: displaySlice 
              ? formatValue(displaySlice.value)
              : formatValue(processedData.total),
            textAlign: "center",
            fill: "hsl(var(--portal-text-primary))",
            fontSize: 22,
            fontWeight: 700,
          },
          silent: true,
        },
        {
          type: "text",
          left: "center",
          top: "60%",
          style: {
            text: displaySlice 
              ? `${displaySlice.percent.toFixed(1)}%`
              : "",
            textAlign: "center",
            fill: "hsl(var(--portal-text-secondary))",
            fontSize: 13,
            fontWeight: 500,
          },
          silent: true,
        },
      ],
    };

    // Adjust graphic position for right legend
    if (isRightLegend) {
      centerGraphic.elements.forEach((el: any) => {
        el.left = centerX;
      });
    }

    return {
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut",
      // Accessibility
      ...(enableAccessibility && {
        aria: {
          enabled: true,
          decal: {
            show: false, // Can enable for colorblind support
          },
        },
      }),
      // Tooltip
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "hsl(var(--portal-bg-secondary) / 0.98)",
        borderColor: "hsl(var(--portal-border) / 0.5)",
        borderWidth: 1,
        padding: 14,
        extraCssText: `
          border-radius: 10px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        `,
        formatter: (params: any) => {
          const percent = processedData.total > 0 
            ? ((params.value / processedData.total) * 100).toFixed(1) 
            : '0';
          const rank = params.data?.rank || 1;
          const valueFormatted = formatValue(params.value);
          
          return `
            <div style="min-width: 140px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${params.color}; flex-shrink: 0;"></span>
                <span style="font-weight: 600; color: hsl(var(--portal-text-primary)); font-size: 14px; line-height: 1.3;">
                  ${params.name}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 12px;">
                <span style="color: hsl(var(--portal-text-muted));">Value</span>
                <span style="font-weight: 600; color: hsl(var(--portal-text-primary)); text-align: right;">${valueFormatted}</span>
                <span style="color: hsl(var(--portal-text-muted));">Share</span>
                <span style="font-weight: 500; color: hsl(var(--portal-text-secondary)); text-align: right;">${percent}%</span>
                <span style="color: hsl(var(--portal-text-muted));">Rank</span>
                <span style="font-weight: 500; color: hsl(var(--portal-text-secondary)); text-align: right;">${getRankSuffix(rank)}</span>
              </div>
              ${params.name === 'Other' && processedData.otherCount > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid hsl(var(--portal-border) / 0.3); font-size: 11px; color: hsl(var(--portal-text-muted));">
                  Includes ${processedData.otherCount} additional categories
                </div>
              ` : ''}
            </div>
          `;
        },
      },
      // Legend
      legend: showLegend
        ? {
            type: "scroll",
            orient: legendPosition === "right" ? "vertical" : "horizontal",
            ...(legendPosition === "right"
              ? { right: "2%", top: "center", align: "left" }
              : { bottom: 0, left: "center" }),
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 11,
              overflow: "truncate",
              width: legendPosition === "right" ? 160 : 120,
            },
            tooltip: {
              show: true,
              formatter: (params: any) => {
                const item = processedData.items.find(i => i.name === params.name);
                if (!item) return params.name;
                const percent = processedData.total > 0 
                  ? ((item.value / processedData.total) * 100).toFixed(1) 
                  : '0';
                return `${params.name}: ${formatValue(item.value)} (${percent}%)`;
              },
            },
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            itemGap: legendPosition === "right" ? 10 : 16,
            formatter: (name: string) => {
              const item = processedData.items.find(i => i.name === name);
              if (!item) return name;
              const percent = processedData.total > 0 
                ? ((item.value / processedData.total) * 100).toFixed(0) 
                : '0';
              // Truncate long names
              const displayName = name.length > 14 ? name.substring(0, 14) + '…' : name;
              return `${displayName}  ${percent}%`;
            },
            pageIconColor: "hsl(var(--portal-text-secondary))",
            pageIconInactiveColor: "hsl(var(--portal-text-muted))",
            pageTextStyle: {
              color: "hsl(var(--portal-text-secondary))",
            },
          }
        : undefined,
      // Center label graphic
      graphic: centerGraphic,
      // Pie series
      series: [
        {
          type: "pie",
          radius: [innerRadius, outerRadius],
          center: [centerX, "50%"],
          avoidLabelOverlap: true,
          padAngle: 2, // Subtle slice separation
          data: chartData,
          // No outside labels by default
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          // Emphasis on hover
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.2)",
            },
          },
          // Dim other slices on hover
          select: {
            disabled: false,
            itemStyle: {
              shadowBlur: 20,
              shadowColor: "rgba(0, 0, 0, 0.25)",
            },
          },
          selectedMode: "single",
        },
      ],
    };
  }, [
    processedData, 
    showLegend, 
    legendPosition, 
    formatValue, 
    centerLabel, 
    displaySlice, 
    enableAccessibility,
  ]);

  // Event handlers
  const handleEvents = useMemo(() => ({
    mouseover: (params: any) => {
      if (params.seriesType === 'pie') {
        const percent = processedData.total > 0 
          ? (params.value / processedData.total) * 100 
          : 0;
        setHoveredSlice({
          name: params.name,
          value: params.value,
          percent,
        });
      }
    },
    mouseout: () => {
      setHoveredSlice(null);
    },
    click: (params: any) => {
      if (params.seriesType === 'pie') {
        const percent = processedData.total > 0 
          ? (params.value / processedData.total) * 100 
          : 0;
        const clickedSlice = {
          name: params.name,
          value: params.value,
          percent,
        };
        
        // Toggle selection
        if (selectedSlice?.name === params.name) {
          setSelectedSlice(null);
          onSliceSelect?.(null);
        } else {
          setSelectedSlice(clickedSlice);
          onSliceSelect?.(clickedSlice);
        }
      }
    },
  }), [processedData.total, selectedSlice, onSliceSelect]);

  return (
    <EChartsBase
      option={option}
      height={height}
      className={className}
      isLoading={isLoading}
      onEvents={handleEvents}
      notMerge={true}
    />
  );
};

export default V3DonutChart;
