import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { MessageSquare, CheckCircle, DollarSign, Target, TrendingUp, TrendingDown, Filter, BarChart3, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { PortalBadge } from "@/components/portal/PortalBadge";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type SMSMetric = {
  campaign_id: string;
  campaign_name: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  opt_outs: number;
  clicks: number;
  conversions: number;
  amount_raised: number;
  cost: number;
  roi: number;
  delivery_rate: number;
  ctr: number;
  opt_out_rate: number;
};

type DailyMetric = {
  date: string;
  messages_sent: number;
  conversions: number;
  amount_raised: number;
};

const CHART_COLORS = {
  sent: "hsl(var(--portal-accent-purple))",
  conversions: "hsl(var(--portal-success))",
  raised: "hsl(var(--portal-accent-blue))",
};

const SMSMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [metrics, setMetrics] = useState<Record<string, SMSMetric>>({});
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [previousPeriodMetrics, setPreviousPeriodMetrics] = useState<Record<string, SMSMetric>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");

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
      // Current period
      const { data, error } = await (supabase as any)
        .from('sms_campaign_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      const aggregated = aggregateMetrics(data || []);
      setMetrics(aggregated);

      const daily = aggregateDailyMetrics(data || []);
      setDailyMetrics(daily);

      // Previous period
      const { data: prevData } = await (supabase as any)
        .from('sms_campaign_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', prevPeriod.start)
        .lte('date', prevPeriod.end);

      const prevAggregated = aggregateMetrics(prevData || []);
      setPreviousPeriodMetrics(prevAggregated);

    } catch (error) {
      logger.error('Failed to load SMS data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregateMetrics = (data: any[]): Record<string, SMSMetric> => {
    const aggregated: Record<string, SMSMetric> = {};
    data?.forEach(metric => {
      if (!aggregated[metric.campaign_id]) {
        aggregated[metric.campaign_id] = {
          campaign_id: metric.campaign_id,
          campaign_name: metric.campaign_name || metric.campaign_id,
          messages_sent: 0,
          messages_delivered: 0,
          messages_failed: 0,
          opt_outs: 0,
          clicks: 0,
          conversions: 0,
          amount_raised: 0,
          cost: 0,
          roi: 0,
          delivery_rate: 0,
          ctr: 0,
          opt_out_rate: 0,
        };
      }
      aggregated[metric.campaign_id].messages_sent += metric.messages_sent || 0;
      aggregated[metric.campaign_id].messages_delivered += metric.messages_delivered || 0;
      aggregated[metric.campaign_id].messages_failed += metric.messages_failed || 0;
      aggregated[metric.campaign_id].opt_outs += metric.opt_outs || 0;
      aggregated[metric.campaign_id].clicks += metric.clicks || 0;
      aggregated[metric.campaign_id].conversions += metric.conversions || 0;
      aggregated[metric.campaign_id].amount_raised += Number(metric.amount_raised || 0);
      aggregated[metric.campaign_id].cost += Number(metric.cost || 0);
    });

    // Calculate derived metrics
    Object.values(aggregated).forEach(m => {
      if (m.cost > 0) m.roi = m.amount_raised / m.cost;
      if (m.messages_sent > 0) m.delivery_rate = (m.messages_delivered / m.messages_sent) * 100;
      if (m.messages_delivered > 0) {
        m.ctr = (m.clicks / m.messages_delivered) * 100;
        m.opt_out_rate = (m.opt_outs / m.messages_delivered) * 100;
      }
    });

    return aggregated;
  };

  const aggregateDailyMetrics = (data: any[]): DailyMetric[] => {
    const byDate: Record<string, DailyMetric> = {};
    data?.forEach(metric => {
      const date = metric.date;
      if (!byDate[date]) {
        byDate[date] = { date, messages_sent: 0, conversions: 0, amount_raised: 0 };
      }
      byDate[date].messages_sent += metric.messages_sent || 0;
      byDate[date].conversions += metric.conversions || 0;
      byDate[date].amount_raised += Number(metric.amount_raised || 0);
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  };

  const campaigns = useMemo(() => Object.values(metrics), [metrics]);
  const previousCampaigns = useMemo(() => Object.values(previousPeriodMetrics), [previousPeriodMetrics]);

  // Current period totals
  const totals = useMemo(() => ({
    sent: campaigns.reduce((sum, m) => sum + m.messages_sent, 0),
    delivered: campaigns.reduce((sum, m) => sum + m.messages_delivered, 0),
    raised: campaigns.reduce((sum, m) => sum + m.amount_raised, 0),
    cost: campaigns.reduce((sum, m) => sum + m.cost, 0),
    conversions: campaigns.reduce((sum, m) => sum + m.conversions, 0),
    clicks: campaigns.reduce((sum, m) => sum + m.clicks, 0),
    optOuts: campaigns.reduce((sum, m) => sum + m.opt_outs, 0),
  }), [campaigns]);

  // Previous period totals
  const prevTotals = useMemo(() => ({
    sent: previousCampaigns.reduce((sum, m) => sum + m.messages_sent, 0),
    delivered: previousCampaigns.reduce((sum, m) => sum + m.messages_delivered, 0),
    raised: previousCampaigns.reduce((sum, m) => sum + m.amount_raised, 0),
    cost: previousCampaigns.reduce((sum, m) => sum + m.cost, 0),
    conversions: previousCampaigns.reduce((sum, m) => sum + m.conversions, 0),
  }), [previousCampaigns]);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const roi = totals.cost > 0 ? totals.raised / totals.cost : 0;
  const prevRoi = prevTotals.cost > 0 ? prevTotals.raised / prevTotals.cost : 0;
  const deliveryRate = totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0;
  const prevDeliveryRate = prevTotals.sent > 0 ? (prevTotals.delivered / prevTotals.sent) * 100 : 0;
  const ctr = totals.delivered > 0 ? (totals.clicks / totals.delivered) * 100 : 0;
  const optOutRate = totals.delivered > 0 ? (totals.optOuts / totals.delivered) * 100 : 0;
  const costPerConversion = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    if (campaignFilter !== "all") {
      filtered = filtered.filter(c => c.campaign_id === campaignFilter);
    }

    if (performanceFilter === "high-roi") {
      filtered = filtered.filter(c => c.roi >= 2);
    } else if (performanceFilter === "high-optout") {
      filtered = filtered.filter(c => c.opt_out_rate >= 2);
    }

    return filtered;
  }, [campaigns, campaignFilter, performanceFilter]);

  // Campaign ROI comparison chart data
  const roiComparisonData = campaigns
    .filter(c => c.cost > 0)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8)
    .map(c => ({
      name: c.campaign_name.length > 15 ? c.campaign_name.slice(0, 15) + '...' : c.campaign_name,
      roi: c.roi,
      raised: c.amount_raised,
      cost: c.cost,
    }));

  // Trend chart data
  const trendChartData = dailyMetrics.map(d => ({
    name: format(parseISO(d.date), 'MMM d'),
    Sent: d.messages_sent,
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
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-success))]" />
            <span className="text-xs portal-text-secondary">ROI</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{roi.toFixed(2)}x</div>
          <TrendIndicator value={calcChange(roi, prevRoi)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="text-xs portal-text-secondary">Amount Raised</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">${totals.raised.toLocaleString()}</div>
          <TrendIndicator value={calcChange(totals.raised, prevTotals.raised)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-xs portal-text-secondary">Delivery Rate</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{deliveryRate.toFixed(1)}%</div>
          <TrendIndicator value={calcChange(deliveryRate, prevDeliveryRate)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-[hsl(var(--portal-success))]" />
            <span className="text-xs portal-text-secondary">CTR</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{ctr.toFixed(2)}%</div>
          <span className="text-xs portal-text-muted">{totals.clicks.toLocaleString()} clicks</span>
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`h-4 w-4 ${optOutRate > 2 ? 'text-[hsl(var(--portal-warning))]' : 'text-[hsl(var(--portal-text-muted))]'}`} />
            <span className="text-xs portal-text-secondary">Opt-out Rate</span>
          </div>
          <div className={`text-xl font-bold ${optOutRate > 2 ? 'text-[hsl(var(--portal-warning))]' : 'portal-text-primary'}`}>
            {optOutRate.toFixed(2)}%
          </div>
          <span className="text-xs portal-text-muted">{totals.optOuts.toLocaleString()} opt-outs</span>
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
            <PortalLineChart
              data={trendChartData}
              lines={[
                { dataKey: "Sent", stroke: CHART_COLORS.sent, name: "Messages Sent" },
                { dataKey: "Conversions", stroke: CHART_COLORS.conversions, name: "Conversions" },
              ]}
              height={250}
            />
          </PortalCardContent>
        </PortalCard>
      )}

      {/* Campaign ROI Comparison */}
      {roiComparisonData.length > 0 && (
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Campaign ROI Comparison
            </PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={roiComparisonData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--portal-border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--portal-text-muted))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--portal-bg-tertiary))",
                    border: "1px solid hsl(var(--portal-border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'roi' ? `${value.toFixed(2)}x` : `$${value.toLocaleString()}`,
                    name === 'roi' ? 'ROI' : name === 'raised' ? 'Raised' : 'Cost'
                  ]}
                />
                <Legend />
                <Bar dataKey="roi" fill={CHART_COLORS.conversions} name="ROI" radius={[4, 4, 0, 0]}>
                  {roiComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.roi >= 2 ? CHART_COLORS.conversions : "hsl(var(--portal-text-muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PortalCardContent>
        </PortalCard>
      )}

      {/* Campaign Details Table with Filters */}
      <PortalCard>
        <PortalCardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <PortalCardTitle>Campaign Details</PortalCardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 portal-text-muted" />
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Performance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Performance</SelectItem>
                  <SelectItem value="high-roi">High ROI (2x+)</SelectItem>
                  <SelectItem value="high-optout">High Opt-out (2%+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={filteredCampaigns}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium portal-text-primary">{value}</span>,
              },
              {
                key: "messages_sent",
                label: "Sent",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
              {
                key: "delivery_rate",
                label: "Delivery",
                sortable: true,
                className: "text-right",
                render: (value) => <span className={value < 90 ? 'text-[hsl(var(--portal-warning))]' : ''}>{value.toFixed(1)}%</span>,
                hiddenOnMobile: true,
              },
              {
                key: "roi",
                label: "ROI",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className={value >= 2 ? 'text-[hsl(var(--portal-success))] font-semibold' : ''}>
                    {value.toFixed(2)}x
                  </span>
                ),
              },
              {
                key: "amount_raised",
                label: "Raised",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
              },
              {
                key: "cost",
                label: "Cost",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
                hiddenOnMobile: true,
              },
              {
                key: "opt_out_rate",
                label: "Opt-out",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className={value >= 2 ? 'text-[hsl(var(--portal-warning))]' : ''}>
                    {value.toFixed(2)}%
                  </span>
                ),
                hiddenOnMobile: true,
              },
              {
                key: "conversions",
                label: "Conv.",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
            ]}
            keyExtractor={(row) => row.campaign_id}
            isLoading={isLoading}
            emptyMessage="No SMS campaigns found"
            emptyAction={
              <p className="text-sm portal-text-muted">
                Connect your SMS platform to see campaign data
              </p>
            }
          />
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default SMSMetrics;
