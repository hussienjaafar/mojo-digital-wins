import * as React from "react";
import type { EChartsOption, ECharts } from "echarts";
import { EChartsBase, portalTheme } from "./EChartsBase";
import { useChartInteractionStore } from "@/stores/chartInteractionStore";
import { format } from "date-fns";

export interface LineSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  type?: "line" | "area";
  smooth?: boolean;
  showSymbol?: boolean;
  lineStyle?: {
    width?: number;
    type?: "solid" | "dashed" | "dotted";
  };
  areaStyle?: {
    opacity?: number;
  };
  stack?: string;
  yAxisIndex?: number;
}

export interface AnomalyMarker {
  index: number;
  type: "high" | "low";
  label?: string;
}

export interface EChartsLineChartProps {
  data: Record<string, any>[];
  xAxisKey: string;
  series: LineSeriesConfig[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showZoom?: boolean;
  showBrush?: boolean;
  valueType?: "number" | "currency" | "percent";
  xAxisType?: "category" | "time";
  yAxisConfig?: {
    min?: number | "auto";
    max?: number | "auto";
    splitNumber?: number;
  };
  dualYAxis?: boolean;
  anomalyMarkers?: AnomalyMarker[];
  onBrushEnd?: (range: { start: string; end: string }) => void;
  onDataPointClick?: (params: { dataIndex: number; seriesName: string; value: any }) => void;
}

const colorPalette = [
  "#0EA5E9", // blue
  "#10B981", // green
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#EF4444", // red
  "#6B7280", // gray
];

export const EChartsLineChart: React.FC<EChartsLineChartProps> = ({
  data,
  xAxisKey,
  series,
  height = 300,
  className,
  isLoading = false,
  showLegend = true,
  showTooltip = true,
  showZoom = false,
  showBrush = false,
  valueType = "number",
  xAxisType = "category",
  yAxisConfig,
  dualYAxis = false,
  anomalyMarkers = [],
  onBrushEnd,
  onDataPointClick,
}) => {
  const { setHoveredDataPoint, setSelectedTimeRange } = useChartInteractionStore();

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
      type: "line" as const,
      data: data.map((d) => d[s.dataKey]),
      smooth: s.smooth ?? true,
      showSymbol: s.showSymbol ?? false,
      symbolSize: 6,
      itemStyle: {
        color: s.color || colorPalette[index % colorPalette.length],
      },
      lineStyle: {
        width: s.lineStyle?.width ?? 2,
        type: s.lineStyle?.type ?? "solid",
        color: s.color || colorPalette[index % colorPalette.length],
      },
      ...(s.type === "area" && {
        areaStyle: {
          opacity: s.areaStyle?.opacity ?? 0.1,
          color: s.color || colorPalette[index % colorPalette.length],
        },
      }),
      stack: s.stack,
      yAxisIndex: s.yAxisIndex ?? 0,
      emphasis: {
        focus: "series" as const,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: "rgba(0, 0, 0, 0.3)",
        },
      },
    }));

    const yAxes = dualYAxis
      ? [
          {
            type: "value" as const,
            position: "left" as const,
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
            ...yAxisConfig,
          },
          {
            type: "value" as const,
            position: "right" as const,
            axisLabel: {
              formatter: (value: number) => formatValue(value),
              color: "hsl(var(--portal-text-muted))",
            },
            splitLine: {
              show: false,
            },
          },
        ]
      : [
          {
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
            ...yAxisConfig,
          },
        ];

    const result: EChartsOption = {
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      tooltip: showTooltip
        ? {
            trigger: "axis",
            axisPointer: {
              type: "cross",
              crossStyle: {
                color: "hsl(var(--portal-text-muted))",
              },
            },
            formatter: (params: any) => {
              if (!Array.isArray(params) || params.length === 0) return "";
              const header = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`;
              const items = params
                .map(
                  (p: any) =>
                    `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                      <span style="width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>
                      <span style="flex: 1;">${p.seriesName}</span>
                      <span style="font-weight: 600;">${formatValue(p.value)}</span>
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
            itemHeight: 3,
          }
        : undefined,
      grid: {
        left: 12,
        right: dualYAxis ? 60 : 12,
        top: 20,
        bottom: showLegend ? 40 : 12,
        containLabel: true,
      },
      xAxis: {
        type: xAxisType,
        data: xAxisData,
        axisLine: {
          lineStyle: {
            color: "hsl(var(--portal-border))",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 11,
        },
      },
      yAxis: yAxes,
      series: seriesConfig,
      ...(showZoom && {
        dataZoom: [
          {
            type: "inside",
            start: 0,
            end: 100,
          },
          {
            type: "slider",
            start: 0,
            end: 100,
            height: 20,
            bottom: showLegend ? 60 : 20,
            borderColor: "hsl(var(--portal-border))",
            backgroundColor: "hsl(var(--portal-bg-elevated))",
            fillerColor: "hsla(var(--portal-accent-blue), 0.2)",
            handleStyle: {
              color: "hsl(var(--portal-accent-blue))",
            },
            textStyle: {
              color: "hsl(var(--portal-text-muted))",
            },
          },
        ],
      }),
      ...(showBrush && {
        brush: {
          toolbox: ["lineX"],
          xAxisIndex: 0,
          brushStyle: {
            borderWidth: 1,
            color: "hsla(var(--portal-accent-blue), 0.2)",
            borderColor: "hsl(var(--portal-accent-blue))",
          },
        },
      }),
    };

    return result;
  }, [data, xAxisKey, series, showLegend, showTooltip, showZoom, showBrush, valueType, xAxisType, yAxisConfig, dualYAxis, formatValue]);

  const handleEvents = React.useMemo(() => {
    const events: Record<string, (params: any) => void> = {};

    events.mouseover = (params: any) => {
      if (params.dataIndex !== undefined) {
        const dataPoint = data[params.dataIndex];
        setHoveredDataPoint({
          date: dataPoint[xAxisKey],
          series: params.seriesName,
          value: params.value,
        });
      }
    };

    events.mouseout = () => {
      setHoveredDataPoint(null);
    };

    if (onDataPointClick) {
      events.click = (params: any) => {
        if (params.dataIndex !== undefined) {
          onDataPointClick({
            dataIndex: params.dataIndex,
            seriesName: params.seriesName,
            value: params.value,
          });
        }
      };
    }

    if (showBrush && onBrushEnd) {
      events.brushEnd = (params: any) => {
        if (params.areas && params.areas.length > 0) {
          const area = params.areas[0];
          if (area.coordRange) {
            const [startIdx, endIdx] = area.coordRange;
            const startDate = data[startIdx]?.[xAxisKey];
            const endDate = data[endIdx]?.[xAxisKey];
            if (startDate && endDate) {
              setSelectedTimeRange({ start: startDate, end: endDate });
              onBrushEnd({ start: startDate, end: endDate });
            }
          }
        }
      };
    }

    return events;
  }, [data, xAxisKey, showBrush, onBrushEnd, onDataPointClick, setHoveredDataPoint, setSelectedTimeRange]);

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

EChartsLineChart.displayName = "EChartsLineChart";
