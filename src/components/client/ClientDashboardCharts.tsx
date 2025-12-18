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
// Net = blue, Meta = cyan (info), SMS = purple - ensures visual distinction
const palette = {
  gross: cssVar(colors.status.success),
  net: cssVar(colors.accent.blue),
  refunds: cssVar(colors.status.error),
  meta: cssVar(colors.status.info),      // Cyan - distinct from blue (net)
  sms: cssVar(colors.accent.purple),
  grossPrev: cssVar(colors.status.success, 0.5),
  netPrev: cssVar(colors.accent.blue, 0.5),
  refundsPrev: cssVar(colors.status.error, 0.5),
  metaPrev: cssVar(colors.status.info, 0.5),  // Cyan at 50% opacity
  smsPrev: cssVar(colors.accent.purple, 0.5),
};

// ============================================================================
// Chart Action Button Styling (matches DashboardHeader premium controls)
// ============================================================================

interface ChartActionButtonOptions {
  active?: boolean;
  iconOnly?: boolean;
}

/**
 * Generate consistent button classes matching DashboardHeader controls.
 * Provides: radius tokens, hover glow, focus ring, proper touch targets.
 */
const chartActionButtonClasses = ({ active = false, iconOnly = false }: ChartActionButtonOptions = {}) =>
  cn(
    // Size and shape - Mobile: 44px touch target, Tablet+: 36px
    // min-w-[44px] ensures touch target when text is hidden on mobile
    iconOnly ? "h-11 w-11 sm:h-9 sm:w-9 p-0" : "h-11 sm:h-9 px-3 min-w-[44px] sm:min-w-0",
    "rounded-[var(--portal-radius-sm)]",
    // Layout
    "inline-flex items-center justify-center gap-1.5",
    "text-xs font-medium",
    // Border
    "border",
    // Transition
    "transition-all",
    // Focus state - portal-branded ring
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.3)]",
    "focus-visible:ring-offset-1",
    "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
    // Active vs inactive states
    active
      ? [
          "bg-[hsl(var(--portal-accent-blue)/0.1)]",
          "border-[hsl(var(--portal-accent-blue))]",
          "text-[hsl(var(--portal-accent-blue))]",
          "shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.12)]",
        ]
      : [
          "bg-[hsl(var(--portal-bg-secondary))]",
          "border-[hsl(var(--portal-border))]",
          "text-[hsl(var(--portal-text-muted))]",
          // Hover state (inactive only)
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
          "hover:text-[hsl(var(--portal-text-primary))]",
          "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
        ]
  );

/**
 * Segmented control wrapper classes - connected buttons with shared border.
 */
const segmentedControlClasses = cn(
  "inline-flex",
  "rounded-[var(--portal-radius-sm)]",
  "border border-[hsl(var(--portal-border))]",
  "bg-[hsl(var(--portal-bg-secondary))]",
  "overflow-hidden",
  // Focus-within ring for the group
  "focus-within:ring-2",
  "focus-within:ring-[hsl(var(--portal-accent-blue)/0.3)]",
  "focus-within:ring-offset-1",
  "focus-within:ring-offset-[hsl(var(--portal-bg-secondary))]"
);

/**
 * Segmented control segment (child button) classes.
 */
