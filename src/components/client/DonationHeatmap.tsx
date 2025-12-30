import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarHeatmap, type HeatmapDataPoint } from "@/components/charts/CalendarHeatmap";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent, V3LoadingState, V3EmptyState, V3ErrorState } from "@/components/v3";
import { Button } from "@/components/ui/button";
import { Clock, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface DonationHeatmapProps {
  organizationId: string;
  startDate: string;
  endDate: string;
  /** Timezone for hour bucketing (default: browser timezone) */
  timezone?: string;
}

// Get browser timezone
const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabels = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`
);

export const DonationHeatmap = ({
  organizationId,
  startDate,
  endDate,
  timezone = getBrowserTimezone()
}: DonationHeatmapProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Use RPC function for server-side aggregation with timezone support
  const { data: rpcData, isLoading, isError, error } = useQuery({
    queryKey: ["donations", "heatmap", organizationId, startDate, endDate, timezone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_donation_heatmap", {
        _organization_id: organizationId,
        _start_date: startDate,
        _end_date: endDate,
        _time_zone: timezone,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Transform RPC response to full 7x24 grid for heatmap
  const heatmapData = useMemo<HeatmapDataPoint[]>(() => {
    // Initialize full grid with zeros
    const grid: Record<string, number> = {};
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        grid[`${day}-${hour}`] = 0;
      }
    }

    // Fill in values from RPC response
    rpcData?.forEach((row) => {
      const key = `${row.day_of_week}-${row.hour}`;
      grid[key] = Number(row.value) || 0;
    });

    return Object.entries(grid).map(([key, value]) => {
      const [day, hour] = key.split("-").map(Number);
      return { dayOfWeek: day, hour, value };
    });
  }, [rpcData]);

  // Export heatmap data to CSV
  const handleExportCSV = useCallback(() => {
    // Build CSV content
    const headers = ["Day", "Hour", "Net Revenue"];
    const rows = heatmapData
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
      .map((point) => [
        dayLabels[point.dayOfWeek],
        hourLabels[point.hour],
        `$${point.value.toFixed(2)}`,
      ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `donation-heatmap-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Heatmap data downloaded as CSV.",
    });
  }, [heatmapData, startDate, endDate, toast]);

  // Calculate peak times for summary
  const peakTimes = useMemo(() => {
    if (heatmapData.length === 0) return null;
    
    const sorted = [...heatmapData].sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3).filter((p) => p.value > 0);
    
    if (top3.length === 0) return null;
    
    return top3.map((p) => ({
      day: dayLabels[p.dayOfWeek],
      hour: hourLabels[p.hour],
      value: p.value,
    }));
  }, [heatmapData]);

  if (isLoading) {
    return <V3LoadingState variant="chart" height={280} />;
  }

  if (isError) {
    return (
      <V3ErrorState
        title="Failed to load donation heatmap"
        message={error instanceof Error ? error.message : "An error occurred"}
      />
    );
  }

  if (!rpcData || rpcData.length === 0) {
    return (
      <V3EmptyState
        icon={Clock}
        title="No donation activity"
        description="No donations recorded in this date range."
      />
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <V3CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Donation Activity by Time
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              Discover peak donation times to optimize send schedules
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>
      </V3CardHeader>
      <V3CardContent>
        <div
          role="figure"
          aria-label="Heatmap showing donation activity by day of week and hour"
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))] rounded-lg"
        >
          <CalendarHeatmap
            data={heatmapData}
            height={isMobile ? 320 : 280}
            valueLabel="Net Revenue"
            valueType="currency"
            colorScheme="blue"
            compact={isMobile}
          />
        </div>

        {/* Peak Times Summary */}
        {peakTimes && peakTimes.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
            <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-2">
              Top Performing Times
            </p>
            <div className="flex flex-wrap gap-2">
              {peakTimes.map((peak, idx) => (
                <span
                  key={`${peak.day}-${peak.hour}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] text-xs font-medium"
                >
                  <span className="font-bold">#{idx + 1}</span>
                  {peak.day} {peak.hour} — ${peak.value.toLocaleString()}
                </span>
              ))}
            </div>
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
};

export default DonationHeatmap;
