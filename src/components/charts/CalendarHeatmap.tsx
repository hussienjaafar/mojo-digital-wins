import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { cn } from "@/lib/utils";

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
  onCellClick?: (point: HeatmapDataPoint) => void;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabels = Array.from({ length: 24 }, (_, i) => 
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

const colorSchemes = {
  blue: ["hsl(var(--portal-bg-elevated))", "#0EA5E9"],
  green: ["hsl(var(--portal-bg-elevated))", "#10B981"],
  purple: ["hsl(var(--portal-bg-elevated))", "#8B5CF6"],
  orange: ["hsl(var(--portal-bg-elevated))", "#F59E0B"],
};

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  data,
  height = 280,
  className,
  isLoading = false,
  valueLabel = "Value",
  valueType = "number",
  colorScheme = "blue",
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

  const maxValue = React.useMemo(() => {
    return Math.max(...data.map(d => d.value), 1);
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
      left: 50,
      right: 20,
      top: 20,
      bottom: 60,
    },
    xAxis: {
      type: "category",
      data: hourLabels,
      position: "bottom",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 10,
        interval: 2,
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
        fontSize: 11,
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
          borderWidth: 2,
          borderColor: "hsl(var(--portal-bg-base))",
        },
      },
    ],
  }), [heatmapData, maxValue, colorScheme, valueLabel, formatValue]);

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
