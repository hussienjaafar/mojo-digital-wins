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
  V3DataTable,
  type V3Column,
} from "@/components/v3";
import { MessageSquare, DollarSign, Target, TrendingUp, BarChart3, AlertTriangle, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { EChartsBarChart, EChartsCombinationChart } from "@/components/charts/echarts";
import { SmallMultiplesChart } from "@/components/charts";
import { useSMSMetricsUnified } from "@/hooks/useActBlueMetrics";
import { formatRatio, formatCurrency, formatNumber } from "@/lib/chart-formatters";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
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

  // Use unified SMS metrics hook with explicit date range (fixes date mismatch issue)
  const { data, isLoading, error, refetch } = useSMSMetricsUnified(organizationId, startDate, endDate);

  // Memoized derived data from unified RPC
  const { campaigns, dailyMetrics, lastSentDate, summary, previousPeriod } = useMemo(() => ({
    campaigns: data?.campaigns || [],
    dailyMetrics: data?.dailyMetrics || [],
    lastSentDate: data?.campaigns?.[0]?.last_donation || null,
    summary: data?.summary,
    previousPeriod: data?.previousPeriod,
  }), [data]);

  // Current period totals from unified RPC (now includes SMS-specific fields)
  const totals = useMemo(() => ({
    sent: summary?.totalSent || 0,
    delivered: summary?.totalDelivered || 0,
    raised: summary?.totalRaised || 0,
    cost: summary?.totalCost || 0,
    conversions: summary?.totalDonations || 0,
    clicks: summary?.totalClicks || 0,
    optOuts: summary?.totalOptOuts || 0,
  }), [summary]);

  // Previous period totals for trend calculations
  const prevTotals = useMemo(() => ({
    sent: previousPeriod?.totalSent || 0,
    delivered: previousPeriod?.totalDelivered || 0,
    raised: previousPeriod?.totalRaised || 0,
    cost: previousPeriod?.totalCost || 0,
    conversions: previousPeriod?.totalDonations || 0,
    clicks: previousPeriod?.totalClicks || 0,
    optOuts: previousPeriod?.totalOptOuts || 0,
  }), [previousPeriod]);

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

  // Filter campaigns (using refcode-based campaigns from unified data)
  const filteredCampaigns = useMemo(() => {
    let filtered = [...campaigns] as any[];

    if (campaignFilter !== "all") {
      filtered = filtered.filter((c: any) => c.campaign_id === campaignFilter);
    }

    // ROI filtering requires cost data - skip if not available
    if (performanceFilter === "high-roi") {
      filtered = filtered.filter((c: any) => {
        const cost = c.cost || 0;
        const raised = c.raised || 0;
        return cost > 0 && (raised / cost) >= 2;
      });
    }

    return filtered;
  }, [campaigns, campaignFilter, performanceFilter]);

  // Campaign comparison chart data (by raised amount since we may not have cost data)
  const roiComparisonData = useMemo(() => (campaigns as any[])
    .filter((c: any) => (c.raised || 0) > 0)
    .sort((a: any, b: any) => (b.raised || 0) - (a.raised || 0))
    .slice(0, 8)
    .map((c: any) => ({
      name: (c.campaign_name || c.campaign_id || '').length > 15 
        ? (c.campaign_name || c.campaign_id || '').slice(0, 15) + '...' 
        : (c.campaign_name || c.campaign_id || ''),
      roi: c.cost > 0 ? (c.raised / c.cost) : 0,
      raised: c.raised || 0,
      cost: c.cost || 0,
    })), [campaigns]);

  // Trend chart data - correctly map sent and conversions
  // Combined chart data with activity metrics + revenue
  const trendChartData = useMemo(() => (dailyMetrics as any[]).map((d: any) => ({
    name: format(parseISO(d.date), 'MMM d'),
    Sent: d.sent || 0,
    Conversions: d.donations || 0,
    Raised: d.amountRaised || 0,
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

      {/* Main Combo Chart - Messages Sent (bars) + Dollars Raised (line) with visible dates */}
      {trendChartData.length > 0 && (
        <V3ChartWrapper
          title="SMS Activity & Revenue"
          icon={TrendingUp}
          ariaLabel="SMS messages sent and revenue trends over time"
          description="Messages sent as bars, dollars raised as line"
          accent="purple"
        >
          <EChartsCombinationChart
            data={trendChartData}
            xAxisKey="name"
            series={[
              { 
                dataKey: "Sent", 
                name: "Messages Sent", 
                type: "bar",
                color: "#A855F7",
                yAxisIndex: 0,
                valueType: "number",
                barOpacity: 0.6,
              },
              { 
                dataKey: "Raised", 
                name: "Dollars Raised", 
                type: "line",
                color: "#F59E0B",
                yAxisIndex: 1,
                valueType: "currency",
                smooth: true,
                lineWidth: 2,
              },
            ]}
            dualYAxis
            yAxisNameLeft="Sent"
            yAxisNameRight="Raised"
            yAxisValueTypeLeft="number"
            yAxisValueTypeRight="currency"
            height={280}
            showLegend
          />
        </V3ChartWrapper>
      )}

      {/* Conversions Trend - Auto-scaling sparkline for the metric that needs independent scale */}
      {trendChartData.length > 0 && (
        <V3ChartWrapper
          title="Conversion Trend"
          icon={Target}
          ariaLabel="SMS conversion trend over time"
          description="Auto-scaled to show conversion patterns clearly"
          accent="green"
        >
          <SmallMultiplesChart
            data={trendChartData}
            xAxisKey="name"
            panels={[
              { 
                label: "Conversions", 
                dataKey: "Conversions", 
                color: "#22C55E",
                valueType: "number",
                icon: Target,
              },
            ]}
            panelHeight={72}
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
          <EChartsBarChart
            data={roiComparisonData}
            xAxisKey="name"
            series={[
              { dataKey: "roi", name: "ROI" },
            ]}
            valueType="ratio"
            height={280}
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
          <V3DataTable
            data={filteredCampaigns}
            getRowKey={(row) => row.campaign_id}
            pagination
            pageSize={10}
            emptyTitle="No campaigns match the selected filters"
            emptyDescription="Try adjusting your filter criteria"
            columns={[
              {
                key: "campaign_name",
                header: "Campaign",
                sortable: true,
                sortFn: (a, b) => (a.campaign_name || a.campaign_id || '').localeCompare(b.campaign_name || b.campaign_id || ''),
                render: (row) => <span className="font-medium text-[hsl(var(--portal-text-primary))]">{row.campaign_name || row.campaign_id}</span>,
              },
              {
                key: "donations",
                header: "Donations",
                align: "right",
                sortable: true,
                sortFn: (a, b) => (a.donations || 0) - (b.donations || 0),
                render: (row) => formatNumber(row.donations || 0),
              },
              {
                key: "donors",
                header: "Donors",
                align: "right",
                sortable: true,
                sortFn: (a, b) => (a.donors || 0) - (b.donors || 0),
                hideOnMobile: true,
                render: (row) => formatNumber(row.donors || 0),
              },
              {
                key: "raised",
                header: "Raised",
                align: "right",
                sortable: true,
                sortFn: (a, b) => (a.raised || 0) - (b.raised || 0),
                render: (row) => formatCurrency(row.raised || 0),
              },
              {
                key: "net",
                header: "Net",
                align: "right",
                sortable: true,
                sortFn: (a, b) => (a.net || 0) - (b.net || 0),
                hideOnMobile: true,
                render: (row) => formatCurrency(row.net || 0),
              },
              {
                key: "last_donation",
                header: "Last Activity",
                align: "right",
                hideOnMobile: true,
                render: (row) => row.last_donation ? format(parseISO(row.last_donation), 'MMM d') : '—',
              },
            ] as V3Column<typeof filteredCampaigns[0]>[]}
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default SMSMetrics;
