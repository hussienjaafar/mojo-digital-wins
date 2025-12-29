import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./EChartsBase";
import { getChartColors } from "@/lib/design-tokens";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { V3EmptyState } from "@/components/v3/V3EmptyState";

export type FunnelValueFormatType = "number" | "currency" | "percent";

export interface FunnelDataItem {
  name: string;
  value: number;
  label?: string;
  color?: string;
}

export interface EChartsFunnelChartProps {
  /** Data items for the funnel (should be in descending order by value) */
  data: FunnelDataItem[];
  /** Chart height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Funnel orientation */
  orientation?: "vertical" | "horizontal";
  /** Show conversion rates between stages */
  showConversionRates?: boolean;
  /** Value format type for tooltips */
  valueType?: FunnelValueFormatType;
  /** Show legend */
  showLegend?: boolean;
  /** Click handler for funnel stages */
  onStageClick?: (params: { name: string; value: number; index: number }) => void;
  /** Empty state message */
  emptyMessage?: string;
}

const colorPalette = getChartColors();

export const EChartsFunnelChart: React.FC<EChartsFunnelChartProps> = ({
  data,
  height = 300,
  className,
  isLoading = false,
  orientation = "vertical",
  showConversionRates = true,
  valueType = "number",
  showLegend = false,
  onStageClick,
  emptyMessage = "No funnel data available",
}) => {
  // Handle empty data
  if (!isLoading && (!data || data.length === 0)) {
    return (
      <div className={className} style={{ height: typeof height === 'number' ? height : undefined }}>
        <V3EmptyState
          title={emptyMessage}
          description="There is no funnel data to display."
          accent="blue"
        />
      </div>
    );
  }

  // Handle zero-value stages - filter them out to prevent layout issues
  const validData = React.useMemo(() => 
    data.filter(item => item.value > 0),
    [data]
  );

  // Format value based on type
  const formatValue = React.useCallback((value: number) => {
    switch (valueType) {
      case "currency":
        return formatCurrency(value, false);
      case "percent":
        return formatPercent(value, 1);
      default:
        return formatNumber(value, false);
    }
  }, [valueType]);

  // Prepare chart data with colors and calculate conversion rates
  const chartData = React.useMemo(() => {
    return validData.map((item, index) => {
      const prevValue = index > 0 ? validData[index - 1].value : item.value;
      const conversionRate = prevValue > 0 ? ((item.value / prevValue) * 100).toFixed(1) : "100";
      
      return {
        name: item.label || item.name,
        value: item.value,
        conversionRate,
        itemStyle: {
          color: item.color || colorPalette[index % colorPalette.length],
        },
      };
    });
  }, [validData]);

  const option = React.useMemo<EChartsOption>(() => {
    const isHorizontal = orientation === "horizontal";

    return {
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "hsl(var(--portal-bg-secondary) / 0.95)",
        borderColor: "hsl(var(--portal-border) / 0.5)",
        borderWidth: 1,
        padding: 12,
        extraCssText: `
          border-radius: 8px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `,
        formatter: (params: any) => {
          const dataItem = chartData[params.dataIndex];
          const valueFormatted = formatValue(params.value);
          
          return `
            <div style="font-weight: 600; margin-bottom: 6px; color: hsl(var(--portal-text-primary)); font-size: 13px;">
              ${params.name}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${params.color};"></span>
              <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Count:</span>
              <span style="font-weight: 600; color: hsl(var(--portal-text-primary)); font-size: 13px;">${valueFormatted}</span>
            </div>
            ${showConversionRates && params.dataIndex > 0 ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="width: 8px;"></span>
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Conversion:</span>
                <span style="font-weight: 500; color: hsl(var(--portal-success)); font-size: 12px;">${dataItem.conversionRate}%</span>
              </div>
            ` : ""}
          `;
        },
      },
      legend: showLegend
        ? {
            orient: "horizontal",
            bottom: 0,
            left: "center",
            textStyle: {
              color: "hsl(var(--portal-text-secondary))",
              fontSize: 12,
            },
            icon: "circle",
            itemWidth: 10,
            itemHeight: 10,
          }
        : undefined,
      series: [
        {
          type: "funnel",
          left: "10%",
          top: showLegend ? 20 : 10,
          bottom: showLegend ? 40 : 20,
          width: "80%",
          min: 0,
          minSize: "10%",
          maxSize: "100%",
          sort: "descending",
          orient: orientation,
          gap: 4,
          label: {
            show: true,
            position: "inside",
            formatter: (params: any) => {
              const dataItem = chartData[params.dataIndex];
              const conversionText = showConversionRates && params.dataIndex > 0
                ? `\n${dataItem.conversionRate}%`
                : "";
              return `${params.name}${conversionText}`;
            },
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 18,
            textShadowColor: "rgba(0, 0, 0, 0.3)",
            textShadowBlur: 4,
          },
          labelLine: {
            show: false,
          },
          itemStyle: {
            borderColor: "hsl(var(--portal-bg-primary))",
            borderWidth: 2,
          },
          emphasis: {
            label: {
              fontSize: 14,
              fontWeight: 600,
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.2)",
            },
          },
          data: chartData,
        },
      ],
    };
  }, [chartData, orientation, showConversionRates, showLegend, formatValue]);

  const handleEvents = React.useMemo(() => {
    if (!onStageClick) return undefined;
    return {
      click: (params: any) => {
        onStageClick({
          name: params.name,
          value: params.value,
          index: params.dataIndex,
        });
      },
    };
  }, [onStageClick]);

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
