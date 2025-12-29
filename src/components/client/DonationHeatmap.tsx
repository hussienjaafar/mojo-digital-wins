import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarHeatmap, type HeatmapDataPoint } from "@/components/charts/CalendarHeatmap";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent, V3LoadingState, V3EmptyState, V3ErrorState } from "@/components/v3";
import { Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

export const DonationHeatmap = ({
  organizationId,
  startDate,
  endDate,
  timezone = getBrowserTimezone()
}: DonationHeatmapProps) => {
  const isMobile = useIsMobile();

  // Use RPC function for server-side aggregation with timezone support
  const { data: rpcData, isLoading, isError, error } = useQuery({
    queryKey: ["donations", "heatmap", organizationId, startDate, endDate, timezone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_donation_heatmap", {
        _organization_id: organizationId,
        _start_date: startDate,
        _end_date: endDate,
        _timezone: timezone,
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
        <V3CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Donation Activity by Time
        </V3CardTitle>
        <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
          Discover peak donation times to optimize send schedules
        </p>
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
      </V3CardContent>
    </V3Card>
  );
};

export default DonationHeatmap;
