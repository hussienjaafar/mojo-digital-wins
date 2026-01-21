import { useMemo } from "react";
import { V3TimeHeatmap, V3TimeHeatmapLegend, V3TimeHeatmapPeakChips } from "@/components/charts/V3TimeHeatmap";
import { V3LoadingState, V3EmptyState } from "@/components/v3";
import { 
  normalizeHeatmapData, 
  calculateHeatmapStats, 
  formatTimeSlot,
  type HeatmapDataPoint,
  type HeatmapMetric 
} from "@/lib/heatmap-utils";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";

export interface GivingTimeHeatmapProps {
  /** Raw heatmap data from the API: day_of_week (0-6), hour (0-23), donation_count, revenue */
  data: Array<{
    day_of_week: number;
    hour: number;
    donation_count: number;
    revenue: number;
    avg_donation?: number;
  }>;
  /** Currently selected metric */
  metric?: HeatmapMetric;
  /** Height of the heatmap */
  height?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a peak chip is clicked */
  onPeakClick?: (dayOfWeek: number, hour: number) => void;
}

export function GivingTimeHeatmap({
  data,
  metric = "count",
  height = 320,
  isLoading = false,
  onPeakClick,
}: GivingTimeHeatmapProps) {
  // Transform API data to HeatmapDataPoint format
  const heatmapPoints: HeatmapDataPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((d) => ({
      dayOfWeek: d.day_of_week,
      hour: d.hour,
      count: d.donation_count,
      revenue: d.revenue,
      avg_donation: d.avg_donation ?? (d.donation_count > 0 ? d.revenue / d.donation_count : 0),
    }));
  }, [data]);

  // Normalize data into 7x24 grid
  const processedData = useMemo(() => {
    if (heatmapPoints.length === 0) return null;
    return normalizeHeatmapData(heatmapPoints, metric);
  }, [heatmapPoints, metric]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!processedData) return null;
    return calculateHeatmapStats(processedData.grid, processedData.maxValue);
  }, [processedData]);

  // Format function based on metric
  const formatValue = useMemo(() => {
    switch (metric) {
      case "revenue":
        return (v: number) => formatCurrency(v);
      case "avg_donation":
        return (v: number) => formatCurrency(v);
      case "count":
      default:
        return (v: number) => formatNumber(v);
    }
  }, [metric]);

  // Handle peak chip click
  const handlePeakClick = (dayOfWeek: number, hour: number) => {
    if (onPeakClick) {
      onPeakClick(dayOfWeek, hour);
    }
  };

  if (isLoading) {
    return <V3LoadingState variant="chart" className={`h-[${height}px]`} />;
  }

  if (!processedData || !stats || stats.totalValue === 0) {
    return (
      <V3EmptyState
        title="No Time Data"
        description="There is no donation timing data available to display."
        className={`h-[${height}px]`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <V3TimeHeatmapLegend
        minValue={0}
        maxValue={stats.p95Value}
        formatValue={formatValue}
        colorScheme="blue"
      />

      {/* Heatmap */}
      <V3TimeHeatmap
        data={heatmapPoints}
        metric={metric}
        height={height}
        colorScheme="blue"
        formatValue={formatValue}
      />

      {/* Peak Time Chips */}
      <div className="pt-2">
        <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-2">
          Best times to send outreach:
        </p>
        <V3TimeHeatmapPeakChips
          peaks={stats.topCells.slice(0, 3).map((cell) => ({
            dayOfWeek: cell.dayOfWeek,
            hour: cell.hour,
            value: cell.value,
          }))}
          formatValue={formatValue}
          onPeakClick={handlePeakClick}
        />
      </div>
    </div>
  );
}

export default GivingTimeHeatmap;
