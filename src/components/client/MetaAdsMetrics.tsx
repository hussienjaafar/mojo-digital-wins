import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3KPICardWithSparkline,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
  V3EmptyState,
  V3InsightBadge,
  V3DataTable,
  type V3Column,
} from "@/components/v3";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { Target, MousePointer, Eye, DollarSign, TrendingUp, BarChart3, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { EChartsLineChart } from "@/components/charts/echarts";
import { EChartsBarChart } from "@/components/charts/echarts";
import { MetaDataFreshnessIndicator } from "./MetaDataFreshnessIndicator";
import { useMetaAdsMetricsQuery } from "@/queries";
import { useAnomalyDetection } from "@/hooks/useAnomalyDetection";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsSingleDayView } from "@/hooks/useHourlyMetrics";
import { formatRatio, formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { SingleDayMetricGrid, type SingleDayMetric } from "./SingleDayMetricGrid";
import { TopCreativesSection } from "./TopCreativesSection";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
  /** Optional controlled filter state for status filter */
  statusFilter?: string;
  /** Optional controlled filter state for performance filter */
  performanceFilter?: string;
  /** Callback when status filter changes (for controlled mode) */
  onStatusFilterChange?: (value: string) => void;
  /** Callback when performance filter changes (for controlled mode) */
  onPerformanceFilterChange?: (value: string) => void;
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

const MetaAdsMetrics = ({
  organizationId,
  startDate,
  endDate,
  statusFilter: controlledStatusFilter,
  performanceFilter: controlledPerformanceFilter,
  onStatusFilterChange,
  onPerformanceFilterChange,
}: Props) => {
  // Internal state for uncontrolled mode (e.g., Admin view)
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>("all");
  const [internalPerformanceFilter, setInternalPerformanceFilter] = useState<string>("all");

  // Breakdown chart metric toggle
  const [breakdownMetric, setBreakdownMetric] = useState<"spend" | "conversions" | "roas">("spend");

  // Use controlled props if provided, otherwise fall back to internal state
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;
  const performanceFilter = controlledPerformanceFilter ?? internalPerformanceFilter;

  const handleStatusFilterChange = (value: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(value);
    } else {
      setInternalStatusFilter(value);
    }
  };

  const handlePerformanceFilterChange = (value: string) => {
    if (onPerformanceFilterChange) {
      onPerformanceFilterChange(value);
    } else {
      setInternalPerformanceFilter(value);
    }
  };

  const isMobile = useIsMobile();
  const isSingleDay = useIsSingleDayView();

  // Use TanStack Query hook with dashboard date range
  const { data, isLoading, error, refetch } = useMetaAdsMetricsQuery(organizationId, startDate, endDate);

  // Memoized derived data
  const { campaigns, metrics, dailyMetrics, previousPeriodMetrics } = useMemo(() => ({
    campaigns: data?.campaigns || [],
    metrics: data?.metrics || {},
    dailyMetrics: data?.dailyMetrics || [],
    previousPeriodMetrics: data?.previousPeriodMetrics || {},
  }), [data]);

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
  const tableData = useMemo(() => filteredCampaigns.map(campaign => {
    const metric = metrics[campaign.campaign_id] || {
      impressions: 0, clicks: 0, spend: 0, conversions: 0, cpc: 0, ctr: 0, roas: 0, cpm: 0,
    };
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name || campaign.campaign_id,
      status: campaign.status,
      ...metric,
    };
  }), [filteredCampaigns, metrics]);

  // Prepare chart data for campaign breakdown (sorted by selected metric)
  // Show fewer campaigns on mobile for better label readability
  const maxBreakdownCampaigns = isMobile ? 4 : 8;
  const campaignBreakdownData = useMemo(() => tableData
    .filter(c => Number(c[breakdownMetric]) > 0)
    .sort((a, b) => b[breakdownMetric] - a[breakdownMetric])
    .slice(0, maxBreakdownCampaigns)
    .map(c => ({
      name: c.campaign_name,
      value: c[breakdownMetric],
    })), [tableData, breakdownMetric, maxBreakdownCampaigns]);

  // Breakdown chart config based on selected metric
  const breakdownChartConfig = useMemo(() => {
    const configs = {
      spend: {
        title: "Campaign Breakdown - Spend",
        description: "Top campaigns ranked by advertising spend",
        ariaLabel: "Bar chart showing top campaigns by spend",
        valueType: "currency" as const,
        color: CHART_COLORS.spend,
        seriesName: "Spend",
      },
      conversions: {
        title: "Campaign Breakdown - Conversions",
        description: "Top campaigns ranked by conversion count",
        ariaLabel: "Bar chart showing top campaigns by conversions",
        valueType: "number" as const,
        color: CHART_COLORS.conversions,
        seriesName: "Conversions",
      },
      roas: {
        title: "Campaign Breakdown - ROAS",
        description: "Top campaigns ranked by return on ad spend (ratio)",
        ariaLabel: "Bar chart showing top campaigns by ROAS",
        valueType: "ratio" as const,
        color: "hsl(var(--portal-accent-purple))",
        seriesName: "ROAS",
      },
    };
    return configs[breakdownMetric];
  }, [breakdownMetric]);

  // Truncate campaign names for axis labels
  // Mobile: short truncation (10 chars) for rotated labels
  // Desktop: longer truncation (15 chars) for horizontal labels
  const truncateCampaignName = useMemo(() => {
    const maxLength = isMobile ? 10 : 15;
    return (name: string) => {
      // Normalize underscores and dashes to spaces
      const normalized = name.replace(/[_-]/g, ' ');
      return normalized.length > maxLength
        ? normalized.slice(0, maxLength - 3) + '...'
        : normalized;
    };
  }, [isMobile]);

  // Prepare trend chart data (keep ISO date strings for time axis)
  const trendChartData = useMemo(() => dailyMetrics.map(d => ({
    date: d.date,
    spend: d.spend,
    conversions: d.conversions,
  })), [dailyMetrics]);

  // Downsampled trend data for mobile chart display (10-12 points)
  // Keep full data for table and screen reader summaries
  const trendChartDisplayData = useMemo(() => {
    if (!isMobile || trendChartData.length <= 12) {
      return trendChartData;
    }
    // Evenly sample ~12 points from the full dataset
    const targetCount = 12;
    const step = (trendChartData.length - 1) / (targetCount - 1);
    const sampled: typeof trendChartData = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.round(i * step);
      sampled.push(trendChartData[idx]);
    }
    return sampled;
  }, [isMobile, trendChartData]);

  // SR-only data summary for Performance Trend chart
  const trendDataSummary = useMemo(() => {
    if (trendChartData.length === 0) return undefined;
    const latest = trendChartData[trendChartData.length - 1];
    const formattedDate = format(new Date(latest.date), "MMM d, yyyy");
    const spendFormatted = `$${latest.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return `Latest data point: ${spendFormatted} spend, ${latest.conversions.toLocaleString()} conversions on ${formattedDate}.`;
  }, [trendChartData]);

  // SR-only data summary for Campaign Breakdown chart
  const breakdownDataSummary = useMemo(() => {
    if (campaignBreakdownData.length === 0) return undefined;
    const top = campaignBreakdownData[0];
    const metricLabel = breakdownChartConfig.seriesName;
    const valueFormatted = breakdownMetric === "spend"
      ? `$${top.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : breakdownMetric === "roas"
      ? `${top.value.toFixed(2)}x`
      : top.value.toLocaleString();
    return `Showing ${metricLabel}. Top campaign: ${top.name} with ${valueFormatted}.`;
  }, [campaignBreakdownData, breakdownChartConfig.seriesName, breakdownMetric]);

  // Sparkline data for KPIs
  const spendSparkline = useMemo(() => dailyMetrics.slice(-14).map(d => d.spend), [dailyMetrics]);
  const conversionSparkline = useMemo(() => dailyMetrics.slice(-14).map(d => d.conversions), [dailyMetrics]);

  // Anomaly detection for spend
  const spendAnalysis = useAnomalyDetection(
    dailyMetrics.map(d => ({ date: d.date, value: d.spend })),
    { threshold: 2 }
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-[var(--portal-space-lg)]">
        <V3LoadingState variant="kpi-grid" count={5} />
        <V3LoadingState variant="chart" height={isMobile ? 240 : 280} />
        <V3LoadingState variant="table" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <V3ErrorState
        title="Failed to load Meta Ads data"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
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
    <div className="space-y-[var(--portal-space-lg)]">
      {/* Panel Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[hsl(var(--portal-border)/0.5)]">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
          Meta Ads Overview
        </h4>
        <MetaDataFreshnessIndicator organizationId={organizationId} compact />
      </div>

      {/* V3 KPI Cards with Period Comparison */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <V3KPICardWithSparkline
            icon={DollarSign}
            label="ROAS"
            value={formatRatio(roas, 2)}
            trend={{ value: calcChange(roas, prevRoas), isPositive: roas >= prevRoas }}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICardWithSparkline
            icon={DollarSign}
            label="Spend"
            value={formatCurrency(totals.spend, true)}
            trend={{ value: calcChange(totals.spend, previousTotals.spend), isPositive: totals.spend <= previousTotals.spend }}
            sparklineData={spendSparkline}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICardWithSparkline
            icon={Target}
            label="Conversions"
            value={totals.conversions.toLocaleString()}
            trend={{ value: calcChange(totals.conversions, previousTotals.conversions) }}
            sparklineData={conversionSparkline}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICardWithSparkline
            icon={MousePointer}
            label="CTR"
            value={`${avgCTR.toFixed(2)}%`}
            trend={{ value: calcChange(avgCTR, prevCTR) }}
            accent="purple"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICardWithSparkline
            icon={Eye}
            label="CPM"
            value={`$${cpm.toFixed(2)}`}
            trend={{ value: calcChange(cpm, prevCPM), isPositive: cpm <= prevCPM }}
            accent="default"
          />
        </motion.div>
      </motion.div>

      {/* Insights */}
      {spendAnalysis.insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {spendAnalysis.insights.map((insight, i) => (
            <V3InsightBadge key={i} type={insight.type}>
              {insight.message}
            </V3InsightBadge>
          ))}
        </div>
      )}

      {/* Single-Day View: Top Creatives + Secondary Metrics Grid */}
      {isSingleDay && (
        <>
          {/* Top Performing Creatives for the selected day */}
          <TopCreativesSection
            organizationId={organizationId}
            startDate={startDate}
            endDate={endDate}
            maxItems={5}
          />

          {/* Additional metrics in grid format for single day */}
          <V3Card accent="blue">
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm">Detailed Metrics</V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <SingleDayMetricGrid
                metrics={[
                  { label: "Impressions", value: totals.impressions, previousValue: previousTotals.impressions, format: "number", accent: "purple" },
                  { label: "Clicks", value: totals.clicks, previousValue: previousTotals.clicks, format: "number", accent: "blue" },
                  { label: "CPC", value: avgCPC, previousValue: previousTotals.clicks > 0 ? previousTotals.spend / previousTotals.clicks : 0, format: "currency", accent: "default" },
                  { label: "Reach", value: totals.reach, previousValue: previousTotals.reach, format: "number", accent: "green" },
                ] as SingleDayMetric[]}
                columns={4}
              />
            </V3CardContent>
          </V3Card>
        </>
      )}

      {/* Multi-Day View: Performance Trend Chart */}
      {!isSingleDay && trendChartData.length > 0 && (
        <div className="space-y-2">
          <V3ChartWrapper
            title="Performance Trend"
            icon={TrendingUp}
            ariaLabel="Meta Ads performance trend chart showing spend and conversions over time"
            description="Line chart displaying daily spend and conversion trends for Meta advertising campaigns"
            dataSummary={trendDataSummary}
            accent="blue"
          >
            <EChartsLineChart
              data={trendChartDisplayData}
              xAxisKey="date"
              xAxisType="time"
              series={[
                { dataKey: "spend", name: "Spend", color: CHART_COLORS.spend, type: "area", valueType: "currency" },
                { dataKey: "conversions", name: "Conversions", color: CHART_COLORS.conversions, yAxisIndex: 1, valueType: "number" },
              ]}
              valueType="number"
              yAxisNameLeft="Spend ($)"
              yAxisNameRight="Conversions"
              yAxisValueTypeLeft="currency"
              yAxisValueTypeRight="number"
              dualYAxis
              showZoom={!isMobile}
              height={isMobile ? 240 : 280}
            />
          </V3ChartWrapper>
          {/* Collapsible data table */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-1 rounded px-1 py-0.5 w-fit transition-colors">
              View data table
            </summary>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[hsl(var(--portal-border))]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--portal-text-secondary))]">Date</th>
                    <th className="px-3 py-2 text-right font-medium text-[hsl(var(--portal-text-secondary))]">Spend</th>
                    <th className="px-3 py-2 text-right font-medium text-[hsl(var(--portal-text-secondary))]">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {trendChartData.map((row, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--portal-border)/0.5)] last:border-b-0">
                      <td className="px-3 py-2 text-[hsl(var(--portal-text-primary))] whitespace-nowrap">
                        {format(new Date(row.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2 text-right text-[hsl(var(--portal-text-primary))] tabular-nums">
                        ${row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 text-right text-[hsl(var(--portal-text-primary))] tabular-nums">
                        {row.conversions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Multi-Day View: Campaign Breakdown Chart */}
      {!isSingleDay && campaignBreakdownData.length > 0 && (
        <div className="space-y-2">
          <V3ChartWrapper
            title={breakdownChartConfig.title}
            icon={BarChart3}
            ariaLabel={breakdownChartConfig.ariaLabel}
            description={breakdownChartConfig.description}
            dataSummary={breakdownDataSummary}
            accent="blue"
            actions={
              <Select value={breakdownMetric} onValueChange={(v) => setBreakdownMetric(v as typeof breakdownMetric)}>
                <SelectTrigger className="w-[130px] h-8 text-xs" aria-label="Select breakdown metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="roas">ROAS</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <EChartsBarChart
              data={campaignBreakdownData}
              xAxisKey="name"
              series={[
                {
                  dataKey: "value",
                  name: breakdownChartConfig.seriesName,
                  color: breakdownChartConfig.color,
                  valueType: breakdownChartConfig.valueType,
                },
              ]}
              valueType={breakdownChartConfig.valueType}
              axisValueType={breakdownChartConfig.valueType}
              xAxisLabelFormatter={truncateCampaignName}
              height={isMobile ? 350 : 280}
              horizontal={false}
              showLegend={!isMobile}
              disableHoverEmphasis
              xAxisLabelRotate={isMobile ? 45 : 0}
            />
          </V3ChartWrapper>
          {/* Collapsible data table */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-1 rounded px-1 py-0.5 w-fit transition-colors">
              View data table
            </summary>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[hsl(var(--portal-border))]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
                    <th className="px-3 py-2 text-left font-medium text-[hsl(var(--portal-text-secondary))]">Campaign</th>
                    <th className="px-3 py-2 text-right font-medium text-[hsl(var(--portal-text-secondary))]">{breakdownChartConfig.seriesName}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignBreakdownData.map((row, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--portal-border)/0.5)] last:border-b-0">
                      <td className="px-3 py-2 text-[hsl(var(--portal-text-primary))]">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-right text-[hsl(var(--portal-text-primary))] tabular-nums">
                        {breakdownMetric === "spend"
                          ? `$${row.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : breakdownMetric === "roas"
                          ? `${row.value.toFixed(2)}x`
                          : row.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Campaign Table */}
      <V3Card accent="blue">
        <V3CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <V3CardTitle className="min-w-0 line-clamp-2 md:line-clamp-1">Campaign Performance</V3CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="hidden md:block h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full md:w-[120px] h-8 text-xs" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={performanceFilter} onValueChange={handlePerformanceFilterChange}>
                <SelectTrigger className="w-full md:w-[130px] h-8 text-xs" aria-label="Filter by performance">
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
          <V3DataTable
            data={tableData}
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
                sortFn: (a, b) => a.campaign_name.localeCompare(b.campaign_name),
                render: (row) => <span className="font-medium text-[hsl(var(--portal-text-primary))]">{row.campaign_name}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <PortalBadge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {row.status}
                  </PortalBadge>
                ),
              },
              {
                key: "spend",
                header: "Spend",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.spend - b.spend,
                render: (row) => formatCurrency(row.spend),
              },
              {
                key: "impressions",
                header: "Impr.",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.impressions - b.impressions,
                hideOnMobile: true,
                render: (row) => formatNumber(row.impressions),
              },
              {
                key: "clicks",
                header: "Clicks",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.clicks - b.clicks,
                hideOnMobile: true,
                render: (row) => formatNumber(row.clicks),
              },
              {
                key: "ctr",
                header: "CTR",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.ctr - b.ctr,
                hideOnMobile: true,
                render: (row) => `${row.ctr.toFixed(2)}%`,
              },
              {
                key: "conversions",
                header: "Conv",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.conversions - b.conversions,
                render: (row) => formatNumber(row.conversions),
              },
              {
                key: "roas",
                header: "ROAS",
                align: "right",
                sortable: true,
                sortFn: (a, b) => a.roas - b.roas,
                render: (row) => (
                  <span className={row.roas >= 2 ? 'text-[hsl(var(--portal-success))] font-semibold' : ''}>
                    {row.roas.toFixed(2)}x
                  </span>
                ),
              },
            ] as V3Column<typeof tableData[0]>[]}
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default MetaAdsMetrics;
