import React, { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "@/components/charts/echarts/EChartsBase";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { formatHourDisplay, type HourlyMetric } from "@/hooks/useHourlyMetrics";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface HourlyBreakdownChartProps {
  data: HourlyMetric[];
  currentHour?: number;
  isLive?: boolean;
  height?: number | string;
  className?: string;
}

// ============================================================================
// HourlyBreakdownChart Component
// ============================================================================

export const HourlyBreakdownChart: React.FC<HourlyBreakdownChartProps> = ({
  data,
  currentHour = -1,
  isLive = false,
  height = 280,
  className,
}) => {
  const option = useMemo<EChartsOption>(() => {
    const hours = data.map((d) => formatHourDisplay(d.hour));
    const amounts = data.map((d) => d.gross_amount);
    const counts = data.map((d) => d.donation_count);

    // Highlight current hour with different color
    const barColors = data.map((d) => {
      if (isLive && d.hour === currentHour) {
        return "hsl(var(--portal-success))"; // Current hour in live mode
      }
      if (d.hour < currentHour || !isLive) {
        return "hsl(var(--portal-accent-blue))"; // Past hours or static view
      }
      return "hsl(var(--portal-accent-blue) / 0.3)"; // Future hours (dimmed)
    });

    return {
      animation: true,
      animationDuration: 400,
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
        borderColor: "hsl(var(--portal-border) / 0.5)",
        borderWidth: 1,
        padding: 12,
        extraCssText: `
          border-radius: 8px;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `,
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const hourData = data[idx];
          
          const isCurrentHour = isLive && hourData.hour === currentHour;
          const hourLabel = formatHourDisplay(hourData.hour);
          
          return `
            <div style="font-weight: 600; margin-bottom: 8px; color: hsl(var(--portal-text-primary));">
              ${hourLabel}${isCurrentHour ? " (now)" : ""}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0;">
              <span style="color: hsl(var(--portal-text-muted));">Amount</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">${formatCurrency(hourData.gross_amount, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0;">
              <span style="color: hsl(var(--portal-text-muted));">Donations</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">${formatNumber(hourData.donation_count, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0;">
              <span style="color: hsl(var(--portal-text-muted));">Avg Gift</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">${formatCurrency(hourData.avg_donation, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0;">
              <span style="color: hsl(var(--portal-text-muted));">Unique Donors</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">${formatNumber(hourData.unique_donors, false)}</span>
            </div>
          `;
        },
      },
      grid: {
        left: 12,
        right: 12,
        top: 20,
        bottom: 40,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: hours,
        axisLine: {
          lineStyle: { color: "hsl(var(--portal-border))" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "hsl(var(--portal-text-muted))",
          fontSize: 10,
          interval: 2, // Show every 3rd label to avoid crowding
          rotate: 0,
        },
      },
      yAxis: [
        {
          type: "value",
          position: "left",
          axisLabel: {
            formatter: (value: number) => formatCurrency(value, true),
            color: "hsl(var(--portal-text-muted))",
            fontSize: 10,
          },
          splitLine: {
            lineStyle: {
              color: "hsl(var(--portal-border))",
              type: "dashed",
            },
          },
        },
      ],
      series: [
        {
          name: "Amount",
          type: "bar",
          data: amounts.map((val, idx) => ({
            value: val,
            itemStyle: {
              color: barColors[idx],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 24,
          emphasis: {
            itemStyle: {
              color: "hsl(var(--portal-accent-blue))",
            },
          },
        },
        // Secondary line for donation count (optional visual)
        {
          name: "Donations",
          type: "line",
          yAxisIndex: 0,
          data: counts.map((c, idx) => ({
            // Scale to match amount axis roughly
            value: amounts[idx] > 0 ? (c / Math.max(...counts)) * Math.max(...amounts) * 0.8 : 0,
          })),
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: "hsl(var(--portal-accent-purple))",
            width: 2,
            type: "dashed",
            opacity: 0.6,
          },
          // Hide from tooltip since we show it manually
          tooltip: { show: false },
        },
      ],
    };
  }, [data, currentHour, isLive]);

  // Handle empty state
  if (!data || data.length === 0) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center",
          "text-[hsl(var(--portal-text-muted))]",
          className
        )}
        style={{ height }}
      >
        <p>No hourly data available</p>
      </div>
    );
  }

  return (
    <EChartsBase
      option={option}
      height={height}
      className={className}
      isLoading={false}
    />
  );
};

export default HourlyBreakdownChart;
