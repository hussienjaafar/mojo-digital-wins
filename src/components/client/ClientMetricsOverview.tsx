import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3KPICard } from "@/components/v3/V3KPICard";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { logger } from "@/lib/logger";
import { PortalSkeleton } from "@/components/portal/PortalSkeleton";
import { EChartsLineChart, V3DonutChart } from "@/components/charts/echarts";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";
import { formatCurrency, formatPercent } from "@/lib/chart-formatters";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type AggregatedMetrics = {
  date: string;
  total_ad_spend: number;
  total_sms_cost: number;
  total_funds_raised: number;
  total_donations: number;
  roi_percentage: number;
};

const ClientMetricsOverview = ({ organizationId, startDate, endDate }: Props) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [organizationId, startDate, endDate]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('daily_aggregated_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      logger.error('Failed to load metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRaised = metrics.reduce((sum, m) => sum + Number(m.total_funds_raised || 0), 0);
  const totalSpent = metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0) + Number(m.total_sms_cost || 0), 0);
  const totalDonations = metrics.reduce((sum, m) => sum + Number(m.total_donations || 0), 0);
  const avgROI = totalSpent > 0 ? ((totalRaised - totalSpent) / totalSpent * 100) : 0;

  const spendByChannel = [
    { name: 'Meta Ads', value: metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0), 0) },
    { name: 'SMS', value: metrics.reduce((sum, m) => sum + Number(m.total_sms_cost || 0), 0) },
  ];

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

  if (metrics.length === 0) {
    return <NoDataEmptyState onRefresh={loadMetrics} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards - Enhanced with V3 Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <V3KPICard
          icon={DollarSign}
          label="Total Raised"
          value={formatCurrency(totalRaised, false)}
          subtitle={`${totalDonations} donations`}
          accent="green"
        />
        <V3KPICard
          icon={Target}
          label="Total Spent"
          value={formatCurrency(totalSpent, false)}
          subtitle="Across all channels"
          accent="amber"
        />
        <V3KPICard
          icon={TrendingUp}
          label="ROI"
          value={formatPercent(avgROI / 100, 1)}
          subtitle="Return on investment"
          accent="blue"
        />
        <V3KPICard
          icon={Users}
          label="Avg Donation"
          value={formatCurrency(totalDonations > 0 ? totalRaised / totalDonations : 0, false)}
          subtitle="Per donor"
          accent="purple"
        />
      </div>

      {/* Charts - Enhanced with V3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <V3ChartWrapper
          title="Funds Raised Over Time"
          ariaLabel="Line chart showing funds raised over time"
          accent="green"
        >
          <EChartsLineChart
            data={metrics}
            xAxisKey="date"
            series={[
              {
                dataKey: "total_funds_raised",
                name: "Funds Raised",
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
          title="Spend by Channel"
          ariaLabel="Donut chart showing spend breakdown by channel"
          accent="blue"
        >
          <V3DonutChart
            data={spendByChannel}
            height={250}
            valueType="currency"
            centerLabel="Total Spend"
            legendPosition="right"
            topN={6}
          />
        </V3ChartWrapper>
      </div>

      {/* ROI Trend - Enhanced with V3 */}
      <V3ChartWrapper
        title="ROI Trend"
        ariaLabel="Line chart showing ROI trend over time"
        accent="purple"
      >
        <EChartsLineChart
          data={metrics}
          xAxisKey="date"
          series={[
            {
              dataKey: "roi_percentage",
              name: "ROI %",
              color: "hsl(var(--primary))",
            },
          ]}
          height={250}
          valueType="percent"
          showLegend={false}
        />
      </V3ChartWrapper>
    </div>
  );
};

export default ClientMetricsOverview;
