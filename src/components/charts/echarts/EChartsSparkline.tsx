import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type SparklineValueType = "currency" | "percent" | "number" | "multiplier";

export interface SparklineDataPoint {
  date?: string;
  value: number;
}

export interface EChartsSparklineProps {
  /** Data points - can be array of numbers or objects with value */
  data: SparklineDataPoint[] | number[];
  /** Line/area color */
  color?: string;
  /** How to format values in tooltip */
  valueType?: SparklineValueType;
  /** Show area fill under line */
  showArea?: boolean;
  /** Chart height in pixels */
  height?: number;
  /** Accessibility label */
  ariaLabel?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Format value based on type for tooltip display
 */
const formatValue = (value: number, valueType: SparklineValueType): string => {
  switch (valueType) {
    case "currency":
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "multiplier":
      return `${value.toFixed(1)}x`;
    case "number":
    default:
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toLocaleString();
  }
};

/**
 * Lightweight ECharts sparkline component optimized for KPI cards.
 * Minimal configuration with no axis, no legend, no grid.
 */
export const EChartsSparkline: React.FC<EChartsSparklineProps> = ({
  data,
  color = "hsl(var(--portal-accent-blue))",
  valueType = "number",
  showArea = false,
  height = 40,
  ariaLabel = "Sparkline chart",
  isLoading = false,
  className,
}) => {
  // Normalize data to consistent format
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

  // Build ECharts option
  const option = React.useMemo<EChartsOption>(() => {
    if (normalizedData.length < 2) return {};

    return {
      animation: true,
      animationDuration: 300,
      grid: {
        left: 0,
        right: 0,
        top: 2,
        bottom: 2,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        show: false,
        data: normalizedData.map((d) => d.date || ""),
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        show: false,
        min: (value: { min: number }) => value.min * 0.95,
        max: (value: { max: number }) => value.max * 1.05,
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: "hsl(var(--portal-bg-tertiary))",
        borderColor: "hsl(var(--portal-border))",
        textStyle: {
          color: "hsl(var(--portal-text-primary))",
          fontSize: 11,
        },
        extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 6px; padding: 4px 8px;",
        formatter: (params: any) => {
          if (!params || !params[0]) return "";
          const point = params[0];
          const value = point.value as number;
          const date = point.axisValue as string;
          return `<span style="font-weight:500">${formatValue(value, valueType)}</span> <span style="color:hsl(var(--portal-text-muted));margin-left:4px">${date}</span>`;
        },
        axisPointer: {
          type: "none",
        },
      },
      series: [
        {
          type: "line",
          data: normalizedData.map((d) => d.value),
          smooth: true,
          symbol: "none",
          lineStyle: {
            color,
            width: 2,
          },
          emphasis: {
            disabled: true,
          },
          ...(showArea && {
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: color.replace(")", "/0.3)").replace("hsl", "hsla") },
                  { offset: 1, color: color.replace(")", "/0.05)").replace("hsl", "hsla") },
                ],
              },
            },
          }),
        },
      ],
    };
  }, [normalizedData, color, valueType, showArea]);

  if (isLoading) {
    return (
      <div
        className={cn("w-full", className)}
        style={{ height }}
        role="figure"
        aria-label={ariaLabel}
      >
        <Skeleton className="w-full h-full rounded" />
      </div>
    );
  }

  if (normalizedData.length < 2) {
    return null;
  }

  return (
    <div
      className={cn("w-full", className)}
      role="figure"
      aria-label={ariaLabel}
    >
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: "svg" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
};

EChartsSparkline.displayName = "EChartsSparkline";
