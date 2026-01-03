/**
 * V3FunnelChart - Premium Analytics Funnel Chart
 * 
 * Features:
 * - Sequential validation (warns if data isn't truly sequential)
 * - Proper step conversion rates (never > 100% for sequential funnels)
 * - Cumulative conversion display
 * - Biggest drop-off annotation
 * - Click-to-select with selection state
 * - Auto-fallback to ranked bars for non-sequential data
 * - ARIA accessibility
 * - Premium styling
 */

import * as React from "react";
import type { EChartsOption } from "echarts";
import { EChartsBase } from "./echarts/EChartsBase";
import { getChartColors } from "@/lib/design-tokens";
import { formatNumber, formatCurrency } from "@/lib/chart-formatters";
import {
  analyzeFunnel,
  formatConversionRate,
  getDropOffSeverity,
  getSeverityColor,
  funnelToRankedBars,
  type FunnelStage,
  type ProcessedFunnelStage,
  type FunnelAnalysis,
} from "@/lib/funnel-chart-utils";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { AlertTriangle, TrendingDown, ArrowRight } from "lucide-react";

export type V3FunnelValueType = "number" | "currency";

export interface V3FunnelChartProps {
  /** Funnel stages (should be in logical order, top to bottom) */
  stages: FunnelStage[];
  /** Chart height */
  height?: number | string;
  /** Additional class name */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Value format type */
  valueType?: V3FunnelValueType;
  /** Show conversion rates on labels */
  showConversionRates?: boolean;
  /** Currently selected stage index (for controlled selection) */
  selectedStageIndex?: number | null;
  /** Callback when a stage is clicked */
  onStageSelect?: (stage: ProcessedFunnelStage | null, index: number | null) => void;
  /** Force bar chart mode (don't use funnel visualization) */
  forceBarMode?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Show biggest drop-off annotation */
  showDropOffAnnotation?: boolean;
  /** Show warning for non-sequential data */
  showSequenceWarning?: boolean;
}

const colorPalette = getChartColors();

// Get funnel stage color with gradient effect
const getStageColor = (index: number, total: number): string => {
  // Use a blue gradient from light to dark
  const baseHue = 215;
  const saturation = 70;
  const lightness = 60 - (index / Math.max(total - 1, 1)) * 20;
  return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
};

