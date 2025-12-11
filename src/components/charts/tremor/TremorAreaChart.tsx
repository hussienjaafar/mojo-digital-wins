import * as React from "react";
import { AreaChart } from "@tremor/react";
import { cn } from "@/lib/utils";

export type TremorColor =
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "emerald"
  | "amber"
  | "orange"
  | "red"
  | "rose"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "slate"
  | "gray"
  | "zinc"
  | "neutral"
  | "stone";

export interface TremorAreaChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories: string[];
  colors?: TremorColor[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGridLines?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showTooltip?: boolean;
  showAnimation?: boolean;
  animationDuration?: number;
  connectNulls?: boolean;
  allowDecimals?: boolean;
  fill?: "gradient" | "solid" | "none";
  type?: "default" | "stacked" | "percent";
  curveType?: "linear" | "natural" | "monotone" | "step";
  minValue?: number;
  maxValue?: number;
  height?: string | number;
  className?: string;
  ariaLabel?: string;
  onValueChange?: (value: unknown) => void;
}

// Common formatters
export const currencyFormatter = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export const percentFormatter = (value: number): string => `${value.toFixed(1)}%`;

export const compactFormatter = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

export const defaultValueFormatter = (value: number): string =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const TremorAreaChart: React.FC<TremorAreaChartProps> = ({
  data,
  index,
  categories,
  colors = ["blue", "emerald", "violet", "amber", "rose"],
  valueFormatter = defaultValueFormatter,
  showLegend = true,
  showGridLines = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  showAnimation = true,
  animationDuration = 400,
  connectNulls = false,
  allowDecimals = true,
  fill = "gradient",
  type = "default",
  curveType = "natural",
  minValue,
  maxValue,
  height = 280,
  className,
  ariaLabel,
  onValueChange,
}) => {
  const chartHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={cn("w-full", className)}
      style={{ height: chartHeight }}
      role="figure"
      aria-label={ariaLabel || `Area chart showing ${categories.join(", ")}`}
    >
      <AreaChart
        data={data}
        index={index}
        categories={categories}
        colors={colors}
        valueFormatter={valueFormatter}
        showLegend={showLegend}
        showGridLines={showGridLines}
        showXAxis={showXAxis}
        showYAxis={showYAxis}
        showTooltip={showTooltip}
        showAnimation={showAnimation}
        animationDuration={animationDuration}
        connectNulls={connectNulls}
        allowDecimals={allowDecimals}
        stack={type === "stacked" || type === "percent"}
        curveType={curveType}
        minValue={minValue}
        maxValue={maxValue}
        onValueChange={onValueChange}
        className="h-full"
      />
    </div>
  );
};

TremorAreaChart.displayName = "TremorAreaChart";
