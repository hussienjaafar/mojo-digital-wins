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
}

export const DonationHeatmap = ({ organizationId, startDate, endDate }: DonationHeatmapProps) => {
  const isMobile = useIsMobile();
  const { data: donations, isLoading, isError, error } = useQuery({
    queryKey: ["donations", "heatmap", organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actblue_transactions")
        .select("transaction_date, created_at, amount, net_amount, transaction_type")
        .eq("organization_id", organizationId)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const heatmapData = useMemo<HeatmapDataPoint[]>(() => {
    // Aggregate donations by day of week and hour
    const grid: Record<string, number> = {};
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        grid[`${day}-${hour}`] = 0;
      }
    }

    donations?.forEach((donation) => {
      // Skip refunds to show net revenue only
      if (donation.transaction_type === "refund") return;
      // Use created_at for accurate hour bucketing, fallback to transaction_date
      const date = new Date(donation.created_at ?? donation.transaction_date);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;
      // Use net_amount first, fallback to amount
      const value = Number(donation.net_amount ?? donation.amount ?? 0);
      grid[key] += value;
    });

    return Object.entries(grid).map(([key, value]) => {
      const [day, hour] = key.split("-").map(Number);
      return { dayOfWeek: day, hour, value };
    });
  }, [donations]);

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

  if (!donations || donations.length === 0) {
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
