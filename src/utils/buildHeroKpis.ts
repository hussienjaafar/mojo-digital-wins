import { Users, TrendingUp, Repeat, Target, PlusCircle, Wallet } from "lucide-react";
import type { HeroKpiData } from "@/components/client/HeroKpiGrid";
import type { HeroKpiAccent } from "@/components/client/HeroKpiCard";
import type { KpiKey } from "@/stores/dashboardStore";
import type {
  DashboardKPIs,
  SparklineData,
  DashboardTimeSeriesPoint,
} from "@/queries/useClientDashboardMetricsQuery";
import type { RecurringHealthV2Data } from "@/queries/useRecurringHealthQuery";
import type { SingleDayComparisonData } from "@/components/v3/V3KPIDrilldownDrawer";

interface BuildHeroKpisParams {
  kpis: DashboardKPIs;
  prevKpis: Partial<DashboardKPIs>;
  sparklines: SparklineData;
  timeSeries: DashboardTimeSeriesPoint[];
  metaSpend?: number;
  smsSpend?: number;
  metaConversions?: number;
  smsConversions?: number;
  directDonations?: number;
  /** When true, attribution is calculated from fallback transaction fields, not full attribution view */
  attributionFallbackMode?: boolean;
  /** Recurring health v2 (used for Current Active MRR + New MRR Added cards) */
  recurringHealth?: RecurringHealthV2Data;
  /** Whether this is a single-day view */
  isSingleDayView?: boolean;
  /** Whether this is viewing "today" specifically */
  isTodayView?: boolean;
}

/**
 * Calculate percentage change between current and previous values
 */
function calcChange(current: number, previous: number | undefined): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format currency value with K/M suffix
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Build single-day comparison data for a KPI
 */
function buildSingleDayData(
  currentValue: number | string,
  previousValue: number | string | undefined,
  percentChange: number,
  isPositive: boolean,
  isTodayView: boolean,
  formatFn?: (val: number) => string
): SingleDayComparisonData {
  const prevNum = typeof previousValue === 'number' ? previousValue : parseFloat(String(previousValue || 0));
  const formattedPrev = formatFn ? formatFn(prevNum) : String(prevNum);
  
  return {
    comparisonValue: previousValue !== undefined ? formattedPrev : undefined,
    comparisonLabel: isTodayView ? "vs yesterday" : "vs day before",
    percentChange: Math.round(percentChange * 10) / 10, // Round to 1 decimal
    isPositive,
  };
}

/**
 * Build hero KPI data array for HeroKpiGrid
 */
