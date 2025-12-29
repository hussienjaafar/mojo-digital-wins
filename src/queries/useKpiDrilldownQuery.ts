import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import type { KpiKey } from "@/stores/dashboardStore";
import { format, subDays, parseISO } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface KpiBreakdownItem {
  label: string;
  value: number | string;
  percentage?: number;
}

export interface KpiTrendPoint {
  date: string;
  value: number;
}

export interface KpiDrilldownData {
  kpiKey: KpiKey;
  label: string;
  value: string;
  trend: {
    value: number;
    isPositive: boolean;
  };
  description: string;
  trendData: KpiTrendPoint[];
  breakdown: KpiBreakdownItem[];
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetches detailed breakdown data for a specific KPI
 */
async function fetchKpiDrilldown(
  organizationId: string,
  kpiKey: KpiKey,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData | null> {
  // Query based on KPI type
  switch (kpiKey) {
    case "netRevenue":
      return fetchNetRevenueDrilldown(organizationId, startDate, endDate);
    case "netRoi":
      return fetchRoiDrilldown(organizationId, startDate, endDate);
    case "refundRate":
      return fetchRefundDrilldown(organizationId, startDate, endDate);
    case "recurringHealth":
      return fetchRecurringDrilldown(organizationId, startDate, endDate);
    case "uniqueDonors":
      return fetchDonorsDrilldown(organizationId, startDate, endDate);
    case "attributionQuality":
      return fetchAttributionDrilldown(organizationId, startDate, endDate);
    default:
      return null;
  }
}

async function fetchNetRevenueDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Fetch daily net revenue trend (using correct column names)
  const { data: dailyData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, fee")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`)
    .order("transaction_date", { ascending: true });

  // Aggregate by day
  const dailyMap = new Map<string, { gross: number; fees: number }>();
  (dailyData || []).forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { gross: 0, fees: 0 };
    current.gross += Number(tx.amount) || 0;
    current.fees += Number(tx.fee) || 0;
    dailyMap.set(date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { gross, fees }]) => ({
      date: format(parseISO(date), "MMM d"),
      value: gross - fees,
    }));

  // Calculate totals
  const totalGross = Array.from(dailyMap.values()).reduce((sum, d) => sum + d.gross, 0);
  const totalFees = Array.from(dailyMap.values()).reduce((sum, d) => sum + d.fees, 0);
  const totalNet = totalGross - totalFees;

  // Breakdown by revenue type
  const breakdown: KpiBreakdownItem[] = [
    { label: "Gross Revenue", value: `$${totalGross.toLocaleString()}`, percentage: 100 },
    { label: "Processing Fees", value: `$${totalFees.toLocaleString()}`, percentage: (totalFees / totalGross) * 100 },
    { label: "Net Revenue", value: `$${totalNet.toLocaleString()}`, percentage: (totalNet / totalGross) * 100 },
  ];

  return {
    kpiKey: "netRevenue",
    label: "Net Revenue",
    value: `$${totalNet.toLocaleString()}`,
    trend: { value: 0, isPositive: true }, // Would need comparison period
    description: "Total donations minus processing fees and refunds",
    trendData,
    breakdown,
  };
}

async function fetchRoiDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Fetch revenue and spend (using correct column names and tables)
  const [{ data: txData }, { data: dailyMetrics }] = await Promise.all([
    supabase
      .from("actblue_transactions")
      .select("amount, fee")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lte("transaction_date", `${endDate}T23:59:59`),
    supabase
      .from("daily_aggregated_metrics")
      .select("date, total_ad_spend, total_sms_cost")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate),
  ]);

  const totalRevenue = (txData || []).reduce((sum, tx) => sum + (Number(tx.amount) - Number(tx.fee || 0)), 0);
  const metaSpend = (dailyMetrics || []).reduce((sum, d) => sum + Number(d.total_ad_spend || 0), 0);
  const smsSpend = (dailyMetrics || []).reduce((sum, d) => sum + Number(d.total_sms_cost || 0), 0);
  const totalSpend = metaSpend + smsSpend;
  // ROI = Net Revenue / Total Spend (investment multiplier)
  const roi = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Daily ROI trend
  const dailyMap = new Map<string, { revenue: number; spend: number }>();

  (dailyMetrics || []).forEach((d) => {
    const current = dailyMap.get(d.date) || { revenue: 0, spend: 0 };
    current.spend += Number(d.total_ad_spend || 0) + Number(d.total_sms_cost || 0);
    dailyMap.set(d.date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, spend }]) => ({
      date: format(parseISO(date), "MMM d"),
      // ROI = Revenue / Spend (investment multiplier)
      value: spend > 0 ? revenue / spend : 0,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Net Revenue", value: `$${totalRevenue.toLocaleString()}`, percentage: 100 },
    { label: "Meta Ads Spend", value: `$${metaSpend.toLocaleString()}`, percentage: totalSpend > 0 ? (metaSpend / totalSpend) * 100 : 0 },
    { label: "SMS Spend", value: `$${smsSpend.toLocaleString()}`, percentage: totalSpend > 0 ? (smsSpend / totalSpend) * 100 : 0 },
    { label: "Total Spend", value: `$${totalSpend.toLocaleString()}` },
  ];

  return {
    kpiKey: "netRoi",
    label: "Net ROI",
    value: `${roi.toFixed(2)}x`,
    trend: { value: 0, isPositive: roi >= 1 },
    description: "Investment multiplier: Net Revenue / Total Spend. 1.15x = $1.15 back per $1 spent.",
    trendData,
    breakdown,
  };
}

