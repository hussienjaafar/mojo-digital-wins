import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, ECharts } from "echarts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface EChartsBaseProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  onChartReady?: (chart: ECharts) => void;
  onEvents?: Record<string, (params: any) => void>;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  theme?: "light" | "dark" | object;
}

// Portal-themed ECharts colors
export const portalTheme = {
  color: [
    "hsl(var(--portal-accent-blue))",
    "hsl(var(--portal-success))",
    "hsl(var(--portal-accent-purple))",
    "hsl(var(--portal-warning))",
    "hsl(var(--portal-error))",
    "hsl(var(--portal-text-muted))",
  ],
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "inherit",
    color: "hsl(var(--portal-text-secondary))",
  },
  title: {
    textStyle: {
      color: "hsl(var(--portal-text-primary))",
      fontWeight: 600,
    },
    subtextStyle: {
      color: "hsl(var(--portal-text-muted))",
    },
  },
  legend: {
    textStyle: {
      color: "hsl(var(--portal-text-secondary))",
    },
  },
  tooltip: {
    backgroundColor: "hsl(var(--portal-bg-elevated))",
    borderColor: "hsl(var(--portal-border))",
    textStyle: {
      color: "hsl(var(--portal-text-primary))",
    },
    // Enhanced shadow for better visibility in both light and dark mode
    extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05); border-radius: 8px; backdrop-filter: blur(8px);",
  },
  grid: {
    borderColor: "hsl(var(--portal-border))",
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
      },
    },
    axisTick: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
      },
    },
    axisLabel: {
      color: "hsl(var(--portal-text-muted))",
    },
    splitLine: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
        type: "dashed",
      },
    },
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
      },
    },
    axisTick: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
      },
    },
    axisLabel: {
      color: "hsl(var(--portal-text-muted))",
    },
    splitLine: {
      lineStyle: {
        color: "hsl(var(--portal-border))",
        type: "dashed",
      },
    },
  },
};

export const EChartsBase: React.FC<EChartsBaseProps> = ({
  option,
  height = 300,
  className,
  isLoading = false,
  onChartReady,
  onEvents,
  notMerge = false,
  lazyUpdate = true,
  theme,
}) => {
  const chartRef = React.useRef<ReactECharts>(null);

  // Merge portal theme with user options
  const mergedOption = React.useMemo<EChartsOption>(() => {
    return {
      ...portalTheme,
      ...option,
      tooltip: {
        ...portalTheme.tooltip,
        ...(option.tooltip as object),
      },
      grid: {
        containLabel: true,
        left: 12,
        right: 12,
        top: 40,
        bottom: 12,
        ...portalTheme.grid,
        ...(option.grid as object),
      },
    };
  }, [option]);

  const handleChartReady = React.useCallback((chart: ECharts) => {
    onChartReady?.(chart);
  }, [onChartReady]);

  if (isLoading) {
    return (
      <div
        className={cn("w-full", className)}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <ReactECharts
        ref={chartRef}
        option={mergedOption}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        theme={theme}
        onChartReady={handleChartReady}
        onEvents={onEvents}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
};

EChartsBase.displayName = "EChartsBase";
