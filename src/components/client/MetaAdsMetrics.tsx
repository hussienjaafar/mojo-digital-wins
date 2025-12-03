import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { Target, MousePointer, Eye, DollarSign, TrendingUp, TrendingDown, Filter, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, parseISO } from "date-fns";
import { ResponsiveLineChart, ResponsiveBarChart } from "@/components/charts";
import { formatCurrency } from "@/lib/chart-formatters";

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

const MetaAdsMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetaMetric>>({});
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [previousPeriodMetrics, setPreviousPeriodMetrics] = useState<Record<string, MetaMetric>>({});
  const [isLoading, setIsLoading] = useState(true);
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

    } catch (error) {
      logger.error('Failed to load Meta Ads data', error);
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

  const TrendIndicator = ({ value, isPositive }: { value: number; isPositive?: boolean }) => {
    const positive = isPositive ?? value >= 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-error))]'}`}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs with Period Comparison */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="text-xs portal-text-secondary">ROAS</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{roas.toFixed(2)}x</div>
          <TrendIndicator value={calcChange(roas, prevRoas)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="text-xs portal-text-secondary">Spend</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <TrendIndicator value={calcChange(totals.spend, previousTotals.spend)} isPositive={totals.spend <= previousTotals.spend} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-[hsl(var(--portal-success))]" />
            <span className="text-xs portal-text-secondary">Conversions</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{totals.conversions.toLocaleString()}</div>
          <TrendIndicator value={calcChange(totals.conversions, previousTotals.conversions)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <MousePointer className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-xs portal-text-secondary">CTR</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{avgCTR.toFixed(2)}%</div>
          <TrendIndicator value={calcChange(avgCTR, previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-xs portal-text-secondary">CPM</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">${cpm.toFixed(2)}</div>
          <TrendIndicator value={calcChange(cpm, previousTotals.impressions > 0 ? (previousTotals.spend / previousTotals.impressions) * 1000 : 0)} isPositive={cpm <= (previousTotals.impressions > 0 ? (previousTotals.spend / previousTotals.impressions) * 1000 : 0)} />
        </div>
      </div>

      {/* Performance Trend Chart */}
      {trendChartData.length > 0 && (
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Trend
            </PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <ResponsiveLineChart
              data={trendChartData}
              lines={[
                { dataKey: "Spend", name: "Spend", color: CHART_COLORS.spend, valueType: "currency" },
                { dataKey: "Conversions", name: "Conversions", color: CHART_COLORS.conversions, valueType: "number" },
              ]}
              valueType="currency"
            />
          </PortalCardContent>
        </PortalCard>
      )}

      {/* Campaign Breakdown Chart */}
      {campaignBreakdownData.length > 0 && (
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Campaign Breakdown
            </PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <ResponsiveBarChart
              data={campaignBreakdownData}
              bars={[
                { dataKey: "spend", name: "Spend", color: CHART_COLORS.spend, valueType: "currency" },
                { dataKey: "conversions", name: "Conversions", color: CHART_COLORS.conversions, valueType: "number" },
              ]}
              valueType="currency"
            />
          </PortalCardContent>
        </PortalCard>
      )}

      {/* Contextual Filters & Table */}
      <PortalCard>
        <PortalCardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <PortalCardTitle>Campaign Performance</PortalCardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 portal-text-muted" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
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
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={tableData}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium portal-text-primary">{value}</span>,
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
                render: (value) => <span className={value >= 2 ? 'text-[hsl(var(--portal-success))] font-semibold' : ''}>{value.toFixed(2)}x</span>,
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
              <p className="text-sm portal-text-muted">
                Connect your Meta Ads account to see campaign data
              </p>
            }
          />
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default MetaAdsMetrics;
