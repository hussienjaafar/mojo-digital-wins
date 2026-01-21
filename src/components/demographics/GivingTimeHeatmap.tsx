import { useMemo } from "react";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { V3LoadingState, V3EmptyState } from "@/components/v3";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { DAY_LABELS_SHORT, HOUR_LABELS_SHORT } from "@/lib/heatmap-utils";

export interface GivingTimeHeatmapProps {
  /** Raw heatmap data from the API */
  data: Array<{
    day_of_week: number;
    hour: number;
    donation_count: number;
    revenue: number;
    avg_donation?: number;
  }>;
  height?: number;
  isLoading?: boolean;
}

export function GivingTimeHeatmap({
  data,
  height = 320,
  isLoading = false,
}: GivingTimeHeatmapProps) {
  // Transform to CalendarHeatmap format
  const heatmapData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      dayOfWeek: d.day_of_week,
      hour: d.hour,
      value: d.donation_count,
    }));
  }, [data]);

  // Find peak times
  const peakTimes = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => b.donation_count - a.donation_count)
      .slice(0, 3)
      .map((d) => `${DAY_LABELS_SHORT[d.day_of_week]} ${HOUR_LABELS_SHORT[d.hour]}`);
  }, [data]);

  if (isLoading) {
    return <V3LoadingState variant="chart" className="h-[320px]" />;
  }

  if (heatmapData.length === 0) {
    return (
      <V3EmptyState
        title="No Time Data"
        description="There is no donation timing data available."
        className="h-[320px]"
      />
    );
  }

  return (
    <div className="space-y-3">
      <CalendarHeatmap
        data={heatmapData}
        height={height}
        valueType="number"
        colorScheme="blue"
      />
      {peakTimes.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-2">
            Peak giving times:
          </p>
          <div className="flex flex-wrap gap-2">
            {peakTimes.map((time, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]"
              >
                #{i + 1} {time}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GivingTimeHeatmap;
