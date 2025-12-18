import * as React from "react";
import type { EChartsOption, ECharts } from "echarts";
import { EChartsBase, portalTheme } from "./EChartsBase";
import { useChartInteractionStore } from "@/stores/chartInteractionStore";
import {
  useDashboardStore,
  useHighlightedSeriesKeys,
  SERIES_TO_KPI_MAP,
  type SeriesKey,
} from "@/stores/dashboardStore";
import { format } from "date-fns";
import { getChartColors } from "@/lib/design-tokens";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/chart-formatters";

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
  /** SeriesKey for cross-highlighting with KPI cards */
  seriesKey?: SeriesKey;
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
  /** Name label for the left y-axis (only used when dualYAxis is true) */
  yAxisNameLeft?: string;
  /** Name label for the right y-axis (only used when dualYAxis is true) */
  yAxisNameRight?: string;
  anomalyMarkers?: AnomalyMarker[];
  /** Show rolling average overlay */
  showRollingAverage?: boolean;
  /** Period for rolling average calculation */
  rollingAveragePeriod?: number;
  /** Enable chart-to-KPI cross-highlighting on hover (default: false to prevent flicker) */
  enableChartToKpiHighlight?: boolean;
  onBrushEnd?: (range: { start: string; end: string }) => void;
  onDataPointClick?: (params: { dataIndex: number; seriesName: string; value: any }) => void;
}

