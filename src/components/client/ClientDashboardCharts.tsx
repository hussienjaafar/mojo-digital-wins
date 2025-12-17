import { useState, useMemo, useCallback } from "react";
import {
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardContent,
  V3ChartWrapper,
} from "@/components/v3";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { DollarSign, TrendingUp, Target, MessageSquare, CopyMinus, SlidersHorizontal, ZoomIn } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useDashboardStore, useComparisonEnabled, type SeriesKey } from "@/stores/dashboardStore";
import { cssVar, colors } from "@/lib/design-tokens";
import type { DashboardKPIs, DashboardTimeSeriesPoint, ChannelBreakdown } from "@/queries/useClientDashboardMetricsQuery";

interface ClientDashboardChartsProps {
  kpis: DashboardKPIs;
  timeSeries: DashboardTimeSeriesPoint[];
  channelBreakdown: ChannelBreakdown[];
  metaSpend: number;
  metaConversions: number;
  smsConversions: number;
  smsMessagesSent: number;
  directDonations: number;
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

export const ClientDashboardCharts = ({
  kpis,
  timeSeries,
  channelBreakdown,
  metaSpend,
  metaConversions,
  smsConversions,
  smsMessagesSent,
  directDonations,
  startDate,
  endDate,
}: ClientDashboardChartsProps) => {
  // Comparison toggle from persistent dashboard store
  const comparisonEnabled = useComparisonEnabled();
  const toggleComparison = useDashboardStore((s) => s.toggleComparison);

  const [valueMode, setValueMode] = useState<"both" | "net">("both");
  const [showZoom, setShowZoom] = useState(false);

  const formatCurrency = useCallback((value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  // Memoized ECharts series configuration with seriesKey for cross-highlighting
  // yAxisIndex: 0 = Revenue (left axis), 1 = Spend (right axis)
  const echartsSeriesConfig = useMemo((): LineSeriesConfig[] => {
    const base: LineSeriesConfig[] = valueMode === "net"
      ? [
          { dataKey: "netDonations", name: "Net donations", color: palette.net, type: "area", areaStyle: { opacity: 0.1 }, seriesKey: "netDonations" as SeriesKey, yAxisIndex: 0 },
          { dataKey: "refunds", name: "Refunds (negative)", color: palette.refunds, lineStyle: { type: "dashed" }, seriesKey: "refunds" as SeriesKey, yAxisIndex: 0 },
          { dataKey: "metaSpend", name: "Meta spend", color: palette.meta, seriesKey: "metaSpend" as SeriesKey, yAxisIndex: 1 },
          { dataKey: "smsSpend", name: "SMS spend", color: palette.sms, seriesKey: "smsSpend" as SeriesKey, yAxisIndex: 1 },
        ]
      : [
          { dataKey: "donations", name: "Gross donations", color: palette.gross, type: "area", areaStyle: { opacity: 0.1 }, seriesKey: "donations" as SeriesKey, yAxisIndex: 0 },
          { dataKey: "netDonations", name: "Net donations", color: palette.net, seriesKey: "netDonations" as SeriesKey, yAxisIndex: 0 },
          { dataKey: "refunds", name: "Refunds (negative)", color: palette.refunds, lineStyle: { type: "dashed" }, seriesKey: "refunds" as SeriesKey, yAxisIndex: 0 },
          { dataKey: "metaSpend", name: "Meta spend", color: palette.meta, seriesKey: "metaSpend" as SeriesKey, yAxisIndex: 1 },
          { dataKey: "smsSpend", name: "SMS spend", color: palette.sms, seriesKey: "smsSpend" as SeriesKey, yAxisIndex: 1 },
        ];

    if (!comparisonEnabled) return base;

    // Comparison series don't need cross-highlighting (no seriesKey)
    const compare: LineSeriesConfig[] = valueMode === "net"
      ? [
          { dataKey: "netDonationsPrev", name: "Net (prev)", color: palette.netPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 0 },
          { dataKey: "refundsPrev", name: "Refunds (prev)", color: palette.refundsPrev, lineStyle: { type: "dotted", width: 1 }, yAxisIndex: 0 },
          { dataKey: "metaSpendPrev", name: "Meta (prev)", color: palette.metaPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 1 },
          { dataKey: "smsSpendPrev", name: "SMS (prev)", color: palette.smsPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 1 },
        ]
      : [
          { dataKey: "donationsPrev", name: "Gross (prev)", color: palette.grossPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 0 },
          { dataKey: "netDonationsPrev", name: "Net (prev)", color: palette.netPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 0 },
          { dataKey: "refundsPrev", name: "Refunds (prev)", color: palette.refundsPrev, lineStyle: { type: "dotted", width: 1 }, yAxisIndex: 0 },
          { dataKey: "metaSpendPrev", name: "Meta (prev)", color: palette.metaPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 1 },
          { dataKey: "smsSpendPrev", name: "SMS (prev)", color: palette.smsPrev, lineStyle: { type: "dashed", width: 1 }, yAxisIndex: 1 },
        ];

    return [...base, ...compare];
  }, [comparisonEnabled, valueMode]);

  return (
    <div className="space-y-6">
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* View mode toggle group */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
                <span className="hidden sm:flex px-2 py-1 rounded-md border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))] items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  View:
                </span>
                <button
                  type="button"
                  onClick={() => setValueMode("both")}
                  className={cn(
                    "rounded-md px-2 sm:px-3 py-2 border text-xs min-h-[44px] sm:min-h-[36px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
                    valueMode === "both"
                      ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                  )}
                  aria-pressed={valueMode === "both"}
                >
                  <span className="sm:hidden">Gross</span>
                  <span className="hidden sm:inline">Gross & Net</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValueMode("net")}
                  className={cn(
                    "rounded-md px-2 sm:px-3 py-2 border text-xs min-h-[44px] sm:min-h-[36px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
                    valueMode === "net"
                      ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                  )}
                  aria-pressed={valueMode === "net"}
                >
                  Net
                </button>
              </div>
              {/* Compare toggle */}
              <button
                type="button"
                onClick={toggleComparison}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-3 py-2 text-xs font-medium border min-h-[44px] sm:min-h-[36px] min-w-[44px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
                  comparisonEnabled
                    ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                    : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                )}
                aria-pressed={comparisonEnabled}
                aria-label={comparisonEnabled ? "Hide period comparison" : "Compare with previous period"}
              >
                <CopyMinus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{comparisonEnabled ? "Hide compare" : "Compare"}</span>
              </button>
              {/* Zoom toggle */}
              <button
                type="button"
                onClick={() => setShowZoom((prev) => !prev)}
                className={cn(
                  "flex items-center justify-center rounded-md px-2 sm:px-3 py-2 text-xs font-medium border min-h-[44px] sm:min-h-[36px] min-w-[44px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
                  showZoom
                    ? "border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                    : "border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                )}
                aria-pressed={showZoom}
                aria-label={showZoom ? "Disable zoom and pan" : "Enable zoom and pan"}
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
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
            data={timeSeries}
            xAxisKey="name"
            series={echartsSeriesConfig}
            height={280}
            valueType="currency"
            showZoom={showZoom}
            showLegend={true}
            dualYAxis={true}
            yAxisNameLeft="Revenue"
            yAxisNameRight="Spend"
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
                    {formatCurrency(metaSpend)} spent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                    {metaConversions}
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
                    {smsMessagesSent.toLocaleString()} sent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                    {smsConversions}
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
                    {directDonations}
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
