import { Users, TrendingUp, Repeat, Target, CopyMinus, Wallet } from "lucide-react";
import type { HeroKpiData } from "@/components/client/HeroKpiGrid";
import type { HeroKpiAccent } from "@/components/client/HeroKpiCard";
import type { KpiKey } from "@/stores/dashboardStore";
import type { DashboardKPIs, SparklineData, DashboardTimeSeriesPoint } from "@/queries/useClientDashboardMetricsQuery";

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
  attributionFallbackMode = false,
}: BuildHeroKpisParams): HeroKpiData[] {
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
    },
    {
      kpiKey: "recurringHealth" as KpiKey,
      label: "Recurring Health",
      value: formatCurrency(kpis.recurringRaised),
      icon: Repeat,
      trend: {
        value: Math.round(calcChange(kpis.recurringRaised, prevKpis.recurringRaised)),
        isPositive: kpis.recurringRaised >= (prevKpis.recurringRaised || 0),
        label: "vs prev",
      },
      previousValue: prevKpis.recurringRaised ? formatCurrency(prevKpis.recurringRaised) : undefined,
      subtitle: `${kpis.recurringDonations} recurring tx | Churn ${kpis.recurringChurnRate.toFixed(1)}%`,
      accent: "amber" as HeroKpiAccent,
      sparklineData: sparklines?.recurringHealth || [],
      description: "Active recurring donation revenue",
      trendData: sparklines?.recurringHealth,
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
      trend: prevKpis.deterministicRate !== undefined
        ? {
            value: Math.round(calcChange(kpis.deterministicRate, prevKpis.deterministicRate)),
            isPositive: kpis.deterministicRate >= (prevKpis.deterministicRate || 0),
            label: "vs prev",
          }
        : undefined,
      previousValue: prevKpis.deterministicRate !== undefined ? `${prevKpis.deterministicRate.toFixed(0)}%` : undefined,
      subtitle: attributionFallbackMode 
        ? "⚠️ Limited data (fallback mode)" 
        : "Deterministic (refcode/click)",
      accent: attributionFallbackMode ? "orange" as HeroKpiAccent : "purple" as HeroKpiAccent,
      sparklineData: sparklines?.attributionQuality || [],
      description: attributionFallbackMode 
        ? "Attribution data unavailable. Using fallback: refcode, click_id, fbclid from transactions. SMS attribution excluded."
        : "Percentage of donations with deterministic attribution",
      trendData: sparklines?.attributionQuality,
      trendXAxisKey: "date",
      breakdown: attributionFallbackMode 
        ? [
            { label: "⚠️ Fallback Mode", value: "Limited Attribution" },
            { label: "Deterministic Rate", value: `${kpis.deterministicRate.toFixed(1)}%` },
            { label: "Why?", value: "Run attribution sync" },
          ]
        : [
            { label: "Deterministic Rate", value: `${kpis.deterministicRate.toFixed(1)}%` },
            { label: "Meta Conversions", value: metaConversions.toLocaleString() },
            { label: "SMS Conversions", value: smsConversions.toLocaleString() },
            { label: "Direct Donations", value: directDonations.toLocaleString() },
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
      trendData: sparklines?.uniqueDonors,
      trendXAxisKey: "date",
      breakdown: [
        { label: "Unique Donors", value: kpis.uniqueDonors.toLocaleString() },
        { label: "New Donors", value: kpis.newDonors.toLocaleString() },
        { label: "Returning Donors", value: kpis.returningDonors.toLocaleString() },
        { label: "Average Donation", value: formatCurrency(kpis.avgDonation) },
      ],
    },
  ];
}
