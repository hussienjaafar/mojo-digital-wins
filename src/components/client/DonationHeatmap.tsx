import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CalendarHeatmap, type HeatmapDataPoint } from "@/components/charts/CalendarHeatmap";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent, V3LoadingState } from "@/components/v3";
import { Clock } from "lucide-react";

interface DonationHeatmapProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export const DonationHeatmap = ({ organizationId, startDate, endDate }: DonationHeatmapProps) => {
  // Compute full-day range for inclusive date filtering
  const rangeStart = startOfDay(parseISO(startDate));
  const rangeEnd = endOfDay(parseISO(endDate));

  const { data: donations, isLoading } = useQuery({
    queryKey: ["donations", "heatmap", organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actblue_transactions")
        .select("transaction_date, amount")
        .eq("organization_id", organizationId)
        .gte("transaction_date", rangeStart.toISOString())
        .lte("transaction_date", rangeEnd.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const heatmapData = useMemo<HeatmapDataPoint[]>(() => {
    if (!donations || donations.length === 0) {
      // Return empty grid
      const emptyGrid: HeatmapDataPoint[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          emptyGrid.push({ dayOfWeek: day, hour, value: 0 });
        }
      }
      return emptyGrid;
    }

    // Aggregate donations by day of week and hour
    const grid: Record<string, number> = {};
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        grid[`${day}-${hour}`] = 0;
      }
    }

    donations.forEach((donation) => {
      const date = new Date(donation.transaction_date);
      // Use local time for bucketing
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;
      grid[key] = (grid[key] || 0) + Number(donation.amount || 0);
    });

    return Object.entries(grid).map(([key, value]) => {
      const [day, hour] = key.split("-").map(Number);
      return { dayOfWeek: day, hour, value };
    });
  }, [donations]);

  if (isLoading) {
    return <V3LoadingState variant="chart" height={280} />;
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
        <CalendarHeatmap
          data={heatmapData}
          height={280}
          valueLabel="Revenue"
          valueType="currency"
          colorScheme="blue"
        />
      </V3CardContent>
    </V3Card>
  );
};

export default DonationHeatmap;
