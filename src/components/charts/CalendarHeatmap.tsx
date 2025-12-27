import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { cn } from "@/lib/utils";
import { cssVar, colors } from "@/lib/design-tokens";

export interface HeatmapDataPoint {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  value: number;
}

export interface CalendarHeatmapProps {
  data: HeatmapDataPoint[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  valueLabel?: string;
  valueType?: "number" | "currency" | "percent";
  colorScheme?: "blue" | "green" | "purple" | "orange";
  /** Compact mode for mobile: reduced label density */
  compact?: boolean;
  onCellClick?: (point: HeatmapDataPoint) => void;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabels = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

// Color schemes using design system tokens
const colorSchemes = {
  blue: [cssVar(colors.bg.tertiary), cssVar(colors.accent.blue)],
  green: [cssVar(colors.bg.tertiary), cssVar(colors.status.success)],
  purple: [cssVar(colors.bg.tertiary), cssVar(colors.accent.purple)],
  orange: [cssVar(colors.bg.tertiary), cssVar(colors.status.warning)],
};

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  data,
  height = 280,
  className,
  isLoading = false,
  valueLabel = "Value",
  valueType = "number",
  colorScheme = "blue",
  compact = false,
  onCellClick,
}) => {
  const formatValue = React.useCallback((value: number) => {
    if (valueType === "currency") {
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    }
    if (valueType === "percent") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }, [valueType]);

  // Transform data for ECharts heatmap
  const heatmapData = React.useMemo(() => {
    return data.map(d => [d.hour, d.dayOfWeek, d.value || 0]);
  }, [data]);

  // Use p95 percentile to cap outliers and improve color distribution
  const maxValue = React.useMemo(() => {
    const positiveValues = data.map(d => d.value).filter(v => v > 0).sort((a, b) => a - b);
    if (positiveValues.length === 0) return 1;
    const p95Index = Math.floor(positiveValues.length * 0.95);
    return positiveValues[Math.min(p95Index, positiveValues.length - 1)] || 1;
  }, [data]);

  const option = React.useMemo<EChartsOption>(() => ({
    animation: true,
    tooltip: {
      position: "top",
      formatter: (params: any) => {
        const [hour, day, value] = params.data;
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${dayLabels[day]} at ${hourLabels[hour]}
          </div>
          <div>${valueLabel}: <strong>${formatValue(value)}</strong></div>
        `;
      },
    },
    grid: {
      left: compact ? 40 : 50,
      right: compact ? 12 : 20,
      top: 20,
      bottom: compact ? 50 : 60,
    },
    xAxis: {
      type: "category",
      data: hourLabels,
      position: "bottom",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: compact ? 9 : 10,
        interval: compact ? 3 : 2,
      },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: dayLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: compact ? 10 : 11,
      },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: {
        color: colorSchemes[colorScheme],
      },
      textStyle: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 10,
      },
      formatter: (value: number) => formatValue(value),
    },
    series: [
      {
        name: valueLabel,
        type: "heatmap",
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.3)",
          },
        },
        itemStyle: {
          borderRadius: 3,
          borderWidth: 1,
          borderColor: cssVar(colors.border.default),
        },
      },
    ],
  }), [heatmapData, maxValue, colorScheme, valueLabel, formatValue, compact]);

  const handleEvents = React.useMemo(() => {
    if (!onCellClick) return undefined;
    return {
      click: (params: any) => {
        if (params.data) {
          const [hour, dayOfWeek, value] = params.data;
          onCellClick({ hour, dayOfWeek, value });
        }
      },
    };
  }, [onCellClick]);

  return (
    <div className={cn("w-full", className)}>
      <EChartsBase
        option={option}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
    </div>
  );
};

CalendarHeatmap.displayName = "CalendarHeatmap";
