import { useMemo } from "react";
import { DollarSign } from "lucide-react";
import { V3BarChart } from "@/components/charts";
import type { ChannelSummary } from "@/hooks/useRefcodePerformance";

// ============================================================================
// Types
// ============================================================================

interface RevenueByChannelChartProps {
  data: ChannelSummary[];
  isLoading?: boolean;
  height?: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function RevenueByChannelChart({ 
  data, 
  isLoading = false,
  height = 280 
}: RevenueByChannelChartProps) {
  const chartData = useMemo(() => {
    return data.map(channel => ({
      name: channel.label,
      value: channel.totalRevenue,
      donors: channel.uniqueDonors,
      avgGift: channel.avgGift,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse h-[280px] bg-[hsl(var(--portal-bg-tertiary))] rounded" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-[hsl(var(--portal-text-muted))]">
        <DollarSign className="h-8 w-8 mb-2 opacity-50" />
        <p>No channel data available</p>
      </div>
    );
  }

  return (
    <V3BarChart
      data={chartData}
      nameKey="name"
      valueKey="value"
      valueName="Revenue"
      height={height}
      valueType="currency"
      horizontal
      topN={6}
    />
  );
}