export const V3FunnelChart: React.FC<V3FunnelChartProps> = ({
  stages,
  height = 320,
  className,
  isLoading = false,
  valueType = 'number',
  showConversionRates = true,
  selectedStageIndex = null,
  onStageSelect,
  forceBarMode = false,
  emptyMessage = 'No funnel data available',
  showDropOffAnnotation = true,
  showSequenceWarning = true,
}) => {
  // Analyze funnel data
  const analysis = React.useMemo<FunnelAnalysis>(() => {
    return analyzeFunnel(stages);
  }, [stages]);

  // Determine if we should use bar mode
  const useBarMode = forceBarMode || !analysis.isSequential;

  // Format value based on type
  const formatValue = React.useCallback((value: number, compact = false): string => {
    switch (valueType) {
      case 'currency':
        return formatCurrency(value, compact);
      default:
        return formatNumber(value, compact);
    }
  }, [valueType]);

  // Empty state
  if (!isLoading && analysis.stages.length === 0) {
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

  // Build ECharts option for FUNNEL mode
  const funnelOption = React.useMemo<EChartsOption>(() => {
    if (useBarMode) return {};

    const chartData = analysis.stages.map((stage, index) => ({
      name: stage.name,
      value: stage.value,
      itemStyle: {
        color: getStageColor(index, analysis.stages.length),
        opacity: selectedStageIndex !== null && selectedStageIndex !== index ? 0.4 : 1,
        borderColor: selectedStageIndex === index 
          ? 'hsl(var(--portal-accent-blue))' 
          : 'hsl(var(--portal-bg-primary))',
        borderWidth: selectedStageIndex === index ? 3 : 2,
      },
      // Store additional data
      _stage: stage,
    }));

    return {
      animation: true,
      animationDuration: 500,
      animationEasing: 'cubicOut' as const,
      aria: {
        enabled: true,
        label: {
          description: `Conversion funnel with ${analysis.stages.length} stages. Overall conversion: ${formatConversionRate(analysis.overallConversionRate)}. Biggest drop-off: ${analysis.biggestDropOffStage?.name || 'none'}.`,
        },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'hsl(var(--portal-bg-secondary) / 0.98)',
        borderColor: 'hsl(var(--portal-border))',
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px hsl(215 25% 15% / 0.15); backdrop-filter: blur(8px);',
        formatter: (params: any) => {
          const stageIndex = params.dataIndex;
          const stage = analysis.stages[stageIndex];
          if (!stage) return '';
          
          const severity = getDropOffSeverity(stage.dropOffPercent);
          const severityColor = getSeverityColor(severity);
          
          return `
            <div style="min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 10px; color: hsl(var(--portal-text-primary));">
                ${stage.name}
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Count</span>
                <span style="font-weight: 600; font-size: 14px; color: hsl(var(--portal-text-primary));">
                  ${formatValue(stage.value)}
                </span>
              </div>
              
              ${stage.stepConversionRate !== null ? `
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Step Conversion</span>
                  <span style="font-weight: 500; font-size: 13px; color: hsl(var(--portal-success));">
                    ${formatConversionRate(stage.stepConversionRate)}
                  </span>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Drop-off</span>
                  <span style="font-weight: 500; font-size: 13px; color: ${severityColor};">
                    −${formatValue(stage.dropOffCount)} (${stage.dropOffPercent.toFixed(1)}%)
                  </span>
                </div>
              ` : ''}
              
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid hsl(var(--portal-border));">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="color: hsl(var(--portal-text-muted)); font-size: 11px;">Cumulative Conversion</span>
                  <span style="font-weight: 500; font-size: 12px; color: hsl(var(--portal-text-secondary));">
                    ${formatConversionRate(stage.cumulativeConversionRate)}
                  </span>
                </div>
              </div>
            </div>
          `;
        },
      },
      series: [
        {
          type: 'funnel',
          left: '15%',
          top: 20,
          bottom: 20,
          width: '70%',
          min: 0,
          minSize: '15%',
          maxSize: '100%',
          sort: 'descending',
          gap: 6,
          label: {
            show: true,
            position: 'inside',
            formatter: (params: any) => {
              const stage = analysis.stages[params.dataIndex];
              const conversionText = showConversionRates && stage?.stepConversionRate !== null
                ? `\n${formatConversionRate(stage.stepConversionRate)}`
                : '';
              return `${params.name}${conversionText}`;
            },
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 18,
            textShadowColor: 'rgba(0, 0, 0, 0.4)',
            textShadowBlur: 4,
          },
          labelLine: { show: false },
          emphasis: {
            label: {
              fontSize: 14,
              fontWeight: 600,
            },
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0, 0, 0, 0.25)',
            },
          },
          data: chartData,
        },
      ],
    };
  }, [analysis, useBarMode, selectedStageIndex, showConversionRates, formatValue]);

  // Build ECharts option for BAR mode (non-sequential data)
  const barOption = React.useMemo<EChartsOption>(() => {
    if (!useBarMode) return {};

    const sortedStages = funnelToRankedBars(stages);
    const maxValue = Math.max(...sortedStages.map(s => s.value));

    const chartData = sortedStages.map((stage, index) => ({
      name: stage.name,
      value: stage.value,
      itemStyle: {
        color: stage.color || colorPalette[index % colorPalette.length],
        borderRadius: [0, 4, 4, 0],
        opacity: selectedStageIndex !== null && selectedStageIndex !== index ? 0.4 : 1,
      },
    }));

    return {
      animation: true,
      animationDuration: 400,
      aria: {
        enabled: true,
        label: {
          description: `Stage comparison chart showing ${sortedStages.length} stages ranked by value.`,
        },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'hsl(var(--portal-bg-secondary) / 0.98)',
        borderColor: 'hsl(var(--portal-border))',
        borderWidth: 1,
        padding: [12, 16],
        extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px hsl(215 25% 15% / 0.15);',
        formatter: (params: any) => {
          const total = sortedStages.reduce((sum, s) => sum + s.value, 0);
          const percent = total > 0 ? (params.value / total) * 100 : 0;
          return `
            <div style="min-width: 160px;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: hsl(var(--portal-text-primary));">
                ${params.name}
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Count</span>
                <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">
                  ${formatValue(params.value)}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: hsl(var(--portal-text-muted));">
                <span>% of Total</span>
                <span>${percent.toFixed(1)}%</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: 120,
        right: 16,
        top: 16,
        bottom: 16,
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'hsl(var(--portal-text-muted))',
          fontSize: 10,
          formatter: (value: number) => formatValue(value, true),
        },
        splitLine: {
          lineStyle: {
            color: 'hsl(var(--portal-border) / 0.5)',
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: sortedStages.map(s => s.name),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'hsl(var(--portal-text-muted))',
          fontSize: 11,
        },
      },
      series: [
        {
          type: 'bar',
          data: chartData,
          barMaxWidth: 28,
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
      ],
    };
  }, [stages, useBarMode, selectedStageIndex, formatValue]);

  // Handle stage click
  const handleEvents = React.useMemo(() => {
    if (!onStageSelect) return undefined;
    return {
      click: (params: any) => {
        const index = params.dataIndex;
        // Toggle selection
        if (selectedStageIndex === index) {
          onStageSelect(null, null);
        } else {
          const stage = analysis.stages[index];
          onStageSelect(stage || null, index);
        }
      },
    };
  }, [onStageSelect, selectedStageIndex, analysis.stages]);

  return (
    <div className={className}>
      {/* Non-sequential warning */}
      {showSequenceWarning && !analysis.isSequential && !forceBarMode && (
        <div className="mb-3 p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.3)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))] shrink-0 mt-0.5" />
            <div className="text-xs text-[hsl(var(--portal-text-secondary))]">
              <span className="font-medium text-[hsl(var(--portal-warning))]">Data is not sequential:</span>{' '}
              Some stages have higher values than previous stages. Showing as ranked comparison instead of conversion funnel.
            </div>
          </div>
        </div>
      )}
      
      {/* Chart */}
      <EChartsBase
        option={useBarMode ? barOption : funnelOption}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
      
      {/* Biggest drop-off annotation */}
      {showDropOffAnnotation && analysis.biggestDropOffStage && analysis.isSequential && (
        <div className="mt-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 text-xs">
            <TrendingDown className="h-4 w-4 text-[hsl(var(--portal-error))]" />
            <span className="font-medium text-[hsl(var(--portal-text-primary))]">Biggest Drop-off:</span>
            <span className="text-[hsl(var(--portal-text-secondary))]">
              {analysis.stages[analysis.biggestDropOffIndex! - 1]?.name}
            </span>
            <ArrowRight className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-[hsl(var(--portal-text-secondary))]">
              {analysis.biggestDropOffStage.name}
            </span>
            <span className="ml-auto font-medium text-[hsl(var(--portal-error))]">
              −{formatValue(analysis.biggestDropOffStage.dropOffCount)} ({analysis.biggestDropOffStage.dropOffPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
      
      {/* Summary metrics */}
      {analysis.isSequential && analysis.stages.length >= 2 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
            <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {formatConversionRate(analysis.overallConversionRate)}
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Overall Conversion</div>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
            <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
              {formatValue(analysis.totalDropOff)}
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">Total Drop-off</div>
          </div>
        </div>
      )}
    </div>
  );
};

V3FunnelChart.displayName = 'V3FunnelChart';
