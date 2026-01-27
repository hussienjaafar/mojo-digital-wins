import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { EChartsBarChart } from "@/components/charts/echarts/EChartsBarChart";
import type { StancePerformance } from "@/hooks/useCreativeIntelligence";

interface StancePerformanceChartProps {
  data: StancePerformance[];
  isLoading?: boolean;
  error?: Error | null;
}

export function StancePerformanceChart({
  data,
  isLoading,
  error,
}: StancePerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    // Sort by mean ROAS descending
    return [...data]
      .sort((a, b) => b.mean_roas - a.mean_roas)
      .slice(0, 8)
      .map((item) => ({
        stance: item.stance,
        roas: item.mean_roas,
        creativeCount: item.creative_count,
        totalSpend: item.total_spend,
        totalRevenue: item.total_revenue,
      }));
  }, [data]);

  // Truncate long stance names for axis labels
  const formatLabel = (value: string) => {
    if (value.length > 25) {
      return value.slice(0, 22) + "...";
    }
    return value;
  };

  return (
    <ChartPanel
      title="Political Stance Performance"
      description="ROAS by political stance/position taken"
      icon={BarChart3}
      isLoading={isLoading}
      error={error}
      isEmpty={!chartData.length}
      emptyMessage="No stance performance data available"
      minHeight={280}
    >
      <EChartsBarChart
        data={chartData}
        xAxisKey="stance"
        series={[
          {
            dataKey: "roas",
            name: "ROAS",
            color: "hsl(var(--portal-accent-purple))",
            valueType: "ratio",
          },
        ]}
        horizontal
        valueType="ratio"
        xAxisLabelFormatter={formatLabel}
        showLegend={false}
        height={240}
      />
    </ChartPanel>
  );
}
