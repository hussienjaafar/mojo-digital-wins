import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { useChartInteractionStore } from "@/stores/chartInteractionStore";
import { getChartColors } from "@/lib/design-tokens";

export interface BarSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  stack?: string;
  yAxisIndex?: number;
}

export interface EChartsBarChartProps {
  data: Record<string, any>[];
  xAxisKey: string;
  series: BarSeriesConfig[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueType?: "number" | "currency" | "percent";
  horizontal?: boolean;
  enableCrossHighlight?: boolean;
  onBarClick?: (params: { dataIndex: number; seriesName: string; value: any; name: string }) => void;
}

// Use design system chart colors
const colorPalette = getChartColors();

export const EChartsBarChart: React.FC<EChartsBarChartProps> = ({
  data,
  xAxisKey,
  series,
  height = 300,
  className,
  isLoading = false,
  showLegend = true,
  showTooltip = true,
  valueType = "number",
  horizontal = false,
  enableCrossHighlight = false,
  onBarClick,
}) => {
  const { setHoveredDataPoint, hoveredDataPoint } = useChartInteractionStore();

  const formatValue = React.useCallback((value: number) => {
    if (valueType === "currency") {
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    }
    if (valueType === "percent") {
      return `${value.toFixed(1)}%`;
    }
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  }, [valueType]);

  const option = React.useMemo<EChartsOption>(() => {
    const xAxisData = data.map((d) => d[xAxisKey]);

    const seriesConfig = series.map((s, index) => ({
      name: s.name,
      type: "bar" as const,
      data: data.map((d, i) => {
        const value = d[s.dataKey];
        const isHighlighted = enableCrossHighlight && hoveredDataPoint?.date === d[xAxisKey];
        return {
          value,
          itemStyle: {
            color: s.color || colorPalette[index % colorPalette.length],
            opacity: enableCrossHighlight && hoveredDataPoint && !isHighlighted ? 0.4 : 1,
          },
        };
      }),
      stack: s.stack,
      yAxisIndex: s.yAxisIndex ?? 0,
      barMaxWidth: 50,
      itemStyle: {
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      emphasis: {
        focus: "series" as const,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: "rgba(0, 0, 0, 0.3)",
        },
      },
    }));

    const axisConfig = {
      axisLine: {
        lineStyle: { color: "hsl(var(--portal-border))" },
      },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 11,
      },
    };

    const valueAxisConfig = {
      type: "value" as const,
      axisLabel: {
        formatter: (value: number) => formatValue(value),
        color: "hsl(var(--portal-text-muted))",
      },
      splitLine: {
        lineStyle: {
          color: "hsl(var(--portal-border))",
          type: "dashed" as const,
        },
      },
    };

    const categoryAxisConfig = {
      type: "category" as const,
      data: xAxisData,
      ...axisConfig,
    };

    return {
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      tooltip: showTooltip
        ? {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: any) => {
              if (!Array.isArray(params) || params.length === 0) return "";
              const header = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`;
              const items = params
                .map(
                  (p: any) =>
                    `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                      <span style="width: 8px; height: 8px; border-radius: 2px; background: ${p.color};"></span>
                      <span style="flex: 1;">${p.seriesName}</span>
                      <span style="font-weight: 600;">${formatValue(typeof p.value === 'object' ? p.value.value : p.value)}</span>
                    </div>`
                )
                .join("");
              return header + items;
            },
          }
        : undefined,
      legend: showLegend
        ? {
            data: series.map((s) => s.name),
            bottom: 0,
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 11,
            },
            icon: "roundRect",
            itemWidth: 12,
            itemHeight: 8,
          }
        : undefined,
      grid: {
        left: 12,
        right: 12,
        top: 20,
        bottom: showLegend ? 40 : 12,
        containLabel: true,
      },
      xAxis: horizontal ? valueAxisConfig : categoryAxisConfig,
      yAxis: horizontal ? categoryAxisConfig : valueAxisConfig,
      series: seriesConfig,
    };
  }, [data, xAxisKey, series, showLegend, showTooltip, valueType, horizontal, formatValue, enableCrossHighlight, hoveredDataPoint]);

  const handleEvents = React.useMemo(() => {
    const events: Record<string, (params: any) => void> = {};

    events.mouseover = (params: any) => {
      if (enableCrossHighlight && params.dataIndex !== undefined) {
        const dataPoint = data[params.dataIndex];
        setHoveredDataPoint({
          date: dataPoint[xAxisKey],
          series: params.seriesName,
          value: params.value,
        });
      }
    };

    events.mouseout = () => {
      if (enableCrossHighlight) {
        setHoveredDataPoint(null);
      }
    };

    if (onBarClick) {
      events.click = (params: any) => {
        if (params.dataIndex !== undefined) {
          onBarClick({
            dataIndex: params.dataIndex,
            seriesName: params.seriesName,
            value: params.value,
            name: data[params.dataIndex][xAxisKey],
          });
        }
      };
    }

    return events;
  }, [data, xAxisKey, enableCrossHighlight, onBarClick, setHoveredDataPoint]);

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

EChartsBarChart.displayName = "EChartsBarChart";
