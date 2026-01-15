/**
 * ClientMetricsOverview - Executive dashboard view using unified ActBlue metrics
 * 
 * Refactored to use the unified `useActBlueMetrics` hook for consistent data.
 */

import { V3KPICard } from "@/components/v3/V3KPICard";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { PortalSkeleton } from "@/components/portal/PortalSkeleton";
import { EChartsLineChart, V3DonutChart } from "@/components/charts/echarts";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";
import { formatCurrency, formatPercent } from "@/lib/chart-formatters";
import { useActBlueMetrics } from "@/hooks/useActBlueMetrics";
import { getChannelLabel, getChannelColor, type AttributionChannel } from "@/utils/channelDetection";
import { useMemo } from "react";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

const ClientMetricsOverview = ({ organizationId }: Props) => {
  // Use unified metrics hook - date range comes from store
  const { data, isLoading, error, refetch } = useActBlueMetrics(organizationId);

  // Transform data for charts
  const chartData = useMemo(() => {
    if (!data) return { daily: [], channelSpend: [] };

    // Daily metrics for line charts
    const daily = (data.dailyRollup || []).map((row) => ({
      date: row.date,
      net_revenue: row.net,
      donation_count: row.donations,
      // ROI would need spend data - for now just show revenue
      roi_percentage: 0,
    }));

    // Channel breakdown for donut chart
    const channelSpend = (data.channelBreakdown || []).map((item) => ({
      name: getChannelLabel(item.channel as AttributionChannel),
      value: item.raised,
      color: getChannelColor(item.channel as AttributionChannel),
    }));

    return { daily, channelSpend };
  }, [data]);

  // Extract summary values
  const summary = data?.summary;
  const totalNetRevenue = summary?.totalNet || 0;
  const totalDonations = summary?.totalDonations || 0;
  const avgDonation = summary?.averageDonation || 0;

  // Note: ROI calculation requires spend data from meta_ad_metrics + sms_campaigns
  // This would be integrated in a future iteration

  // Trends
  const trends = data?.trends;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <PortalSkeleton key={i} variant="metric" className={`portal-delay-${i * 100}`} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PortalSkeleton variant="chart" />
          <PortalSkeleton variant="chart" />
        </div>
        <PortalSkeleton variant="chart" />
      </div>
    );
  }

  if (error) {
    return <NoDataEmptyState onRefresh={refetch} />;
  }

  if (!data || chartData.daily.length === 0) {
    return <NoDataEmptyState onRefresh={refetch} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <V3KPICard
          icon={DollarSign}
          label="Net Revenue"
          value={formatCurrency(totalNetRevenue, false)}
          subtitle={`${totalDonations} donations (after fees & refunds)`}
          accent="green"
          trend={trends?.raisedTrend != null ? { value: trends.raisedTrend } : undefined}
        />
        <V3KPICard
          icon={Target}
          label="Total Raised"
          value={formatCurrency(summary?.totalRaised || 0, false)}
          subtitle="Gross donations"
          accent="amber"
        />
        <V3KPICard
          icon={TrendingUp}
          label="Recurring Rate"
          value={formatPercent((summary?.recurringRate || 0) / 100, 1)}
          subtitle={`${summary?.recurringCount || 0} recurring donors`}
          accent="blue"
          trend={trends?.recurringTrend != null ? { value: trends.recurringTrend } : undefined}
        />
        <V3KPICard
          icon={Users}
          label="Unique Donors"
          value={summary?.uniqueDonors?.toLocaleString() || '0'}
          subtitle={`Avg: ${formatCurrency(avgDonation, false)}`}
          accent="purple"
          trend={trends?.donorsTrend != null ? { value: trends.donorsTrend } : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <V3ChartWrapper
          title="Net Revenue Over Time"
          ariaLabel="Line chart showing net revenue over time"
          accent="green"
        >
          <EChartsLineChart
            data={chartData.daily}
            xAxisKey="date"
            series={[
              {
                dataKey: "net_revenue",
                name: "Net Revenue",
                color: "hsl(var(--primary))",
                type: "area",
                areaStyle: { opacity: 0.1 },
              },
            ]}
            height={250}
            valueType="currency"
            showLegend={false}
          />
        </V3ChartWrapper>

        <V3ChartWrapper
          title="Revenue by Channel"
          ariaLabel="Donut chart showing revenue breakdown by channel"
          accent="blue"
        >
          <V3DonutChart
            data={chartData.channelSpend}
            height={250}
            valueType="currency"
            centerLabel="Total Revenue"
            legendPosition="right"
            topN={6}
          />
        </V3ChartWrapper>
      </div>

      {/* Attribution Quality */}
      {data.attribution && (
        <V3ChartWrapper
          title="Attribution Quality"
          ariaLabel="Attribution coverage metrics"
          accent="purple"
        >
          <div className="flex items-center justify-center gap-8 py-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                {data.attribution.attributionRate}%
              </div>
              <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Attributed
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                {data.attribution.attributedCount.toLocaleString()}
              </div>
              <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
                of {data.attribution.totalCount.toLocaleString()} donations
              </div>
            </div>
          </div>
        </V3ChartWrapper>
      )}
    </div>
  );
};

export default ClientMetricsOverview;
