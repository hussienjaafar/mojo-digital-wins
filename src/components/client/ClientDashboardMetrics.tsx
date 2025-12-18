import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardContent,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
} from "@/components/v3";
import { HeroKpiGrid, type HeroKpiData } from "@/components/client/HeroKpiGrid";
import type { HeroKpiAccent } from "@/components/client/HeroKpiCard";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { DollarSign, Users, TrendingUp, Repeat, Target, MessageSquare, Wifi, WifiOff, Wallet, CopyMinus, SlidersHorizontal, ZoomIn } from "lucide-react";
import { format, parseISO } from "date-fns";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClientDashboardMetricsQuery } from "@/queries";
import { useHoveredDataPoint } from "@/stores/chartInteractionStore";
import type { KpiKey, SeriesKey } from "@/stores/dashboardStore";
import { cssVar, colors } from "@/lib/design-tokens";

interface ClientDashboardMetricsProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

// Semantic chart palette using design system tokens
const palette = {
  gross: cssVar(colors.status.success),
  net: cssVar(colors.accent.blue),
  refunds: cssVar(colors.status.error),
  meta: cssVar(colors.accent.blue),
  sms: cssVar(colors.accent.purple),
  grossPrev: cssVar(colors.status.success, 0.5),
  netPrev: cssVar(colors.accent.blue, 0.5),
  refundsPrev: cssVar(colors.status.error, 0.5),
  metaPrev: cssVar(colors.accent.blue, 0.5),
  smsPrev: cssVar(colors.accent.purple, 0.5),
};


