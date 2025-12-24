import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { useChartInteractionStore } from "@/stores/chartInteractionStore";
import { getChartColors } from "@/lib/design-tokens";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/chart-formatters";

export type BarValueFormatType = "number" | "currency" | "percent";

/** ECharts callback params for bar chart events */
interface EChartsBarParams {
  dataIndex: number;
  seriesName: string;
  value: number | { value: number };
  color: string;
  axisValue: string;
}

export interface BarSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  stack?: string;
  yAxisIndex?: number;
  /** Per-series value type for tooltip formatting */
  valueType?: BarValueFormatType;
}

export interface EChartsBarChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: BarSeriesConfig[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueType?: BarValueFormatType;
  /** Value type for axis labels (defaults to valueType) */
  axisValueType?: BarValueFormatType;
  /** Custom formatter for category axis labels (for truncation) */
  xAxisLabelFormatter?: (value: string) => string;
  horizontal?: boolean;
  enableCrossHighlight?: boolean;
  /** Disable hover emphasis to prevent bars from disappearing on hover */
  disableHoverEmphasis?: boolean;
  onBarClick?: (params: { dataIndex: number; seriesName: string; value: unknown; name: string }) => void;
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
  axisValueType,
  xAxisLabelFormatter,
  horizontal = false,
  enableCrossHighlight = false,
  disableHoverEmphasis = false,
  onBarClick,
}) => {
  const { setHoveredDataPoint, hoveredDataPoint } = useChartInteractionStore();

  // Build a map of series name to per-series valueType for tooltip formatting
  const seriesValueTypeMap = React.useMemo(() => {
    const map = new Map<string, BarValueFormatType>();
    series.forEach((s) => {
      if (s.valueType) {
        map.set(s.name, s.valueType);
      }
    });
    return map;
  }, [series]);

  // Compact formatter for axis labels
  const formatAxisValue = React.useCallback((value: number) => {
    const type = axisValueType ?? valueType;
    if (type === "currency") {
      return formatCurrency(value, true); // compact=true
    }
    if (type === "percent") {
      return formatPercent(value, 0);
    }
    return formatNumber(value, true); // compact=true
  }, [axisValueType, valueType]);

  // Full precision formatter for tooltip (uses per-series type if available)
  const formatTooltipValue = React.useCallback((value: number, seriesName?: string) => {
    const seriesType = seriesName ? seriesValueTypeMap.get(seriesName) : undefined;
    const type = seriesType ?? valueType;
    if (type === "currency") {
      return formatCurrency(value, false); // compact=false -> $12,345
    }
    if (type === "percent") {
      return formatPercent(value, 1);
    }
    return formatNumber(value, false); // compact=false -> 12,345
  }, [seriesValueTypeMap, valueType]);

  const option = React.useMemo<EChartsOption>(() => {
    const xAxisData = data.map((d) => d[xAxisKey]);

    const seriesConfig = series.map((s, index) => ({
      name: s.name,
      type: "bar" as const,
      data: data.map((d) => {
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
      emphasis: disableHoverEmphasis
        ? { disabled: true }
        : {
            focus: "series" as const,
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
      // Prevent bars from dimming when other bars are hovered
      ...(disableHoverEmphasis && {
        blur: { itemStyle: { opacity: 1 } },
      }),
    }));

    const axisConfig = {
      axisLine: {
        lineStyle: { color: "hsl(var(--portal-border))" },
      },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 11,
        ...(xAxisLabelFormatter && {
          formatter: xAxisLabelFormatter,
        }),
      },
    };

    const valueAxisConfig = {
      type: "value" as const,
      axisLabel: {
        formatter: (value: number) => formatAxisValue(value),
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
      axisLine: axisConfig.axisLine,
      axisTick: axisConfig.axisTick,
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 11,
        ...(xAxisLabelFormatter && {
          formatter: xAxisLabelFormatter,
        }),
      },
    };

    return {
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      ...(disableHoverEmphasis && {
        axisPointer: { triggerEmphasis: false },
      }),
      tooltip: showTooltip
        ? {
            trigger: "axis",
            confine: true,
            backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
            borderColor: "hsl(var(--portal-border) / 0.5)",
            borderWidth: 1,
            padding: 12,
            extraCssText: `
              border-radius: 8px;
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px hsl(var(--portal-border) / 0.1);
            `,
            axisPointer: disableHoverEmphasis
              ? { type: "none" }
              : { type: "shadow" },
            formatter: (params: EChartsBarParams | EChartsBarParams[]) => {
              const items = Array.isArray(params) ? params : [params];
              if (items.length === 0) return "";
              const header = `<div style="font-weight: 600; margin-bottom: 8px; color: hsl(var(--portal-text-primary)); font-size: 13px;">${items[0].axisValue}</div>`;
              const rows = items
                .map((p) => {
                  const val = typeof p.value === 'object' ? p.value.value : p.value;
                  return `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                    <span style="width: 8px; height: 8px; border-radius: 2px; background: ${p.color};"></span>
                    <span style="flex: 1; color: hsl(var(--portal-text-muted)); font-size: 12px;">${p.seriesName}</span>
                    <span style="font-weight: 600; color: hsl(var(--portal-text-primary)); font-size: 13px;">${formatTooltipValue(val, p.seriesName)}</span>
                  </div>`;
                })
                .join("");
              return header + rows;
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
  }, [data, xAxisKey, series, showLegend, showTooltip, horizontal, formatAxisValue, formatTooltipValue, xAxisLabelFormatter, enableCrossHighlight, disableHoverEmphasis, hoveredDataPoint]);

  const handleEvents = React.useMemo(() => {
    const events: Record<string, (params: EChartsBarParams) => void> = {};

    events.mouseover = (params: EChartsBarParams) => {
      if (enableCrossHighlight && params.dataIndex !== undefined) {
        const dataPoint = data[params.dataIndex];
        setHoveredDataPoint({
          date: dataPoint[xAxisKey] as string,
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
      events.click = (params: EChartsBarParams) => {
        if (params.dataIndex !== undefined) {
          onBarClick({
            dataIndex: params.dataIndex,
            seriesName: params.seriesName,
            value: params.value,
            name: data[params.dataIndex][xAxisKey] as string,
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
