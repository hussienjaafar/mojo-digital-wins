import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { formatCurrency, formatNumber, formatCompact } from "@/lib/chart-formatters";

export interface CombinationSeriesConfig {
  dataKey: string;
  name: string;
  type: "bar" | "line";
  color: string;
  yAxisIndex?: 0 | 1;
  valueType?: "number" | "currency";
  smooth?: boolean;
  showSymbol?: boolean;
  lineWidth?: number;
  barOpacity?: number;
}

export interface EChartsCombinationChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: CombinationSeriesConfig[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  dualYAxis?: boolean;
  yAxisNameLeft?: string;
  yAxisNameRight?: string;
  yAxisValueTypeLeft?: "number" | "currency";
  yAxisValueTypeRight?: "number" | "currency";
  showLegend?: boolean;
  animationDuration?: number;
}

export const EChartsCombinationChart: React.FC<EChartsCombinationChartProps> = ({
  data,
  xAxisKey,
  series,
  height = 300,
  className,
  isLoading = false,
  dualYAxis = false,
  yAxisNameLeft,
  yAxisNameRight,
  yAxisValueTypeLeft = "number",
  yAxisValueTypeRight = "currency",
  showLegend = true,
  animationDuration = 500,
}) => {
  const option = React.useMemo<EChartsOption>(() => {
    const xAxisData = data.map((item) => String(item[xAxisKey] ?? ""));

    // Formatter functions
    const formatLeftAxis = (value: number) => {
      if (yAxisValueTypeLeft === "currency") {
        return formatCurrency(value, true);
      }
      return formatCompact(value);
    };

    const formatRightAxis = (value: number) => {
      if (yAxisValueTypeRight === "currency") {
        return formatCurrency(value, true);
      }
      return formatCompact(value);
    };

    // Build Y-axes
    const yAxis: EChartsOption["yAxis"] = [
      {
        type: "value",
        name: yAxisNameLeft,
        nameLocation: "end",
        nameTextStyle: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
          padding: [0, 0, 0, 0],
        },
        position: "left",
        axisLine: {
          show: true,
          lineStyle: { color: "hsl(var(--portal-border))" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
          formatter: formatLeftAxis,
        },
        splitLine: {
          lineStyle: {
            color: "hsl(var(--portal-border))",
            type: "dashed",
            opacity: 0.5,
          },
        },
      },
    ];

    if (dualYAxis) {
      // Find the color of the first series using the right axis
      const rightAxisSeries = series.find((s) => s.yAxisIndex === 1);
      const rightAxisColor = rightAxisSeries?.color || "hsl(var(--portal-text-muted))";

      yAxis.push({
        type: "value",
        name: yAxisNameRight,
        nameLocation: "end",
        nameTextStyle: {
          color: rightAxisColor,
          fontSize: 11,
          padding: [0, 0, 0, 0],
        },
        position: "right",
        axisLine: {
          show: true,
          lineStyle: { color: rightAxisColor, opacity: 0.5 },
        },
        axisTick: { show: false },
        axisLabel: {
          color: rightAxisColor,
          fontSize: 11,
          formatter: formatRightAxis,
        },
        splitLine: { show: false },
      });
    }

    // Build series configurations
    const seriesConfig = series.map((s) => {
      const seriesData = data.map((item) => {
        const value = item[s.dataKey];
        return typeof value === "number" ? value : 0;
      });

      if (s.type === "bar") {
        return {
          name: s.name,
          type: "bar" as const,
          data: seriesData,
          yAxisIndex: s.yAxisIndex ?? 0,
          itemStyle: {
            color: s.color,
            opacity: s.barOpacity ?? 0.7,
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 40,
          emphasis: {
            itemStyle: {
              opacity: 1,
            },
          },
        };
      }

      // Line series
      return {
        name: s.name,
        type: "line" as const,
        data: seriesData,
        yAxisIndex: s.yAxisIndex ?? 0,
        smooth: s.smooth ?? true,
        showSymbol: s.showSymbol ?? true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: s.lineWidth ?? 2.5,
          color: s.color,
        },
        itemStyle: {
          color: s.color,
          borderWidth: 2,
          borderColor: "hsl(var(--portal-bg-elevated))",
        },
        emphasis: {
          scale: 1.5,
        },
        z: 10, // Lines above bars
      };
    });

    // Tooltip formatter
    const tooltipFormatter = (params: unknown) => {
      const paramArray = Array.isArray(params) ? params : [params];
      if (paramArray.length === 0) return "";

      const firstParam = paramArray[0] as { axisValue?: string };
      let html = `<div style="font-weight: 600; margin-bottom: 8px;">${firstParam.axisValue || ""}</div>`;

      paramArray.forEach((param: unknown) => {
        const p = param as {
          marker?: string;
          seriesName?: string;
          value?: number;
        };
        const seriesInfo = series.find((s) => s.name === p.seriesName);
        const value = p.value ?? 0;
        
        let formattedValue: string;
        if (seriesInfo?.valueType === "currency") {
          formattedValue = formatCurrency(value);
        } else {
          formattedValue = formatNumber(value);
        }

        html += `
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            ${p.marker || ""}
            <span style="flex: 1;">${p.seriesName}</span>
            <span style="font-weight: 600;">${formattedValue}</span>
          </div>
        `;
      });

      return html;
    };

    return {
      animation: true,
      animationDuration,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: "rgba(150, 150, 150, 0.1)",
          },
        },
        formatter: tooltipFormatter,
      },
      legend: showLegend
        ? {
            show: true,
            bottom: 0,
            left: "center",
            itemWidth: 12,
            itemHeight: 12,
            itemGap: 20,
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 12,
            },
          }
        : undefined,
      grid: {
        left: 12,
        right: dualYAxis ? 12 : 12,
        top: 40,
        bottom: showLegend ? 40 : 12,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xAxisData,
        axisLine: {
          lineStyle: { color: "hsl(var(--portal-border))" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
        },
      },
      yAxis,
      series: seriesConfig,
    };
  }, [
    data,
    xAxisKey,
    series,
    dualYAxis,
    yAxisNameLeft,
    yAxisNameRight,
    yAxisValueTypeLeft,
    yAxisValueTypeRight,
    showLegend,
    animationDuration,
  ]);

  return (
    <EChartsBase
      option={option}
      height={height}
      className={className}
      isLoading={isLoading}
    />
  );
};

EChartsCombinationChart.displayName = "EChartsCombinationChart";
