import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { V3TrendIndicator } from "./V3TrendIndicator";
import { PortalBreakdownTable } from "./PortalTable";
import { type LucideIcon, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";
import { useIsSingleDayView, useIsTodayView } from "@/hooks/useHourlyMetrics";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface SingleDayComparisonData {
  /** Previous period value for comparison */
  comparisonValue?: string | number;
  /** Label for comparison (e.g., "vs yesterday", "vs day before") */
  comparisonLabel?: string;
  /** Percent change from comparison period */
  percentChange?: number;
  /** Whether the change is positive */
  isPositive?: boolean;
  /** Hourly breakdown data if available */
  hourlyBreakdown?: { hour: string; value: number }[];
}

export interface KPIDrilldownData {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  description?: string;
  timeSeriesData?: Record<string, any>[];
  timeSeriesConfig?: {
    xAxisKey: string;
    series: LineSeriesConfig[];
  };
  breakdown?: {
    label: string;
    value: string | number;
    percentage?: number;
  }[];
  /** Single-day specific data */
  singleDayData?: SingleDayComparisonData;
}

interface V3KPIDrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: KPIDrilldownData | null;
}

// ============================================================================
// Single Day Comparison Card
// ============================================================================

interface ComparisonCardProps {
  currentValue: string | number;
  comparisonValue?: string | number;
  comparisonLabel?: string;
  percentChange?: number;
  isPositive?: boolean;
}

const ComparisonCard: React.FC<ComparisonCardProps> = ({
  currentValue,
  comparisonValue,
  comparisonLabel = "vs previous",
  percentChange,
  isPositive,
}) => {
  const direction = percentChange !== undefined 
    ? (percentChange > 0 ? "up" : percentChange < 0 ? "down" : "flat")
    : "flat";
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const displayPositive = isPositive ?? (percentChange !== undefined && percentChange > 0);

  return (
    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
          {currentValue}
        </span>
        {percentChange !== undefined && (
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium",
              displayPositive
                ? "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]"
                : "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{Math.abs(percentChange).toFixed(1)}%</span>
          </div>
        )}
      </div>
      {comparisonValue !== undefined && (
        <p className="text-sm text-[hsl(var(--portal-text-muted))]">
          <span className="font-medium text-[hsl(var(--portal-text-secondary))]">
            {comparisonValue}
          </span>
          {" "}{comparisonLabel}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const V3KPIDrilldownDrawer: React.FC<V3KPIDrilldownDrawerProps> = ({
  open,
  onOpenChange,
  data,
}) => {
  const isSingleDayView = useIsSingleDayView();
  const isTodayView = useIsTodayView();

  if (!data) return null;

  const Icon = data.icon;
  const { singleDayData } = data;

  // Determine comparison label based on view type
  const comparisonLabel = singleDayData?.comparisonLabel || 
    (isTodayView ? "vs yesterday" : "vs day before");

  // Check if we should show single-day view
  // Show single-day view if we're on a single day AND either:
  // 1. There's single-day comparison data available, OR
  // 2. The time series data has only 1 point (ineffective for charting)
  const showSingleDayView = isSingleDayView && (
    singleDayData !== undefined || 
    (data.timeSeriesData && data.timeSeriesData.length <= 1)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
                <Icon className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
              </div>
            )}
            <div>
              <SheetTitle className="text-xl">{data.label}</SheetTitle>
              {data.description && (
                <SheetDescription className="mt-1">
                  {data.description}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Single Day View: Comparison Card instead of chart */}
          {showSingleDayView ? (
            <>
              {/* Today's Performance Header */}
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
                <Clock className="h-4 w-4" />
                <span>{isTodayView ? "Today's Performance" : "Daily Performance"}</span>
              </div>

              {/* Comparison Card */}
              <ComparisonCard
                currentValue={data.value}
                comparisonValue={singleDayData?.comparisonValue}
                comparisonLabel={comparisonLabel}
                percentChange={singleDayData?.percentChange ?? data.trend?.value}
                isPositive={singleDayData?.isPositive ?? data.trend?.isPositive}
              />

              {/* Trend Indicator if available but no comparison data */}
              {!singleDayData?.comparisonValue && data.trend && (
                <div className="flex items-center justify-center">
                  <V3TrendIndicator
                    value={data.trend.value}
                    isPositive={data.trend.isPositive}
                    size="md"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Multi-day View: Hero Value */}
              <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {data.value}
                  </span>
                  {data.trend && (
                    <V3TrendIndicator
                      value={data.trend.value}
                      isPositive={data.trend.isPositive}
                      size="md"
                    />
                  )}
                </div>
              </div>

              {/* Time Series Chart - only show for multi-day view */}
              {data.timeSeriesData && data.timeSeriesConfig && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
                    Trend Over Time
                  </h4>
                  <div className="rounded-lg border border-[hsl(var(--portal-border))] p-3 bg-[hsl(var(--portal-bg-elevated))]">
                    <EChartsLineChart
                      data={data.timeSeriesData}
                      xAxisKey={data.timeSeriesConfig.xAxisKey}
                      series={data.timeSeriesConfig.series}
                      height={200}
                      showLegend={false}
                      showZoom={false}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Breakdown Table - shown in both views */}
          {data.breakdown && data.breakdown.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
                Breakdown
              </h4>
              <PortalBreakdownTable
                items={data.breakdown.map((item) => ({
                  label: item.label,
                  value: item.value,
                  percentage: item.percentage,
                }))}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

V3KPIDrilldownDrawer.displayName = "V3KPIDrilldownDrawer";
