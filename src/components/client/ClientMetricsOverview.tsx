import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { logger } from "@/lib/logger";
import { PortalSkeleton } from "@/components/portal/PortalSkeleton";
import { EChartsLineChart, EChartsPieChart } from "@/components/charts/echarts";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";

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
      {/* KPI Cards - Enhanced with Claude Console Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRaised.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDonations} donations
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgROI.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on investment
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Donation</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalDonations > 0 ? (totalRaised / totalDonations).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per donor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Enhanced with Smooth Variant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card variant="smooth" className="animate-slide-in-left">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Funds Raised Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
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
          </CardContent>
        </Card>

        <Card variant="smooth" className="animate-slide-in-right">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Spend by Channel</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <EChartsPieChart
              data={spendByChannel}
              height={250}
              variant="donut"
              valueType="currency"
              showLabels={true}
              legendPosition="right"
            />
          </CardContent>
        </Card>
      </div>

      {/* ROI Trend - Enhanced with Smooth Variant */}
      <Card variant="smooth" className="animate-fade-in">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">ROI Trend</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientMetricsOverview;