export function buildHeroKpis({
  kpis,
  prevKpis,
  sparklines,
  // timeSeries kept in interface for caller compatibility but no longer used for trendData
  timeSeries: _timeSeries,
  metaSpend = 0,
  smsSpend = 0,
  metaConversions = 0,
  smsConversions = 0,
  directDonations = 0,
  attributionFallbackMode: _attributionFallbackMode = false,
  recurringHealth,
  isSingleDayView = false,
  isTodayView = false,
}: BuildHeroKpisParams): HeroKpiData[] {
  // Build single-day data for each KPI if in single-day view
  const netRevenueSingleDay = isSingleDayView 
    ? buildSingleDayData(
        kpis.totalNetRevenue,
        prevKpis.totalNetRevenue,
        calcChange(kpis.totalNetRevenue, prevKpis.totalNetRevenue),
        kpis.totalNetRevenue >= (prevKpis.totalNetRevenue || 0),
        isTodayView,
        formatCurrency
      )
    : undefined;

  const roiSingleDay = isSingleDayView
    ? buildSingleDayData(
        kpis.roi,
        prevKpis.roi,
        calcChange(kpis.roi, prevKpis.roi),
        kpis.roi >= (prevKpis.roi || 0),
        isTodayView,
        (v) => `${v.toFixed(1)}x`
      )
    : undefined;

  const refundRateSingleDay = isSingleDayView
    ? buildSingleDayData(
        kpis.refundRate,
        prevKpis.refundRate,
        calcChange(kpis.refundRate, prevKpis.refundRate),
        kpis.refundRate <= (prevKpis.refundRate || 0), // Lower refund rate is positive
        isTodayView,
        (v) => `${v.toFixed(1)}%`
      )
    : undefined;

  const uniqueDonorsSingleDay = isSingleDayView
    ? buildSingleDayData(
        kpis.uniqueDonors,
        prevKpis.uniqueDonors,
        calcChange(kpis.uniqueDonors, prevKpis.uniqueDonors),
        kpis.uniqueDonors >= (prevKpis.uniqueDonors || 0),
        isTodayView,
        (v) => v.toLocaleString()
      )
    : undefined;

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
      trendData: sparklines?.netRevenue,
      trendXAxisKey: "date",
      breakdown: [
        { label: "Gross Revenue", value: formatCurrency(kpis.totalRaised) },
        { label: "Processing Fees", value: `-${formatCurrency(kpis.totalFees || 0)}`, percentage: kpis.feePercentage },
        { label: "Refunds", value: `-${formatCurrency(kpis.refundAmount)}`, percentage: kpis.refundRate },
        { label: "Net Revenue", value: formatCurrency(kpis.totalNetRevenue) },
      ],
      singleDayData: netRevenueSingleDay,
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
      description: "Investment multiplier: Net Revenue / Spend. 1.15x = $1.15 back per $1 spent.",
      trendData: sparklines?.roi,
      trendXAxisKey: "date",
      breakdown: [
        { label: "Net Revenue", value: formatCurrency(kpis.totalNetRevenue) },
        { label: "Meta Ad Spend", value: formatCurrency(metaSpend) },
        { label: "SMS Spend", value: formatCurrency(smsSpend) },
        { label: "Total Spend", value: formatCurrency(kpis.totalSpend) },
        { label: "ROI Multiplier", value: `${kpis.roi.toFixed(2)}x` },
      ],
      singleDayData: roiSingleDay,
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
      trendData: sparklines?.refundRate,
      trendXAxisKey: "date",
      breakdown: [
        { label: "Total Refunded", value: formatCurrency(kpis.refundAmount) },
        { label: "Refund Rate", value: `${kpis.refundRate.toFixed(2)}%` },
        { label: "Total Donations", value: formatCurrency(kpis.totalRaised) },
      ],
      singleDayData: refundRateSingleDay,
    },
    {
      kpiKey: "currentMrr" as KpiKey,
      label: "Current Active MRR",
      value: formatCurrency(recurringHealth?.current_active_mrr || 0),
      icon: Repeat,
      trend: { value: 0, isPositive: true, label: "active" },
      subtitle: `${(recurringHealth?.current_active_donors || 0).toLocaleString()} active recurring donors`,
      accent: "amber" as HeroKpiAccent,
      sparklineData: sparklines?.recurringHealth || [],
      description: "Expected monthly revenue from currently active recurring donors",
      breakdown: [
        { label: "Active MRR", value: formatCurrency(recurringHealth?.current_active_mrr || 0) },
        { label: "Active Donors", value: (recurringHealth?.current_active_donors || 0).toLocaleString() },
        { label: "Avg Amount", value: formatCurrency(recurringHealth?.avg_recurring_amount || 0) },
        { label: "Churned Donors", value: (recurringHealth?.current_churned_donors || 0).toLocaleString() },
      ],
      // MRR is a point-in-time metric, so no single-day comparison needed
    },
    {
      kpiKey: "newMrr" as KpiKey,
      label: "New MRR Added",
      value: formatCurrency(recurringHealth?.new_recurring_mrr || 0),
      icon: PlusCircle,
      trend: {
        value: recurringHealth?.new_recurring_donors || 0,
        isPositive: (recurringHealth?.new_recurring_donors || 0) > 0,
        label: "new donors",
      },
      subtitle: `${(recurringHealth?.new_recurring_donors || 0).toLocaleString()} new recurring donors in period`,
      accent: "purple" as HeroKpiAccent,
      sparklineData: sparklines?.newMrr || [],
      description: "MRR from donors who started recurring in the selected period",
      breakdown: [
        { label: "New MRR", value: formatCurrency(recurringHealth?.new_recurring_mrr || 0) },
        { label: "New Recurring Donors", value: (recurringHealth?.new_recurring_donors || 0).toLocaleString() },
        { label: "Period Revenue", value: formatCurrency(recurringHealth?.period_recurring_revenue || 0) },
        { label: "Period Transactions", value: (recurringHealth?.period_recurring_transactions || 0).toLocaleString() },
      ],
      // New MRR comparison could be added but doesn't have prev data yet
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
      description: "Number of unique donors in the selected period",
      trendData: sparklines?.uniqueDonors,
      trendXAxisKey: "date",
      breakdown: [
        { label: "Unique Donors", value: kpis.uniqueDonors.toLocaleString() },
        { label: "New Donors", value: kpis.newDonors.toLocaleString() },
        { label: "Returning Donors", value: kpis.returningDonors.toLocaleString() },
        { label: "Average Donation", value: formatCurrency(kpis.avgDonation) },
      ],
      singleDayData: uniqueDonorsSingleDay,
    },
  ];
}
