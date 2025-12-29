import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { getChartColors } from "@/lib/design-tokens";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { V3EmptyState } from "@/components/v3/V3EmptyState";

export type PieValueFormatType = "number" | "currency" | "percent";

export interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface EChartsPieChartProps {
  /** Data items for the pie chart */
  data: PieDataItem[];
  /** Chart height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Pie or donut variant */
  variant?: "pie" | "donut";
  /** Show labels on slices */
  showLabels?: boolean;
  /** Minimum percentage to show label (0-100) */
  labelThreshold?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Legend position */
  legendPosition?: "bottom" | "right";
  /** Value format type for tooltips */
  valueType?: PieValueFormatType;
  /** Show percentage in tooltip */
  showPercentage?: boolean;
  /** Click handler for pie slices */
  onSliceClick?: (params: { name: string; value: number; percent: number }) => void;
  /** Empty state message */
  emptyMessage?: string;
}

const colorPalette = getChartColors();

export const EChartsPieChart: React.FC<EChartsPieChartProps> = ({
  data,
  height = 300,
  className,
  isLoading = false,
  variant = "pie",
  showLabels = true,
  labelThreshold = 5,
  showLegend = true,
  legendPosition = "bottom",
  valueType = "number",
  showPercentage = true,
  onSliceClick,
  emptyMessage = "No data available",
}) => {
  // Handle empty data
  if (!isLoading && (!data || data.length === 0)) {
    return (
      <div className={className} style={{ height: typeof height === 'number' ? height : undefined }}>
        <V3EmptyState
          title={emptyMessage}
          description="There is no data to display in this chart."
          accent="blue"
        />
      </div>
    );
  }

  // Calculate total for percentages
  const total = React.useMemo(() => 
    data.reduce((sum, item) => sum + item.value, 0), 
    [data]
  );

  // Format value based on type
  const formatValue = React.useCallback((value: number) => {
    switch (valueType) {
      case "currency":
        return formatCurrency(value, false);
      case "percent":
        return formatPercent(value, 1);
      default:
        return formatNumber(value, false);
    }
  }, [valueType]);

  // Prepare chart data with colors
  const chartData = React.useMemo(() => 
    data.map((item, index) => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.color || colorPalette[index % colorPalette.length],
      },
    })),
    [data]
  );

  const option = React.useMemo<EChartsOption>(() => {
    const innerRadius = variant === "donut" ? "50%" : 0;
    const outerRadius = showLegend && legendPosition === "right" ? "70%" : "75%";
    const centerX = showLegend && legendPosition === "right" ? "35%" : "50%";

    return {
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
        borderColor: "hsl(var(--portal-border) / 0.5)",
        borderWidth: 1,
        padding: 12,
        extraCssText: `
          border-radius: 8px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `,
        formatter: (params: any) => {
          const percent = ((params.value / total) * 100).toFixed(1);
          const valueFormatted = formatValue(params.value);
          
          return `
            <div style="font-weight: 600; margin-bottom: 6px; color: hsl(var(--portal-text-primary)); font-size: 13px;">
              ${params.name}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${params.color};"></span>
              <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Value:</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary)); font-size: 13px;">${valueFormatted}</span>
            </div>
            ${showPercentage ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="width: 8px;"></span>
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Share:</span>
                <span style="font-weight: 500; color: hsl(var(--portal-text-secondary)); font-size: 12px;">${percent}%</span>
              </div>
            ` : ""}
          `;
        },
      },
      legend: showLegend
        ? {
            orient: legendPosition === "right" ? "vertical" : "horizontal",
            ...(legendPosition === "right"
              ? { right: "5%", top: "center" }
              : { bottom: 0, left: "center" }),
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 12,
            },
            icon: "circle",
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 12,
          }
        : undefined,
      series: [
        {
          type: "pie",
          radius: [innerRadius, outerRadius],
          center: [centerX, "50%"],
          data: chartData,
          label: showLabels
            ? {
                show: true,
                position: "outside",
                formatter: (params: any) => {
                  const percent = ((params.value / total) * 100);
                  if (percent < labelThreshold) return "";
                  return `${params.name}\n${percent.toFixed(0)}%`;
                },
                color: "hsl(var(--portal-text-secondary))",
                fontSize: 11,
                lineHeight: 16,
              }
            : { show: false },
          labelLine: showLabels
            ? {
                show: true,
                lineStyle: {
                  color: "hsl(var(--portal-border))",
                },
              }
            : { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.15)",
            },
            scaleSize: 8,
          },
          itemStyle: {
            borderRadius: 4,
            borderColor: "hsl(var(--portal-bg-primary))",
            borderWidth: 2,
          },
        },
      ],
    };
  }, [chartData, variant, showLabels, labelThreshold, showLegend, legendPosition, total, formatValue, showPercentage]);

  const handleEvents = React.useMemo(() => {
    if (!onSliceClick) return undefined;
    return {
      click: (params: any) => {
        const percent = (params.value / total) * 100;
        onSliceClick({
          name: params.name,
          value: params.value,
          percent,
        });
      },
    };
  }, [onSliceClick, total]);

  return (
    <EChartsBase
      option={option}
      height={height}
      className={className}
      isLoading={isLoading}
      onEvents={handleEvents}
    />
  );
};