export const ClientDashboardMetrics = ({ organizationId, startDate, endDate }: ClientDashboardMetricsProps) => {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [valueMode, setValueMode] = useState<"both" | "net">("both");
  const [showZoom, setShowZoom] = useState(false);
  
  // Cross-highlighting state from store
  const hoveredDataPoint = useHoveredDataPoint();

  // Use TanStack Query hook
  const { data, isLoading, error, refetch } = useClientDashboardMetricsQuery(organizationId);

  const kpis = data?.kpis;
  const prevKpis = data?.prevKpis || {};
  const timeSeriesData = data?.timeSeries || [];
  const channelBreakdown = data?.channelBreakdown || [];
  const sparklines = data?.sparklines;

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Real-time subscription for live donation updates
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-realtime-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'actblue_transactions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.info('New donation received via realtime', payload.new);
          const newDonation = payload.new as any;
          
          // Check if donation falls within current date range
          const txDate = newDonation.transaction_date;
          if (txDate >= startDate && txDate <= `${endDate}T23:59:59`) {
            // Refetch data to update KPIs
            refetch();
            
            toast.success(`New donation: $${Number(newDonation.amount).toFixed(2)}`, {
              description: newDonation.donor_name || 'Anonymous donor',
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
          logger.info('Dashboard realtime connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false);
          logger.warn('Dashboard realtime disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, startDate, endDate, refetch]);

  // Calculate percentage change
  const calcChange = useCallback((current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }, []);

  const formatCurrency = useCallback((value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  // Memoized ECharts series configuration with seriesKey for cross-highlighting
  const echartsSeriesConfig = useMemo((): LineSeriesConfig[] => {
    const base: LineSeriesConfig[] = valueMode === "net"
      ? [
          { dataKey: "netDonations", name: "Net donations", color: palette.net, type: "area", areaStyle: { opacity: 0.1 }, seriesKey: "netDonations" as SeriesKey },
          { dataKey: "refunds", name: "Refunds (negative)", color: palette.refunds, lineStyle: { type: "dashed" }, seriesKey: "refunds" as SeriesKey },
          { dataKey: "metaSpend", name: "Meta spend", color: palette.meta, seriesKey: "metaSpend" as SeriesKey },
          { dataKey: "smsSpend", name: "SMS spend", color: palette.sms, seriesKey: "smsSpend" as SeriesKey },
        ]
      : [
          { dataKey: "donations", name: "Gross donations", color: palette.gross, type: "area", areaStyle: { opacity: 0.1 }, seriesKey: "donations" as SeriesKey },
          { dataKey: "netDonations", name: "Net donations", color: palette.net, seriesKey: "netDonations" as SeriesKey },
          { dataKey: "refunds", name: "Refunds (negative)", color: palette.refunds, lineStyle: { type: "dashed" }, seriesKey: "refunds" as SeriesKey },
          { dataKey: "metaSpend", name: "Meta spend", color: palette.meta, seriesKey: "metaSpend" as SeriesKey },
          { dataKey: "smsSpend", name: "SMS spend", color: palette.sms, seriesKey: "smsSpend" as SeriesKey },
        ];

    if (!showCompare) return base;

    // Compare overlays limited to primary revenue series only (reduces clutter)
    // Refunds/spend prev lines omitted - current values are what matters for spend tracking
    const compare: LineSeriesConfig[] = valueMode === "net"
      ? [
          { dataKey: "netDonationsPrev", name: "Net (prev)", color: palette.netPrev, lineStyle: { type: "dashed", width: 1 } },
        ]
      : [
          { dataKey: "donationsPrev", name: "Gross (prev)", color: palette.grossPrev, lineStyle: { type: "dashed", width: 1 } },
          { dataKey: "netDonationsPrev", name: "Net (prev)", color: palette.netPrev, lineStyle: { type: "dashed", width: 1 } },
        ];

    return [...base, ...compare];
  }, [showCompare, valueMode]);

  // Build trend data for drilldown from time series
  const buildTrendData = useCallback((dataKey: string) => {
    if (!timeSeriesData || timeSeriesData.length === 0) return undefined;
    return timeSeriesData.map((d: any) => ({
      date: d.name,
      value: d[dataKey] ?? 0,
    }));
  }, [timeSeriesData]);

  // Hero KPIs configuration with sparkline data and kpiKey for cross-highlighting
  const heroKpis: HeroKpiData[] = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        kpiKey: "netRevenue" as KpiKey,
        label: "Net Revenue",
        value: formatCurrency(kpis.totalNetRevenue),
        icon: Wallet,
        trend: {
          value: Math.round(calcChange(kpis.totalNetRevenue, prevKpis.totalNetRevenue)),
          isPositive: kpis.totalNetRevenue >= (prevKpis.totalNetRevenue || 0),
          label: "vs prev",
        },
        previousValue: prevKpis.totalNetRevenue ? formatCurrency(prevKpis.totalNetRevenue) : undefined,
        subtitle: `Gross: ${formatCurrency(kpis.totalRaised)} (${kpis.feePercentage.toFixed(1)}% fees)`,
        accent: "green" as HeroKpiAccent,
        sparklineData: sparklines?.netRevenue || [],
        description: "Total donations minus processing fees and refunds",
        // Drilldown data
        trendData: buildTrendData("netDonations"),
        trendXAxisKey: "date",
        breakdown: [
          { label: "Gross Revenue", value: formatCurrency(kpis.totalRaised) },
          { label: "Processing Fees", value: `-${formatCurrency(kpis.totalFees || 0)}`, percentage: kpis.feePercentage },
          { label: "Refunds", value: `-${formatCurrency(kpis.refundAmount)}`, percentage: kpis.refundRate },
          { label: "Net Revenue", value: formatCurrency(kpis.totalNetRevenue) },
        ],
      },
      {
        kpiKey: "netRoi" as KpiKey,
        label: "Net ROI",
        value: `${kpis.roi.toFixed(1)}x`,
        icon: TrendingUp,
        trend: {
          value: Math.round(calcChange(kpis.roi, prevKpis.roi)),
          isPositive: kpis.roi >= (prevKpis.roi || 0),
          label: "vs prev",
        },
        previousValue: prevKpis.roi ? `${prevKpis.roi.toFixed(1)}x` : undefined,
        subtitle: `Spend: ${formatCurrency(kpis.totalSpend)}`,
        accent: "blue" as HeroKpiAccent,
        sparklineData: sparklines?.roi || [],
        description: "Return on investment: Net Revenue / Total Spend",
        // Drilldown data
        trendData: buildTrendData("netDonations"),
        trendXAxisKey: "date",
        breakdown: [
          { label: "Net Revenue", value: formatCurrency(kpis.totalNetRevenue) },
          { label: "Meta Ad Spend", value: formatCurrency(data?.metaSpend || 0) },
          { label: "SMS Spend", value: formatCurrency(data?.smsSpend || 0) },
          { label: "Total Spend", value: formatCurrency(kpis.totalSpend) },
          { label: "ROI Multiplier", value: `${kpis.roi.toFixed(2)}x` },
        ],
      },
      {
        kpiKey: "refundRate" as KpiKey,
        label: "Refund Rate",
        value: `${kpis.refundRate.toFixed(1)}%`,
        icon: Target,
        trend: {
          value: Math.round(calcChange(kpis.refundRate, prevKpis.refundRate)),
          isPositive: kpis.refundRate <= (prevKpis.refundRate || 0),
          label: "vs prev",
        },
        previousValue: prevKpis.refundRate ? `${prevKpis.refundRate.toFixed(1)}%` : undefined,
        subtitle: `Refunds: ${formatCurrency(kpis.refundAmount)}`,
        accent: (kpis.refundRate > 5 ? "red" : "default") as HeroKpiAccent,
        sparklineData: sparklines?.refundRate || [],
        description: "Percentage of donations refunded",
        // Drilldown data
        trendData: buildTrendData("refunds"),
        trendXAxisKey: "date",
        breakdown: [
          { label: "Total Refunded", value: formatCurrency(kpis.refundAmount) },
          { label: "Refund Rate", value: `${kpis.refundRate.toFixed(2)}%` },
          { label: "Total Donations", value: formatCurrency(kpis.totalRaised) },
        ],
      },
      {
        kpiKey: "recurringHealth" as KpiKey,
        label: "Recurring Health",
        value: formatCurrency(kpis.recurringRaised),
        icon: Repeat,
        trend: {
          value: Math.round(calcChange(kpis.recurringChurnRate, prevKpis.recurringChurnRate)),
          isPositive: kpis.recurringChurnRate <= (prevKpis.recurringChurnRate || 0),
          label: "churn",
        },
        previousValue: prevKpis.recurringRaised ? formatCurrency(prevKpis.recurringRaised) : undefined,
        subtitle: `${kpis.recurringDonations} recurring tx • Churn ${kpis.recurringChurnRate.toFixed(1)}%`,
        accent: "amber" as HeroKpiAccent,
        sparklineData: sparklines?.recurringHealth || [],
        description: "Active recurring donation revenue",
        // Drilldown data
        trendData: buildTrendData("donations"),
        trendXAxisKey: "date",
        breakdown: [
          { label: "Recurring Revenue", value: formatCurrency(kpis.recurringRaised) },
          { label: "Recurring Transactions", value: kpis.recurringDonations.toLocaleString() },
          { label: "Recurring %", value: `${kpis.recurringPercentage.toFixed(1)}%` },
          { label: "Churn Rate", value: `${kpis.recurringChurnRate.toFixed(1)}%` },
        ],
      },
      {
        kpiKey: "attributionQuality" as KpiKey,
        label: "Attribution Quality",
        value: `${kpis.deterministicRate.toFixed(0)}%`,
        icon: CopyMinus,
        trend: { value: 0, isPositive: true },
        subtitle: "Deterministic (refcode/click)",
        accent: "purple" as HeroKpiAccent,
        sparklineData: sparklines?.attributionQuality || [],
        description: "Percentage of donations with deterministic attribution",
        // Drilldown data
        breakdown: [
          { label: "Deterministic Rate", value: `${kpis.deterministicRate.toFixed(1)}%` },
          { label: "Meta Conversions", value: (data?.metaConversions || 0).toLocaleString() },
          { label: "SMS Conversions", value: (data?.smsConversions || 0).toLocaleString() },
          { label: "Direct Donations", value: (data?.directDonations || 0).toLocaleString() },
        ],
      },
      {
        kpiKey: "uniqueDonors" as KpiKey,
        label: "Unique Donors",
        value: kpis.uniqueDonors.toLocaleString(),
        icon: Users,
        trend: {
          value: Math.round(calcChange(kpis.uniqueDonors, prevKpis.uniqueDonors)),
          isPositive: kpis.uniqueDonors >= (prevKpis.uniqueDonors || 0),
          label: "vs prev",
        },
        previousValue: prevKpis.uniqueDonors ? prevKpis.uniqueDonors.toLocaleString() : undefined,
        subtitle: `New ${kpis.newDonors} / Returning ${kpis.returningDonors}`,
        accent: "blue" as HeroKpiAccent,
        sparklineData: sparklines?.uniqueDonors || [],
        description: "Number of unique donors in period",
        // Drilldown data
        trendData: buildTrendData("donations"),
        trendXAxisKey: "date",
        breakdown: [
          { label: "Unique Donors", value: kpis.uniqueDonors.toLocaleString() },
          { label: "New Donors", value: kpis.newDonors.toLocaleString() },
          { label: "Returning Donors", value: kpis.returningDonors.toLocaleString() },
          { label: "Average Donation", value: formatCurrency(kpis.avgDonation) },
        ],
      },
    ];
  }, [kpis, prevKpis, calcChange, formatCurrency, sparklines, buildTrendData, data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <V3LoadingState variant="kpi-grid" count={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <V3LoadingState variant="chart" height={320} />
          </div>
          <V3LoadingState variant="chart" height={320} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <V3ErrorState
        title="Failed to load dashboard metrics"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!kpis) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Realtime Connection Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isRealtimeConnected ? (
          <>
            <Wifi className="h-4 w-4 text-[hsl(var(--portal-success))]" />
            <span className="text-[hsl(var(--portal-text-muted))]">Live updates enabled</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--portal-success))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--portal-success))]"></span>
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-[hsl(var(--portal-text-muted))]">Connecting...</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
        <span className="px-2 py-1 rounded-md border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
          Range: {format(parseISO(startDate), 'MMM d')} – {format(parseISO(endDate), 'MMM d')}
        </span>
      </div>

      {/* Hero KPI Grid */}
      <HeroKpiGrid
        data={heroKpis}
        isLoading={false}
        mobileColumns={2}
        tabletColumns={3}
        desktopColumns={6}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fundraising Trend - Main Chart */}
        <V3ChartWrapper
          title="Fundraising Performance"
          icon={TrendingUp}
          ariaLabel="Fundraising performance chart showing donations and spend over time"
          description="Line chart displaying daily donations, net revenue, refunds, and channel spend"
          accent="green"
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-md border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))] flex items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  View:
                </span>
                <button
                  onClick={() => setValueMode("both")}
                  className={cn(
                    "rounded-md px-3 py-2 border text-xs min-h-[36px]",
                    valueMode === "both"
                      ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                  )}
                >
                  Gross & Net
                </button>
                <button
                  onClick={() => setValueMode("net")}
                  className={cn(
                    "rounded-md px-3 py-2 border text-xs min-h-[36px]",
                    valueMode === "net"
                      ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                  )}
                >
                  Net focus
                </button>
              </div>
              <button
                onClick={() => setShowCompare((prev) => !prev)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium border min-h-[36px]",
                  showCompare
                    ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                    : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                )}
                aria-pressed={showCompare}
              >
                <CopyMinus className="h-3.5 w-3.5" />
                {showCompare ? "Hide compare" : "Compare prev period"}
              </button>
              <button
                onClick={() => setShowZoom((prev) => !prev)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium border min-h-[36px]",
                  showZoom
                    ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                    : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                )}
                aria-pressed={showZoom}
                title="Enable zoom & pan"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          <div className="flex items-center gap-6 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(kpis.totalRaised)}</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: palette.gross }} />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Donations</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(kpis.totalSpend)}</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: palette.meta }} />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Meta Spend</span>
              </div>
            </div>
          </div>
          <EChartsLineChart
            data={timeSeriesData}
            xAxisKey="name"
            series={echartsSeriesConfig}
            height={280}
            valueType="currency"
            showZoom={showZoom}
            showLegend={true}
          />
        </V3ChartWrapper>

        {/* Channel Performance Summary */}
        <V3Card id="channel-performance" accent="blue">
          <V3CardHeader>
            <V3CardTitle>Channel Performance</V3CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[hsl(var(--portal-text-muted))]">
              <span>Conversions by source</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--portal-bg-elevated))] text-[11px]">
                Deterministic: {kpis.deterministicRate.toFixed(0)}%
              </span>
            </div>
          </V3CardHeader>
          <V3CardContent>
            <div className="space-y-4">
              {/* Meta Ads */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                  <Target className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Meta Ads</p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {formatCurrency(data?.metaSpend || 0)} spent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                    {data?.metaConversions || 0}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">conversions</p>
                </div>
              </div>

              {/* SMS */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
                  <MessageSquare className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">SMS Campaigns</p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {(data?.smsMessagesSent || 0).toLocaleString()} sent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                    {data?.smsConversions || 0}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">conversions</p>
                </div>
              </div>

              {/* Direct */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                <div className="p-2 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
                  <DollarSign className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Direct Donations</p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">No attribution</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                    {data?.directDonations || 0}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">donations</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[hsl(var(--portal-border))]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Conversion Sources</p>
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d')}
                </span>
              </div>
              <PortalBarChart
                data={channelBreakdown}
                height={220}
                valueType="number"
                showValues
                ariaLabel="Conversion sources bar chart"
                barName="Conversions"
                xAxisTickFormatter={(v) => v.replace(/\s*\([^)]*\)\s*$/, "")}
              />
            </div>
          </V3CardContent>
        </V3Card>
      </div>

      {/* Bottom Row - Campaign Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <V3Card id="campaign-health" className="lg:col-span-2" accent="purple">
          <V3CardHeader>
            <V3CardTitle>Campaign Health</V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Key efficiency metrics</p>
          </V3CardHeader>
          <V3CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Average Donation</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{formatCurrency(kpis.avgDonation)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Impressions</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{kpis.totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Clicks</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{kpis.totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Recurring %</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{kpis.recurringPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Upsell Conversion</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{kpis.upsellConversionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Donations</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">{kpis.donationCount.toLocaleString()}</span>
            </div>
          </V3CardContent>
        </V3Card>

        {/* Recurring Summary */}
        <V3Card accent="amber">
          <V3CardHeader>
            <V3CardTitle>Recurring Summary</V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Sustainer program health</p>
          </V3CardHeader>
          <V3CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                {formatCurrency(kpis.recurringRaised)}
              </p>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Recurring Revenue</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[hsl(var(--portal-border))]">
              <div className="text-center">
                <p className="text-xl font-semibold text-[hsl(var(--portal-text-primary))]">
                  {kpis.recurringDonations}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Transactions</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-xl font-semibold",
                  kpis.recurringChurnRate > 5 
                    ? "text-[hsl(var(--portal-error))]" 
                    : "text-[hsl(var(--portal-text-primary))]"
                )}>
                  {kpis.recurringChurnRate.toFixed(1)}%
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Churn Rate</p>
              </div>
            </div>
          </V3CardContent>
        </V3Card>
      </div>
    </div>
  );
};
