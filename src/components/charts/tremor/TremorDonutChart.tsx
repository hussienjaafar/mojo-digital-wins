import * as React from "react";
import { DonutChart } from "@tremor/react";
import { cn } from "@/lib/utils";
import { type TremorColor, defaultValueFormatter } from "./TremorAreaChart";

export interface DonutDataItem {
  name: string;
  value: number;
  [key: string]: unknown;
}

export interface TremorDonutChartProps {
  data: DonutDataItem[];
  category?: string;
  value?: string;
  colors?: TremorColor[];
  valueFormatter?: (value: number) => string;
  variant?: "donut" | "pie";
  label?: string;
  showLabel?: boolean;
  showAnimation?: boolean;
  animationDuration?: number;
  showTooltip?: boolean;
  height?: string | number;
  className?: string;
  ariaLabel?: string;
  onValueChange?: (value: unknown) => void;
}

export const TremorDonutChart: React.FC<TremorDonutChartProps> = ({
  data,
  category = "name",
  value = "value",
  colors = ["blue", "emerald", "violet", "amber", "rose", "slate"],
  valueFormatter = defaultValueFormatter,
  variant = "donut",
  label,
  showLabel = true,
  showAnimation = true,
  animationDuration = 400,
  showTooltip = true,
  height = 240,
  className,
  ariaLabel,
  onValueChange,
}) => {
  const chartHeight = typeof height === "number" ? `${height}px` : height;

  // Calculate total for center label if not provided
  const total = React.useMemo(() => {
    if (label) return label;
    const sum = data.reduce((acc, item) => acc + (Number(item[value]) || 0), 0);
    return valueFormatter(sum);
  }, [data, value, label, valueFormatter]);

  return (
    <div
      className={cn("w-full flex items-center justify-center", className)}
      style={{ height: chartHeight }}
      role="figure"
      aria-label={ariaLabel || `Donut chart showing ${data.map((d) => d[category]).join(", ")}`}
    >
      <DonutChart
        data={data}
        category={category}
        index={value}
        colors={colors}
        valueFormatter={valueFormatter}
        variant={variant}
        label={showLabel ? total : undefined}
        showLabel={showLabel}
        showAnimation={showAnimation}
        animationDuration={animationDuration}
        showTooltip={showTooltip}
        onValueChange={onValueChange}
        className="h-full"
      />
    </div>
  );
};

TremorDonutChart.displayName = "TremorDonutChart";
