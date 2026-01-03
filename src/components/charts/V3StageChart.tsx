/**
 * V3StageChart - Unified Stage Analysis Chart
 * 
 * The single authoritative abstraction for funnel-like data.
 * Automatically determines whether data is sequential and renders:
 * - True funnel (counts + step conversion) for sequential data
 * - Ranked horizontal bar comparison for non-sequential data
 * 
 * Features:
 * - Automatic sequential validation
 * - Intentional fallback states (not warnings)
 * - Proper step conversion rates (never misleading)
 * - Cumulative conversion display
 * - Biggest drop-off annotation
 * - Click-to-select with selection state
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
import { TrendingDown, ArrowRight, BarChart3 } from "lucide-react";

export type V3StageValueType = "number" | "currency";

export interface V3StageChartProps {
  /** Stage data (should be in logical order for funnels) */
  stages: FunnelStage[];
  /** Chart height */
  height?: number | string;
  /** Additional class name */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Value format type */
  valueType?: V3StageValueType;
  /** Show conversion rates on labels (funnel mode only) */
  showConversionRates?: boolean;
  /** Currently selected stage index (for controlled selection) */
  selectedStageIndex?: number | null;
  /** Callback when a stage is clicked */
  onStageSelect?: (stage: ProcessedFunnelStage | null, index: number | null) => void;
  /** Force bar chart mode (bypass sequential detection) */
  forceBarMode?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Show biggest drop-off annotation (funnel mode only) */
  showDropOffAnnotation?: boolean;
  /** Custom subtitle for bar mode (overrides default) */
  barModeSubtitle?: string;
}

const colorPalette = getChartColors();

// Get funnel stage color with gradient effect
const getStageColor = (index: number, total: number): string => {
  const baseHue = 215;
  const saturation = 70;
  const lightness = 60 - (index / Math.max(total - 1, 1)) * 20;
  return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
};

export const V3StageChart: React.FC<V3StageChartProps> = ({
  stages,
  height = 320,
  className,
  isLoading = false,
  valueType = 'number',
  showConversionRates = true,
  selectedStageIndex = null,
  onStageSelect,
  forceBarMode = false,
  emptyMessage = 'No stage data available',
  showDropOffAnnotation = true,
  barModeSubtitle,
}) => {
  // Analyze stage data
  const analysis = React.useMemo<FunnelAnalysis>(() => {
    return analyzeFunnel(stages);
  }, [stages]);

  // Determine visualization mode
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
          description="There is no stage data to display."
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

  // Build ECharts option for BAR mode (ranked comparison)
  const barOption = React.useMemo<EChartsOption>(() => {
    if (!useBarMode) return {};

    const sortedStages = funnelToRankedBars(stages);
    const total = sortedStages.reduce((sum, s) => sum + s.value, 0);

    const chartData = sortedStages.map((stage, index) => {
      const percent = total > 0 ? (stage.value / total) * 100 : 0;
      return {
        name: stage.name,
        value: stage.value,
        itemStyle: {
          color: stage.color || colorPalette[index % colorPalette.length],
          borderRadius: [0, 4, 4, 0],
          opacity: selectedStageIndex !== null && selectedStageIndex !== index ? 0.4 : 1,
        },
        _rank: index + 1,
        _percent: percent,
      };
    });

    return {
      animation: true,
      animationDuration: 400,
      aria: {
        enabled: true,
        label: {
          description: `Stage comparison showing ${sortedStages.length} stages ranked by volume. Top stage: ${sortedStages[0]?.name || 'none'}.`,
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
          const item = params.data;
          return `
            <div style="min-width: 160px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                ${item._rank <= 3 ? `
                  <span style="background: hsl(var(--portal-accent-blue) / 0.15); color: hsl(var(--portal-accent-blue)); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                    #${item._rank}
                  </span>
                ` : ''}
                <span style="font-weight: 600; font-size: 13px; color: hsl(var(--portal-text-primary));">
                  ${params.name}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: hsl(var(--portal-text-muted)); font-size: 12px;">Count</span>
                <span style="font-weight: 600; color: hsl(var(--portal-text-primary));">
                  ${formatValue(params.value)}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: hsl(var(--portal-text-muted));">
                <span>Share of Total</span>
                <span>${item._percent.toFixed(1)}%</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: 140,
        right: 50,
        top: 8,
        bottom: 8,
        containLabel: false,
      },
      xAxis: {
        type: 'value',
        show: false, // Hide x-axis completely to reduce bottom padding
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
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
          width: 130,
          overflow: 'truncate',
          ellipsis: '…',
        },
        triggerEvent: true, // Enable hover events for tooltip on truncated labels
      },
      series: [
        {
          type: 'bar',
          data: chartData,
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => formatValue(params.value, true),
            fontSize: 10,
            color: 'hsl(var(--portal-text-muted))',
          },
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
        if (selectedStageIndex === index) {
          onStageSelect(null, null);
        } else {
          const stage = useBarMode 
            ? funnelToRankedBars(stages)[index]
            : analysis.stages[index];
          onStageSelect(stage as ProcessedFunnelStage || null, index);
        }
      },
    };
  }, [onStageSelect, selectedStageIndex, analysis.stages, stages, useBarMode]);

  // Default bar mode subtitle
  const defaultBarSubtitle = "Stages are not sequential. Showing relative volume by stage.";

  return (
    <div className={className}>
      {/* Bar mode informational subtitle - intentional, not a warning */}
      {useBarMode && !forceBarMode && (
        <div className="mb-3 flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span>{barModeSubtitle || defaultBarSubtitle}</span>
        </div>
      )}
      
      {/* Chart */}
      <EChartsBase
        option={useBarMode ? barOption : funnelOption}
        height={height}
        isLoading={isLoading}
        onEvents={handleEvents}
      />
      
      {/* Biggest drop-off annotation (funnel mode only) */}
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
      
      {/* Summary metrics (funnel mode only) */}
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

V3StageChart.displayName = 'V3StageChart';
