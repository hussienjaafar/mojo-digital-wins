import { useMemo } from "react";
import { V3BarChart } from "@/components/charts";
import { V3LoadingState, V3EmptyState } from "@/components/v3";
import { DemographicsInsightCard } from "./DemographicsInsightCard";
import { formatCurrency, formatPercent } from "@/lib/chart-formatters";
import { Briefcase, Users, TrendingUp } from "lucide-react";

export interface OccupationStat {
  occupation_category: string;
  unique_donors: number;
  count: number;
  revenue: number;
  avg_gift?: number;
}

export interface OccupationBreakdownProps {
  data: OccupationStat[];
  isLoading?: boolean;
  onCategoryClick?: (category: string) => void;
}

export function OccupationBreakdown({
  data,
  isLoading = false,
  onCategoryClick,
}: OccupationBreakdownProps) {
  // Calculate totals and insights
  const { chartData, insights, totalRevenue, topCategory } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], insights: null, totalRevenue: 0, topCategory: null };
    }

    const totalRev = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalDonors = data.reduce((sum, d) => sum + d.unique_donors, 0);

    // Sort by revenue and prepare chart data
    const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
    const top = sorted[0];

    // Professional categories that might benefit from targeted messaging
    const professionalCategories = ["Healthcare", "Legal", "Technology", "Finance", "Education"];
    const professionalRevenue = data
      .filter((d) => professionalCategories.some((c) => d.occupation_category.includes(c)))
      .reduce((sum, d) => sum + d.revenue, 0);
    const professionalPct = totalRev > 0 ? (professionalRevenue / totalRev) * 100 : 0;

    // Find high-value categories (high avg gift)
    const highValueCategories = data
      .filter((d) => d.avg_gift && d.avg_gift > 100 && d.unique_donors >= 5)
      .sort((a, b) => (b.avg_gift ?? 0) - (a.avg_gift ?? 0));

    const chartItems = sorted.slice(0, 12).map((d) => ({
      name: d.occupation_category,
      value: d.revenue,
      donors: d.unique_donors,
      avgGift: d.avg_gift ?? (d.count > 0 ? d.revenue / d.count : 0),
      percentOfTotal: totalRev > 0 ? (d.revenue / totalRev) * 100 : 0,
    }));

    // Generate insight
    let insightText = "";
    let insightAccent: "blue" | "green" | "amber" | "purple" = "blue";

    if (professionalPct >= 30) {
      insightText = `${formatPercent(professionalPct)} of your revenue comes from professional fields (Healthcare, Legal, Tech, etc.). Consider partnering with professional associations or tailoring messaging around industry-specific policy issues.`;
      insightAccent = "green";
    } else if (highValueCategories.length > 0) {
      const hvc = highValueCategories[0];
      insightText = `${hvc.occupation_category} donors give ${formatCurrency(hvc.avg_gift ?? 0)} on average—significantly above your overall average. This is a high-capacity segment to cultivate.`;
      insightAccent = "purple";
    } else if (top) {
      const topPct = totalRev > 0 ? (top.revenue / totalRev) * 100 : 0;
      insightText = `${top.occupation_category} is your largest donor segment, contributing ${formatPercent(topPct)} of total revenue from ${top.unique_donors.toLocaleString()} donors.`;
      insightAccent = "blue";
    }

    return {
      chartData: chartItems,
      insights: insightText ? { text: insightText, accent: insightAccent } : null,
      totalRevenue: totalRev,
      topCategory: top,
    };
  }, [data]);

  if (isLoading) {
    return <V3LoadingState variant="chart" className="h-[400px]" />;
  }

  if (chartData.length === 0) {
    return (
      <V3EmptyState
        title="No Occupation Data"
        description="Occupation data is not available for your donors."
        className="h-[400px]"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Insight Card */}
      {insights && (
        <DemographicsInsightCard
          title="Professional Networks"
          insight={insights.text}
          icon={Briefcase}
          accent={insights.accent}
        />
      )}

      {/* Bar Chart */}
      <V3BarChart
        data={chartData}
        nameKey="name"
        valueKey="value"
        valueName="Revenue"
        height={350}
        valueType="currency"
        horizontal
        topN={12}
        showRankBadges
        tooltipFormatter={(item) => {
          const d = item as typeof chartData[0];
          return [
            `Revenue: ${formatCurrency(d.value)}`,
            `Donors: ${d.donors.toLocaleString()}`,
            `Avg Gift: ${formatCurrency(d.avgGift)}`,
            `Share: ${formatPercent(d.percentOfTotal)}`,
          ].join("\n");
        }}
        onBarClick={onCategoryClick ? (name) => onCategoryClick(name as string) : undefined}
      />

      {/* Summary stats row */}
      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[hsl(var(--portal-border))]">
        <div className="text-center">
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Categories</p>
          <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
            {data.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Total Revenue</p>
          <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Top Category</p>
          <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {topCategory?.occupation_category ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default OccupationBreakdown;