async function fetchRefundDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Note: actblue_transactions doesn't have a status column for refunds
  // We'll use transaction_type to identify refunds
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const total = (txData || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const refunded = (txData || [])
    .filter((tx) => tx.transaction_type === "refund")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const refundRate = total > 0 ? (refunded / total) * 100 : 0;

  // Daily refund rate trend
  const dailyMap = new Map<string, { total: number; refunded: number }>();
  (txData || []).forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { total: 0, refunded: 0 };
    current.total += Number(tx.amount) || 0;
    if (tx.transaction_type === "refund") {
      current.refunded += Number(tx.amount) || 0;
    }
    dailyMap.set(date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, refunded }]) => ({
      date: format(parseISO(date), "MMM d"),
      value: total > 0 ? (refunded / total) * 100 : 0,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Total Donations", value: `$${total.toLocaleString()}`, percentage: 100 },
    { label: "Refunded", value: `$${refunded.toLocaleString()}`, percentage: refundRate },
    { label: "Net Retained", value: `$${(total - refunded).toLocaleString()}`, percentage: 100 - refundRate },
  ];

  return {
    kpiKey: "refundRate",
    label: "Refund Rate",
    value: `${refundRate.toFixed(1)}%`,
    trend: { value: 0, isPositive: refundRate <= 5 },
    description: "Percentage of donations refunded",
    trendData,
    breakdown,
  };
}

async function fetchRecurringDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Using is_recurring column from actblue_transactions
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, is_recurring")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const recurringTx = (txData || []).filter((tx) => tx.is_recurring === true);
  const recurringTotal = recurringTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const overallTotal = (txData || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const recurringPercentage = overallTotal > 0 ? (recurringTotal / overallTotal) * 100 : 0;

  // Daily trend
  const dailyMap = new Map<string, number>();
  recurringTx.forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    dailyMap.set(date, (dailyMap.get(date) || 0) + Number(tx.amount || 0));
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: format(parseISO(date), "MMM d"),
      value,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Recurring Revenue", value: `$${recurringTotal.toLocaleString()}`, percentage: recurringPercentage },
    { label: "One-time Revenue", value: `$${(overallTotal - recurringTotal).toLocaleString()}`, percentage: 100 - recurringPercentage },
    { label: "Recurring Donors", value: recurringTx.length.toString() },
  ];

  return {
    kpiKey: "recurringHealth",
    label: "Recurring Health",
    value: `$${recurringTotal.toLocaleString()}`,
    trend: { value: 0, isPositive: true },
    description: "Active recurring donation revenue",
    trendData,
    breakdown,
  };
}

async function fetchDonorsDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Using donor_email as unique identifier (donor_id_hash doesn't exist)
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, donor_email")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  // Unique donors by email
  const uniqueDonors = new Set((txData || []).map((tx) => tx.donor_email).filter(Boolean)).size;

  // Daily unique donors trend
  const dailyDonors = new Map<string, Set<string>>();
  (txData || []).forEach((tx) => {
    if (!tx.donor_email) return;
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    if (!dailyDonors.has(date)) {
      dailyDonors.set(date, new Set());
    }
    dailyDonors.get(date)!.add(tx.donor_email);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyDonors.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, donors]) => ({
      date: format(parseISO(date), "MMM d"),
      value: donors.size,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Unique Donors", value: uniqueDonors.toString() },
    { label: "Total Donations", value: (txData || []).length.toString() },
    { label: "Avg Donations/Donor", value: uniqueDonors > 0 ? ((txData || []).length / uniqueDonors).toFixed(1) : "0" },
  ];

  return {
    kpiKey: "uniqueDonors",
    label: "Unique Donors",
    value: uniqueDonors.toLocaleString(),
    trend: { value: 0, isPositive: true },
    description: "Number of unique donors in period",
    trendData,
    breakdown,
  };
}

async function fetchAttributionDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Using refcode column (click_id doesn't exist in schema)
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("refcode, source_campaign")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const total = (txData || []).length;
  const withRefcode = (txData || []).filter((tx) => tx.refcode).length;
  const withCampaign = (txData || []).filter((tx) => tx.source_campaign).length;
  const deterministic = (txData || []).filter((tx) => tx.refcode || tx.source_campaign).length;
  const deterministicRate = total > 0 ? (deterministic / total) * 100 : 0;

  const breakdown: KpiBreakdownItem[] = [
    { label: "With Refcode", value: withRefcode.toString(), percentage: total > 0 ? (withRefcode / total) * 100 : 0 },
    { label: "With Campaign", value: withCampaign.toString(), percentage: total > 0 ? (withCampaign / total) * 100 : 0 },
    { label: "Unattributed", value: (total - deterministic).toString(), percentage: total > 0 ? ((total - deterministic) / total) * 100 : 0 },
    { label: "Total Transactions", value: total.toString() },
  ];

  return {
    kpiKey: "attributionQuality",
    label: "Attribution Quality",
    value: `${deterministicRate.toFixed(0)}%`,
    trend: { value: 0, isPositive: deterministicRate >= 50 },
    description: "Percentage of donations with deterministic attribution",
    trendData: [], // Attribution doesn't have a meaningful daily trend
    breakdown,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useKpiDrilldownQuery(organizationId: string | null, kpiKey: KpiKey | null) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: queryKeys.kpis.drilldown(organizationId!, kpiKey!, dateRange.startDate, dateRange.endDate),
    queryFn: () => fetchKpiDrilldown(organizationId!, kpiKey!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId && !!kpiKey,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
