import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
  V3EmptyState,
} from "@/components/v3";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { MessageSquare, DollarSign, Target, TrendingUp, BarChart3, AlertTriangle, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { PortalMultiBarChart } from "@/components/portal/PortalMultiBarChart";
import { useSMSMetricsQuery } from "@/queries";
import { formatRatio, formatCurrency } from "@/lib/chart-formatters";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

const CHART_COLORS = {
  sent: "hsl(var(--portal-accent-purple))",
  conversions: "hsl(var(--portal-success))",
  raised: "hsl(var(--portal-accent-blue))",
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

const SMSMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");

  // Use TanStack Query hook instead of direct Supabase calls
  const { data, isLoading, error, refetch } = useSMSMetricsQuery(organizationId);

  // Memoized derived data
  const { metrics, dailyMetrics, previousPeriodMetrics, lastSentDate } = useMemo(() => ({
    metrics: data?.metrics || {},
    dailyMetrics: data?.dailyMetrics || [],
    previousPeriodMetrics: data?.previousPeriodMetrics || {},
    lastSentDate: data?.lastSentDate || null,
  }), [data]);

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
  const roiComparisonData = useMemo(() => campaigns
    .filter(c => c.cost > 0)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8)
    .map(c => ({
      name: c.campaign_name.length > 15 ? c.campaign_name.slice(0, 15) + '...' : c.campaign_name,
      roi: c.roi,
      raised: c.amount_raised,
      cost: c.cost,
    })), [campaigns]);

  // Trend chart data
  const trendChartData = useMemo(() => dailyMetrics.map(d => ({
    name: format(parseISO(d.date), 'MMM d'),
    Sent: d.messages_sent,
    Conversions: d.conversions,
  })), [dailyMetrics]);

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
        title="Failed to load SMS data"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
      />
    );
  }

  // Show empty state if no campaigns
  if (campaigns.length === 0 && !isLoading) {
    return (
      <V3EmptyState
        icon={MessageSquare}
        title="No SMS campaigns found"
        description={
          lastSentDate
            ? `No SMS campaigns in selected date range. Last campaign sent: ${format(parseISO(lastSentDate), 'MMM d, yyyy')}`
            : "Connect your SMS platform to see campaign data."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
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
            label="ROI"
            value={formatRatio(roi, 2)}
            trend={{ value: calcChange(roi, prevRoi), isPositive: roi >= prevRoi }}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={DollarSign}
            label="Amount Raised"
            value={formatCurrency(totals.raised, true)}
            trend={{ value: calcChange(totals.raised, prevTotals.raised) }}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={MessageSquare}
            label="Delivery Rate"
            value={`${deliveryRate.toFixed(1)}%`}
            trend={{ value: calcChange(deliveryRate, prevDeliveryRate) }}
            accent="purple"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Target}
            label="CTR"
            value={`${ctr.toFixed(2)}%`}
            subtitle={`${totals.clicks.toLocaleString()} clicks`}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={AlertTriangle}
            label="Opt-out Rate"
            value={`${optOutRate.toFixed(2)}%`}
            subtitle={`${totals.optOuts.toLocaleString()} opt-outs`}
            accent={optOutRate > 2 ? "amber" : "default"}
          />
        </motion.div>
      </motion.div>

      {/* Performance Trend Chart */}
      {trendChartData.length > 0 && (
        <V3ChartWrapper
          title="Performance Trend"
          icon={TrendingUp}
          ariaLabel="SMS campaign performance trend chart showing messages sent and conversions over time"
          description="Line chart displaying daily SMS send volume and conversion trends"
          accent="purple"
        >
          <PortalLineChart
            data={trendChartData}
            lines={[
              { dataKey: "Sent", name: "Messages Sent", stroke: CHART_COLORS.sent, valueType: "number" },
              { dataKey: "Conversions", name: "Conversions", stroke: CHART_COLORS.conversions, valueType: "number" },
            ]}
            valueType="number"
            ariaLabel="SMS campaign performance trend showing messages sent and conversions over time"
          />
        </V3ChartWrapper>
      )}

      {/* Campaign ROI Comparison */}
      {roiComparisonData.length > 0 && (
        <V3ChartWrapper
          title="Campaign ROI Comparison"
          icon={BarChart3}
          ariaLabel="SMS campaign ROI comparison bar chart showing return on investment by campaign"
          description="Bar chart comparing ROI performance across top SMS campaigns"
          accent="purple"
        >
          <PortalMultiBarChart
            data={roiComparisonData}
            bars={[
              { dataKey: "roi", name: "ROI", fill: CHART_COLORS.conversions, valueType: "ratio" },
            ]}
            valueType="ratio"
            ariaLabel="Campaign ROI comparison showing return on investment by campaign"
          />
        </V3ChartWrapper>
      )}

      {/* Campaign Details Table with Filters */}
      <V3Card accent="purple">
        <V3CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <V3CardTitle>Campaign Details</V3CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs" aria-label="Filter by performance">
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
        </V3CardHeader>
        <V3CardContent>
          <PortalTable
            data={filteredCampaigns}
            keyExtractor={(row) => row.campaign_id}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium text-[hsl(var(--portal-text-primary))]">{value}</span>,
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
                render: (value) => (
                  <span className={value < 90 ? 'text-[hsl(var(--portal-warning))]' : ''}>
                    {value.toFixed(1)}%
                  </span>
                ),
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
            ]}
            emptyMessage="No campaigns match the selected filters"
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default SMSMetrics;