const segmentClasses = (active: boolean, position: "first" | "last" | "middle") =>
  cn(
    // Size - 44px mobile, 36px desktop
    "h-11 sm:h-9 px-3",
    "inline-flex items-center justify-center",
    "text-xs font-medium",
    // No individual border (wrapper handles it)
    "border-0",
    // Transition
    "transition-all",
    // Remove default focus ring (wrapper handles it)
    "focus-visible:outline-none",
    // Divider between segments (except first)
    position !== "first" && "border-l border-[hsl(var(--portal-border))]",
    // Active vs inactive
    active
      ? [
          "bg-[hsl(var(--portal-accent-blue)/0.1)]",
          "text-[hsl(var(--portal-accent-blue))]",
        ]
      : [
          "bg-transparent",
          "text-[hsl(var(--portal-text-muted))]",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "hover:text-[hsl(var(--portal-text-primary))]",
        ]
  );

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
    <div className="space-y-[var(--portal-space-lg)]">
      {/* Row 1: Fundraising Performance - Hero Chart (standalone full-width) */}
      <V3ChartWrapper
        title="Fundraising Performance"
        icon={TrendingUp}
        ariaLabel="Fundraising performance chart showing donations and spend over time"
        description="Line chart displaying daily donations, net revenue, refunds, and channel spend"
        accent="green"
        actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* View mode segmented control */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex h-9 px-2 rounded-[var(--portal-radius-sm)] border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  View
                </span>
                <div className={segmentedControlClasses} role="group" aria-label="View mode">
                  <button
                    type="button"
                    onClick={() => setValueMode("both")}
                    className={segmentClasses(valueMode === "both", "first")}
                    aria-pressed={valueMode === "both"}
                    style={{ transition: "all var(--portal-transition-base)" }}
                  >
                    <span className="sm:hidden">Gross</span>
                    <span className="hidden sm:inline">Gross & Net</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueMode("net")}
                    className={segmentClasses(valueMode === "net", "last")}
                    aria-pressed={valueMode === "net"}
                    style={{ transition: "all var(--portal-transition-base)" }}
                  >
                    Net
                  </button>
                </div>
              </div>
              {/* Compare toggle */}
              <button
                type="button"
                onClick={toggleComparison}
                className={chartActionButtonClasses({ active: comparisonEnabled })}
                aria-pressed={comparisonEnabled}
                aria-label={comparisonEnabled ? "Hide period comparison" : "Compare with previous period"}
                style={{ transition: "all var(--portal-transition-base)" }}
              >
                <CopyMinus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{comparisonEnabled ? "Hide" : "Compare"}</span>
              </button>
              {/* Zoom toggle (icon-only) */}
              <button
                type="button"
                onClick={() => setShowZoom((prev) => !prev)}
                className={chartActionButtonClasses({ active: showZoom, iconOnly: true })}
                aria-pressed={showZoom}
                aria-label={showZoom ? "Disable zoom and pan" : "Enable zoom and pan"}
                style={{ transition: "all var(--portal-transition-base)" }}
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          }
        >
          <div className="flex items-center gap-6 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">{formatCurrency(kpis.totalRaised)}</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: palette.gross }} />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Donations</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">{formatCurrency(kpis.totalSpend)}</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: palette.meta }} />
                <div className="w-2 h-2 rounded-full" style={{ background: palette.sms }} />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Total Spend</span>
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

      {/* Row 2: Channel Performance (2/3) + Conversion Sources (1/3) on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--portal-space-lg)]">
        {/* Channel Performance Summary - spans 2 cols at lg for 2/3 width */}
        <V3Card id="channel-performance" accent="blue" className="lg:col-span-2">
          <V3CardHeader>
            <V3CardTitle>Channel Performance</V3CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[hsl(var(--portal-text-muted))]">
              <span>Attribution summary</span>
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
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                    {metaConversions.toLocaleString()}
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
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                    {smsConversions.toLocaleString()}
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
                  <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                    {directDonations.toLocaleString()}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">donations</p>
                </div>
              </div>
            </div>
          </V3CardContent>
        </V3Card>

        {/* Conversion Sources */}
        <V3Card id="conversion-sources" accent="blue">
          <V3CardHeader>
            <V3CardTitle>Conversion Sources</V3CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[hsl(var(--portal-text-muted))]">
              <span>Conversions by source</span>
              <span className="text-xs">
                {format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d')}
              </span>
            </div>
          </V3CardHeader>
          <V3CardContent>
            <PortalBarChart
              data={channelBreakdown}
              height={220}
              valueType="number"
              showValues
              ariaLabel="Conversion sources bar chart"
              barName="Conversions"
              xAxisTickFormatter={(v) => v.replace(/\s*\([^)]*\)\s*$/, "")}
            />
          </V3CardContent>
        </V3Card>
      </div>

      {/* Row 3: Campaign Health + Recurring Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--portal-space-lg)]">
        <V3Card id="campaign-health" className="lg:col-span-2" accent="purple">
          <V3CardHeader>
            <V3CardTitle>Campaign Health</V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Key efficiency metrics</p>
          </V3CardHeader>
          <V3CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Average Donation</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{formatCurrency(kpis.avgDonation)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Impressions</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{kpis.totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Clicks</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{kpis.totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Recurring %</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{kpis.recurringPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Upsell Conversion</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{kpis.upsellConversionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Total Donations</span>
              <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">{kpis.donationCount.toLocaleString()}</span>
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
              <p className="text-3xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                {formatCurrency(kpis.recurringRaised)}
              </p>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Recurring Revenue</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[hsl(var(--portal-border))]">
              <div className="text-center">
                <p className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {kpis.recurringDonations.toLocaleString()}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Transactions</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-xl font-semibold tabular-nums",
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
