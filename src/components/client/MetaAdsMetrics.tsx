import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3KPICard,
  V3TrendIndicator,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
  V3EmptyState,
} from "@/components/v3";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { Target, MousePointer, Eye, DollarSign, TrendingUp, BarChart3, Filter, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, parseISO } from "date-fns";
import { ResponsiveLineChart, ResponsiveBarChart } from "@/components/charts";
import { MetaDataFreshnessIndicator } from "./MetaDataFreshnessIndicator";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type MetaCampaign = {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string;
  daily_budget: number;
  lifetime_budget: number;
};

type MetaMetric = {
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  reach: number;
  cpc: number;
  ctr: number;
  roas: number;
  cpm: number;
};

type DailyMetric = {
  date: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

const CHART_COLORS = {
  spend: "hsl(var(--portal-accent-blue))",
  conversions: "hsl(var(--portal-success))",
  impressions: "hsl(var(--portal-accent-purple))",
};

// Animation variants for staggered KPI cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const MetaAdsMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetaMetric>>({});
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [previousPeriodMetrics, setPreviousPeriodMetrics] = useState<Record<string, MetaMetric>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");

  // Calculate previous period dates
  const getPreviousPeriod = () => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, daysDiff);
    return {
      start: format(prevStart, 'yyyy-MM-dd'),
      end: format(prevEnd, 'yyyy-MM-dd'),
    };
  };

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const prevPeriod = getPreviousPeriod();

    try {
      // Fetch campaigns
      const { data: campaignData, error: campaignError } = await (supabase as any)
        .from('meta_campaigns')
        .select('*')
        .eq('organization_id', organizationId);

      if (campaignError) throw campaignError;
      setCampaigns(campaignData || []);

      // Fetch current period metrics
      const { data: metricsData, error: metricsError } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (metricsError) throw metricsError;

      // Aggregate by campaign
      const aggregated = aggregateMetrics(metricsData || []);
      setMetrics(aggregated);

      // Group by date for trend chart
      const daily = aggregateDailyMetrics(metricsData || []);
      setDailyMetrics(daily);

      // Fetch previous period for comparison
      const { data: prevData } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', prevPeriod.start)
        .lte('date', prevPeriod.end);

      const prevAggregated = aggregateMetrics(prevData || []);
      setPreviousPeriodMetrics(prevAggregated);

    } catch (err) {
      logger.error('Failed to load Meta Ads data', err);
      setError('Failed to load Meta Ads data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const aggregateMetrics = (data: any[]): Record<string, MetaMetric> => {
    const aggregated: Record<string, MetaMetric> = {};
    data?.forEach(metric => {
      if (!aggregated[metric.campaign_id]) {
        aggregated[metric.campaign_id] = {
          campaign_id: metric.campaign_id,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          conversion_value: 0,
          reach: 0,
          cpc: 0,
          ctr: 0,
          roas: 0,
          cpm: 0,
        };
      }
      aggregated[metric.campaign_id].impressions += metric.impressions || 0;
      aggregated[metric.campaign_id].clicks += metric.clicks || 0;
      aggregated[metric.campaign_id].spend += Number(metric.spend || 0);
      aggregated[metric.campaign_id].conversions += metric.conversions || 0;
      aggregated[metric.campaign_id].conversion_value += Number(metric.conversion_value || 0);
      aggregated[metric.campaign_id].reach += metric.reach || 0;
    });

    // Calculate derived metrics
    Object.values(aggregated).forEach(metric => {
      if (metric.clicks > 0) metric.cpc = metric.spend / metric.clicks;
      if (metric.impressions > 0) {
        metric.ctr = (metric.clicks / metric.impressions) * 100;
        metric.cpm = (metric.spend / metric.impressions) * 1000;
      }
      if (metric.spend > 0) metric.roas = metric.conversion_value / metric.spend;
    });

    return aggregated;
  };

  const aggregateDailyMetrics = (data: any[]): DailyMetric[] => {
    const byDate: Record<string, DailyMetric> = {};
    data?.forEach(metric => {
      const date = metric.date;
      if (!byDate[date]) {
        byDate[date] = { date, spend: 0, conversions: 0, impressions: 0, clicks: 0 };
      }
      byDate[date].spend += Number(metric.spend || 0);
      byDate[date].conversions += metric.conversions || 0;
      byDate[date].impressions += metric.impressions || 0;
      byDate[date].clicks += metric.clicks || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  };

  // Calculate totals
  const totals = useMemo(() => {
    return Object.values(metrics).reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.impressions,
        clicks: acc.clicks + m.clicks,
        spend: acc.spend + m.spend,
        conversions: acc.conversions + m.conversions,
        conversion_value: acc.conversion_value + m.conversion_value,
        reach: acc.reach + m.reach,
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, reach: 0 }
    );
  }, [metrics]);

  const previousTotals = useMemo(() => {
    return Object.values(previousPeriodMetrics).reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.impressions,
        clicks: acc.clicks + m.clicks,
        spend: acc.spend + m.spend,
        conversions: acc.conversions + m.conversions,
        conversion_value: acc.conversion_value + m.conversion_value,
        reach: acc.reach + m.reach,
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, reach: 0 }
    );
  }, [previousPeriodMetrics]);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

  const prevRoas = previousTotals.spend > 0 ? previousTotals.conversion_value / previousTotals.spend : 0;
  const prevCTR = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0;
  const prevCPM = previousTotals.impressions > 0 ? (previousTotals.spend / previousTotals.impressions) * 1000 : 0;

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (performanceFilter === "high-roas") {
      filtered = filtered.filter(c => {
        const m = metrics[c.campaign_id];
        return m && m.roas >= 2;
      });
    } else if (performanceFilter === "low-ctr") {
      filtered = filtered.filter(c => {
        const m = metrics[c.campaign_id];
        return m && m.ctr < 1;
      });
    }

    return filtered;
  }, [campaigns, metrics, statusFilter, performanceFilter]);

  // Prepare table data
  const tableData = filteredCampaigns.map(campaign => {
    const metric = metrics[campaign.campaign_id] || {
      impressions: 0, clicks: 0, spend: 0, conversions: 0, cpc: 0, ctr: 0, roas: 0, cpm: 0,
    };
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name || campaign.campaign_id,
      status: campaign.status,
      ...metric,
    };
  });

  // Prepare chart data for campaign breakdown
  const campaignBreakdownData = tableData
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map(c => ({
      name: c.campaign_name.length > 15 ? c.campaign_name.slice(0, 15) + '...' : c.campaign_name,
      spend: c.spend,
      conversions: c.conversions,
      roas: c.roas,
    }));

  // Prepare trend chart data
  const trendChartData = dailyMetrics.map(d => ({
    name: format(parseISO(d.date), 'MMM d'),
    Spend: d.spend,
    Conversions: d.conversions,
  }));

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <V3LoadingState variant="kpi-grid" count={5} />
        <V3LoadingState variant="chart" height={280} />
        <V3LoadingState variant="table" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <V3ErrorState
        title="Failed to load Meta Ads data"
        message={error}
        onRetry={loadData}
      />
    );
  }

  // Show empty state if no campaigns
  if (campaigns.length === 0 && !isLoading) {
    return (
      <V3EmptyState
        icon={Target}
        title="No Meta Ads campaigns found"
        description="Connect your Meta Ads account to see campaign performance data."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Freshness Indicator */}
      <div className="flex justify-end">
        <MetaDataFreshnessIndicator organizationId={organizationId} />
      </div>

      {/* V3 KPI Cards with Period Comparison */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={DollarSign}
            label="ROAS"
            value={`${roas.toFixed(2)}x`}
            trend={{ value: calcChange(roas, prevRoas), isPositive: roas >= prevRoas }}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={DollarSign}
            label="Spend"
            value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            trend={{ value: calcChange(totals.spend, previousTotals.spend), isPositive: totals.spend <= previousTotals.spend }}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Target}
            label="Conversions"
            value={totals.conversions.toLocaleString()}
            trend={{ value: calcChange(totals.conversions, previousTotals.conversions) }}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={MousePointer}
            label="CTR"
            value={`${avgCTR.toFixed(2)}%`}
            trend={{ value: calcChange(avgCTR, prevCTR) }}
            accent="purple"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Eye}
            label="CPM"
            value={`$${cpm.toFixed(2)}`}
            trend={{ value: calcChange(cpm, prevCPM), isPositive: cpm <= prevCPM }}
            accent="default"
          />
        </motion.div>
      </motion.div>

      {/* Performance Trend Chart */}
      {trendChartData.length > 0 && (
        <V3ChartWrapper
          title="Performance Trend"
          icon={TrendingUp}
          ariaLabel="Meta Ads performance trend chart showing spend and conversions over time"
          description="Line chart displaying daily spend and conversion trends for Meta advertising campaigns"
          accent="blue"
        >
          <ResponsiveLineChart
            data={trendChartData}
            lines={[
              { dataKey: "Spend", name: "Spend", color: CHART_COLORS.spend, valueType: "currency" },
              { dataKey: "Conversions", name: "Conversions", color: CHART_COLORS.conversions, valueType: "number" },
            ]}
            valueType="currency"
          />
        </V3ChartWrapper>
      )}

      {/* Campaign Breakdown Chart */}
      {campaignBreakdownData.length > 0 && (
        <V3ChartWrapper
          title="Campaign Breakdown"
          icon={BarChart3}
          ariaLabel="Campaign breakdown bar chart showing spend and conversions by campaign"
          description="Bar chart comparing spend and conversions across top performing Meta campaigns"
          accent="blue"
        >
          <ResponsiveBarChart
            data={campaignBreakdownData}
            bars={[
              { dataKey: "spend", name: "Spend", color: CHART_COLORS.spend, valueType: "currency" },
              { dataKey: "conversions", name: "Conversions", color: CHART_COLORS.conversions, valueType: "number" },
            ]}
            valueType="currency"
          />
        </V3ChartWrapper>
      )}

      {/* Campaign Table */}
      <V3Card accent="blue">
        <V3CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <V3CardTitle>Campaign Performance</V3CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs" aria-label="Filter by performance">
                  <SelectValue placeholder="Performance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Performance</SelectItem>
                  <SelectItem value="high-roas">High ROAS (2x+)</SelectItem>
                  <SelectItem value="low-ctr">Low CTR (&lt;1%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <PortalTable
            data={tableData}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium text-[hsl(var(--portal-text-primary))]">{value}</span>,
              },
              {
                key: "status",
                label: "Status",
                mobileLabel: "Status",
                render: (value) => (
                  <PortalBadge variant={value === 'ACTIVE' ? 'success' : 'neutral'}>
                    {value}
                  </PortalBadge>
                ),
              },
              {
                key: "spend",
                label: "Spend",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
              },
              {
                key: "roas",
                label: "ROAS",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className={value >= 2 ? 'text-[hsl(var(--portal-success))] font-semibold' : ''}>
                    {value.toFixed(2)}x
                  </span>
                ),
              },
              {
                key: "conversions",
                label: "Conv.",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
              {
                key: "ctr",
                label: "CTR",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.percentage,
                hiddenOnMobile: true,
              },
              {
                key: "cpc",
                label: "CPC",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
                hiddenOnMobile: true,
              },
              {
                key: "impressions",
                label: "Impr.",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
                hiddenOnMobile: true,
              },
            ]}
            keyExtractor={(row) => row.campaign_id}
            isLoading={isLoading}
            emptyMessage="No Meta campaigns found"
            emptyAction={
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                Connect your Meta Ads account to see campaign data
              </p>
            }
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default MetaAdsMetrics;
