import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { EChartsBarChart } from "@/components/charts/echarts/EChartsBarChart";
import type { IssuePerformance } from "@/hooks/useCreativeIntelligence";

interface IssuePerformanceChartProps {
  data: IssuePerformance[];
  isLoading?: boolean;
  error?: Error | null;
}

export function IssuePerformanceChart({
  data,
  isLoading,
  error,
}: IssuePerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    // Sort by mean ROAS descending and take top 10
    return [...data]
      .sort((a, b) => b.mean_roas - a.mean_roas)
      .slice(0, 10)
      .map((item) => ({
        issue: item.issue_primary,
        roas: item.mean_roas,
        creativeCount: item.creative_count,
        totalSpend: item.total_spend,
        totalRevenue: item.total_revenue,
        confidenceScore: item.confidence_score,
      }));
  }, [data]);

  // Truncate long issue names for axis labels
  const formatLabel = (value: string) => {
    if (value.length > 25) {
      return value.slice(0, 22) + "...";
    }
    return value;
  };

  return (
    <ChartPanel
      title="Issue Performance Rankings"
      description="Top performing political issues by ROAS"
      icon={BarChart3}
      isLoading={isLoading}
      error={error}
      isEmpty={!chartData.length}
      emptyMessage="No issue performance data available"
      minHeight={320}
    >
      <EChartsBarChart
        data={chartData}
        xAxisKey="issue"
        series={[
          {
            dataKey: "roas",
            name: "ROAS",
            color: "hsl(var(--portal-accent-blue))",
            valueType: "ratio",
          },
        ]}
        horizontal
        valueType="ratio"
        xAxisLabelFormatter={formatLabel}
        showLegend={false}
        height={280}
      />
    </ChartPanel>
  );
}
