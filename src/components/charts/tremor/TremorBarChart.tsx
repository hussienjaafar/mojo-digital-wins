import * as React from "react";
import { BarChart } from "@tremor/react";
import { cn } from "@/lib/utils";
import { type TremorColor, defaultValueFormatter } from "./TremorAreaChart";

export interface TremorBarChartProps {
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
  allowDecimals?: boolean;
  layout?: "vertical" | "horizontal";
  stack?: boolean;
  relative?: boolean;
  barCategoryGap?: string | number;
  minValue?: number;
  maxValue?: number;
  height?: string | number;
  className?: string;
  ariaLabel?: string;
  onValueChange?: (value: unknown) => void;
}

// Ratio formatter for ROAS/ROI
export const ratioFormatter = (value: number): string => `${value.toFixed(1)}x`;

export const TremorBarChart: React.FC<TremorBarChartProps> = ({
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
  allowDecimals = true,
  layout = "vertical",
  stack = false,
  relative = false,
  barCategoryGap = "10%",
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
      aria-label={ariaLabel || `Bar chart showing ${categories.join(", ")}`}
    >
      <BarChart
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
        allowDecimals={allowDecimals}
        layout={layout}
        stack={stack}
        relative={relative}
        barCategoryGap={barCategoryGap}
        minValue={minValue}
        maxValue={maxValue}
        onValueChange={onValueChange}
        className="h-full"
      />
    </div>
  );
};

TremorBarChart.displayName = "TremorBarChart";
