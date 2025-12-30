import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { cn } from "@/lib/utils";
import { cssVar, colors } from "@/lib/design-tokens";

export interface HeatmapDataPoint {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  value: number;
}

export interface CalendarHeatmapProps {
  data: HeatmapDataPoint[];
  height?: number | string;
  className?: string;
  isLoading?: boolean;
  valueLabel?: string;
  valueType?: "number" | "currency" | "percent";
  colorScheme?: "blue" | "green" | "purple" | "orange";
  /** Compact mode for mobile: reduced label density */
  compact?: boolean;
  onCellClick?: (point: HeatmapDataPoint) => void;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabels = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

// Color schemes are resolved at runtime (CSS variables -> concrete colors) to keep ECharts gradients readable.

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  data,
  height = 280,
  className,
  isLoading = false,
  valueLabel = "Value",
  valueType = "number",
  colorScheme = "blue",
  compact = false,
  onCellClick,
}) => {
  const formatValue = React.useCallback((value: number) => {
    if (valueType === "currency") {
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    }
    if (valueType === "percent") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }, [valueType]);

  const resolveHslVar = React.useCallback((tokenName: string, alpha?: number) => {
    // ECharts' color interpolation doesn't reliably handle `var(--...)` or modern space-separated HSL.
    // Resolve portal CSS variables into comma-based hsl/hsla strings so gradients render correctly.
    if (typeof window === "undefined") return cssVar(tokenName, alpha);

    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(`--${tokenName}`)
      .trim();

    if (!raw) return cssVar(tokenName, alpha);

    // raw is typically like: "213 90% 45%" (H S L). Convert to "hsl(213, 90%, 45%)".
    const [base] = raw.split("/").map((s) => s.trim());
    const parts = base.split(/\s+/).filter(Boolean);

    if (parts.length < 3) return cssVar(tokenName, alpha);

    const [h, s, l] = parts;
    if (alpha !== undefined) return `hsla(${h}, ${s}, ${l}, ${alpha})`;
    return `hsl(${h}, ${s}, ${l})`;
  }, []);

  const colorRange = React.useMemo<string[]>(() => {
    const schemes: Record<NonNullable<CalendarHeatmapProps["colorScheme"]>, string[]> = {
      blue: [resolveHslVar(colors.bg.tertiary), resolveHslVar(colors.accent.blue)],
      green: [resolveHslVar(colors.bg.tertiary), resolveHslVar(colors.status.success)],
      purple: [resolveHslVar(colors.bg.tertiary), resolveHslVar(colors.accent.purple)],
      orange: [resolveHslVar(colors.bg.tertiary), resolveHslVar(colors.status.warning)],
    };

    return schemes[colorScheme] ?? schemes.blue;
  }, [colorScheme, resolveHslVar]);

  // Transform data for ECharts heatmap
  const heatmapData = React.useMemo(() => {
    return data.map((d) => [d.hour, d.dayOfWeek, d.value || 0]);
  }, [data]);

  // Use p95 percentile to cap outliers and improve color distribution
  const maxValue = React.useMemo(() => {
    const positiveValues = data.map(d => d.value).filter(v => v > 0).sort((a, b) => a - b);
    if (positiveValues.length === 0) return 1;
    const p95Index = Math.floor(positiveValues.length * 0.95);
    return positiveValues[Math.min(p95Index, positiveValues.length - 1)] || 1;
  }, [data]);

  const option = React.useMemo<EChartsOption>(() => ({
    animation: true,
    tooltip: {
      position: "top",
      formatter: (params: any) => {
        const [hour, day, value] = params.data;
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${dayLabels[day]} at ${hourLabels[hour]}
          </div>
          <div>${valueLabel}: <strong>${formatValue(value)}</strong></div>
        `;
      },
    },
    grid: {
      left: compact ? 40 : 50,
      right: compact ? 12 : 20,
      top: 20,
      bottom: compact ? 50 : 60,
    },
    xAxis: {
      type: "category",
      data: hourLabels,
      position: "bottom",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: compact ? 9 : 10,
        interval: compact ? 3 : 2,
      },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: dayLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: compact ? 10 : 11,
      },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: {
        color: colorRange,
      },
      textStyle: {
        color: "hsl(var(--portal-text-muted))",
        fontSize: 10,
      },
      formatter: (value: number) => formatValue(value),
    },
    series: [
      {
        name: valueLabel,
        type: "heatmap",
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.3)",
          },
        },
        itemStyle: {
          borderRadius: 3,
          borderWidth: 1,
          borderColor: cssVar(colors.border.default),
        },
      },
    ],
  }), [heatmapData, maxValue, colorRange, valueLabel, formatValue, compact]);

  const handleEvents = React.useMemo(() => {
    if (!onCellClick) return undefined;
    return {
      click: (params: any) => {
        if (params.data) {
          const [hour, dayOfWeek, value] = params.data;
          onCellClick({ hour, dayOfWeek, value });
        }
      },
    };
  }, [onCellClick]);

  // Generate accessible summary for screen readers
  const totalValue = React.useMemo(() => 
    data.reduce((sum, d) => sum + d.value, 0), [data]
  );
  
  const peakCell = React.useMemo(() => {
    if (data.length === 0) return null;
    const peak = data.reduce((max, d) => d.value > max.value ? d : max, data[0]);
    return { day: dayLabels[peak.dayOfWeek], hour: hourLabels[peak.hour], value: peak.value };
  }, [data]);

  const accessibleSummary = React.useMemo(() => {
    if (!peakCell) return `${valueLabel} heatmap with no data.`;
    return `${valueLabel} heatmap showing activity by day and hour. Peak activity: ${formatValue(peakCell.value)} on ${peakCell.day} at ${peakCell.hour}. Total: ${formatValue(totalValue)}.`;
  }, [valueLabel, peakCell, totalValue, formatValue]);

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Screen reader summary */}
      <div className="sr-only" role="img" aria-label={accessibleSummary}>
        {accessibleSummary}
      </div>
      
      <EChartsBase
        option={option}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
      
      {/* Visual legend explanation */}
      <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 1].map((opacity, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: `hsl(var(--portal-accent-${colorScheme === 'blue' ? 'blue' : colorScheme === 'green' ? 'green' : colorScheme === 'purple' ? 'purple' : 'amber'}) / ${opacity})`,
                border: '1px solid hsl(var(--portal-border))',
              }}
              aria-hidden="true"
            />
          ))}
        </div>
        <span>More</span>
        {peakCell && (
          <span className="ml-2 text-[hsl(var(--portal-text-secondary))]">
            Peak: {peakCell.day} {peakCell.hour}
          </span>
        )}
      </div>
    </div>
  );
};

CalendarHeatmap.displayName = "CalendarHeatmap";