// Use design system chart colors
const colorPalette = getChartColors();

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
  yAxisNameLeft,
  yAxisNameRight,
  anomalyMarkers = [],
  showRollingAverage = false,
  rollingAveragePeriod = 7,
  enableChartToKpiHighlight = false,
  onBrushEnd,
  onDataPointClick,
}) => {
  // Use selector-based hooks to avoid unnecessary re-renders on hover state changes
  const setHoveredDataPoint = useChartInteractionStore((s) => s.setHoveredDataPoint);
  const setSelectedTimeRange = useChartInteractionStore((s) => s.setSelectedTimeRange);
  const highlightedSeriesKeys = useHighlightedSeriesKeys();
  const setHighlightedKpiKey = useDashboardStore((s) => s.setHighlightedKpiKey);

  // Build a map of series name to seriesKey for quick lookup
  const seriesNameToKeyMap = React.useMemo(() => {
    const map = new Map<string, SeriesKey>();
    series.forEach((s) => {
      if (s.seriesKey) {
        map.set(s.name, s.seriesKey);
      }
    });
    return map;
  }, [series]);

  // Calculate rolling average for a series
  const calculateRollingAverage = React.useCallback(
    (values: number[], period: number): (number | null)[] => {
      return values.map((_, index) => {
        if (index < period - 1) return null;
        const slice = values.slice(index - period + 1, index + 1);
        const sum = slice.reduce((a, b) => a + (b || 0), 0);
        return sum / period;
      });
    },
    []
  );

  // Compact formatter for axis labels (K/M notation to avoid clutter)
  const formatAxisValue = React.useCallback((value: number) => {
    if (valueType === "currency") {
      return formatCurrency(value, true); // compact=true
    }
    if (valueType === "percent") {
      return formatPercent(value, 0);
    }
    return formatNumber(value, true); // compact=true
  }, [valueType]);

  // Full precision formatter for tooltip (enterprise-grade with separators)
  const formatTooltipValue = React.useCallback((value: number) => {
    if (valueType === "currency") {
      return formatCurrency(value, false); // compact=false → $12,345
    }
    if (valueType === "percent") {
      return formatPercent(value, 1);
    }
    return formatNumber(value, false); // compact=false → 12,345
  }, [valueType]);

  const option = React.useMemo<EChartsOption>(() => {
    const xAxisData = data.map((d) => d[xAxisKey]);

    const seriesConfig = series.flatMap((s, index) => {
      const baseColor = s.color || colorPalette[index % colorPalette.length];
      const seriesData = data.map((d) => d[s.dataKey]);

      // Determine if this series should be dimmed based on highlighted KPI
      const seriesKey = s.seriesKey;
      const isHighlightActive = highlightedSeriesKeys.length > 0;
      const isDimmed = isHighlightActive && seriesKey && !highlightedSeriesKeys.includes(seriesKey);

      // Apply dimming opacity
      const lineOpacity = isDimmed ? 0.2 : 1;
      const areaOpacity = isDimmed ? 0.02 : (s.areaStyle?.opacity ?? 0.1);

      const mainSeries = {
        name: s.name,
        type: "line" as const,
        data: seriesData,
        smooth: s.smooth ?? true,
        showSymbol: s.showSymbol ?? false,
        symbolSize: 6,
        itemStyle: {
          color: baseColor,
          opacity: lineOpacity,
        },
        lineStyle: {
          width: s.lineStyle?.width ?? 2,
          type: s.lineStyle?.type ?? "solid",
          color: baseColor,
          opacity: lineOpacity,
        },
        ...(s.type === "area" && {
          areaStyle: {
            opacity: areaOpacity,
            color: baseColor,
          },
        }),
        stack: s.stack,
        yAxisIndex: s.yAxisIndex ?? 0,
        // Disable emphasis entirely to prevent lines from disappearing on axis hover
        // KPI→chart dimming still works via direct opacity control (highlightedSeriesKeys)
        emphasis: {
          disabled: true,
        },
      };

      // Add rolling average series if enabled
      if (showRollingAverage) {
        const rollingData = calculateRollingAverage(
          seriesData.map((v) => (typeof v === "number" ? v : 0)),
          rollingAveragePeriod
        );
        
        const rollingSeries = {
          name: `${s.name} (${rollingAveragePeriod}d avg)`,
          type: "line" as const,
          data: rollingData,
          smooth: true,
          showSymbol: false,
          itemStyle: {
            color: baseColor,
          },
          lineStyle: {
            width: 2,
            type: "dashed" as const,
            color: baseColor,
            opacity: 0.6,
          },
          yAxisIndex: s.yAxisIndex ?? 0,
          emphasis: {
            disabled: true,
          },
        };

        return [mainSeries, rollingSeries];
      }

      return [mainSeries];
    });

    const yAxes = dualYAxis
      ? [
          {
            type: "value" as const,
            position: "left" as const,
            ...(yAxisNameLeft && {
              name: yAxisNameLeft,
              nameLocation: "middle" as const,
              nameGap: 50,
              nameTextStyle: {
                color: "hsl(var(--portal-text-secondary))",
                fontSize: 12,
                fontWeight: 500,
              },
            }),
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
            ...yAxisConfig,
          },
          {
            type: "value" as const,
            position: "right" as const,
            ...(yAxisNameRight && {
              name: yAxisNameRight,
              nameLocation: "middle" as const,
              nameGap: 50,
              nameTextStyle: {
                color: "hsl(var(--portal-text-secondary))",
                fontSize: 12,
                fontWeight: 500,
              },
            }),
            axisLabel: {
              formatter: (value: number) => formatAxisValue(value),
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
              formatter: (value: number) => formatAxisValue(value),
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
      // Top-level axisPointer config - this is where ECharts reads triggerEmphasis
      // (tooltip.axisPointer does not propagate this setting)
      axisPointer: {
        triggerEmphasis: false,
      },
      tooltip: showTooltip
        ? {
            trigger: "axis",
            confine: true, // Keep tooltip within chart bounds to prevent overlaying external UI
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
                      <span style="font-weight: 600;">${formatTooltipValue(p.value)}</span>
                    </div>`
                )
                .join("");
              return header + items;
            },
          }
        : undefined,
      legend: showLegend
        ? {
            type: "scroll" as const,
            data: series.map((s) => s.name),
            bottom: 0,
            left: "center",
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 11,
            },
            icon: "roundRect",
            itemWidth: 12,
            itemHeight: 3,
            itemGap: 16,
            pageButtonItemGap: 8,
            pageIconColor: "hsl(var(--portal-text-secondary))",
            pageIconInactiveColor: "hsl(var(--portal-text-muted))",
            pageTextStyle: {
              color: "hsl(var(--portal-text-muted))",
              fontSize: 10,
            },
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
  }, [data, xAxisKey, series, showLegend, showTooltip, showZoom, showBrush, valueType, xAxisType, yAxisConfig, dualYAxis, yAxisNameLeft, yAxisNameRight, formatAxisValue, formatTooltipValue, showRollingAverage, rollingAveragePeriod, calculateRollingAverage, highlightedSeriesKeys]);

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

        // Cross-highlight KPI cards when hovering chart series (opt-in to prevent flicker)
        if (enableChartToKpiHighlight) {
          const seriesKey = seriesNameToKeyMap.get(params.seriesName);
          if (seriesKey) {
            const relatedKpis = SERIES_TO_KPI_MAP[seriesKey];
            if (relatedKpis && relatedKpis.length > 0) {
              // Highlight the first related KPI (most relevant)
              setHighlightedKpiKey(relatedKpis[0]);
            }
          }
        }
      }
    };

    events.mouseout = () => {
      setHoveredDataPoint(null);
      // Only clear KPI highlight if this chart was setting it
      if (enableChartToKpiHighlight) {
        setHighlightedKpiKey(null);
      }
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
  }, [data, xAxisKey, showBrush, onBrushEnd, onDataPointClick, setHoveredDataPoint, setSelectedTimeRange, seriesNameToKeyMap, setHighlightedKpiKey, enableChartToKpiHighlight]);

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
