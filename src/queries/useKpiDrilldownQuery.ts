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
  // Fetch daily net revenue trend
  const { data: dailyData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, fee_amount")
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
    current.fees += Number(tx.fee_amount) || 0;
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
  // Fetch revenue and spend
  const [{ data: txData }, { data: metaData }, { data: smsData }] = await Promise.all([
    supabase
      .from("actblue_transactions")
      .select("amount, fee_amount")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lte("transaction_date", `${endDate}T23:59:59`),
    supabase
      .from("meta_daily_metrics")
      .select("date, spend")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate),
    supabase
      .from("sms_campaigns")
      .select("total_cost")
      .eq("organization_id", organizationId)
      .gte("created_at", startDate)
      .lte("created_at", `${endDate}T23:59:59`),
  ]);

  const totalRevenue = (txData || []).reduce((sum, tx) => sum + (Number(tx.amount) - Number(tx.fee_amount || 0)), 0);
  const metaSpend = (metaData || []).reduce((sum, d) => sum + Number(d.spend || 0), 0);
  const smsSpend = (smsData || []).reduce((sum, d) => sum + Number(d.total_cost || 0), 0);
  const totalSpend = metaSpend + smsSpend;
  const roi = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Daily ROI trend
  const dailyMap = new Map<string, { revenue: number; spend: number }>();

  (txData || []).forEach((tx: any) => {
    // Note: We don't have daily breakdown from this query, would need transaction_date
  });

  (metaData || []).forEach((d: any) => {
    const current = dailyMap.get(d.date) || { revenue: 0, spend: 0 };
    current.spend += Number(d.spend) || 0;
    dailyMap.set(d.date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, spend }]) => ({
      date: format(parseISO(date), "MMM d"),
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
    value: `${roi.toFixed(1)}x`,
    trend: { value: 0, isPositive: roi >= 1 },
    description: "Return on investment: Net Revenue / Total Spend",
    trendData,
    breakdown,
  };
}

async function fetchRefundDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, status")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const total = (txData || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const refunded = (txData || [])
    .filter((tx) => tx.status === "refunded")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const refundRate = total > 0 ? (refunded / total) * 100 : 0;

  // Daily refund rate trend
  const dailyMap = new Map<string, { total: number; refunded: number }>();
  (txData || []).forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { total: 0, refunded: 0 };
    current.total += Number(tx.amount) || 0;
    if (tx.status === "refunded") {
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
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, amount, recurring_status")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const recurringTx = (txData || []).filter((tx) => tx.recurring_status === "active");
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
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("transaction_date, donor_id_hash")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  // Unique donors
  const uniqueDonors = new Set((txData || []).map((tx) => tx.donor_id_hash)).size;

  // Daily unique donors trend
  const dailyDonors = new Map<string, Set<string>>();
  (txData || []).forEach((tx) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    if (!dailyDonors.has(date)) {
      dailyDonors.set(date, new Set());
    }
    dailyDonors.get(date)!.add(tx.donor_id_hash);
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
  const { data: txData } = await supabase
    .from("actblue_transactions")
    .select("refcode, click_id")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`);

  const total = (txData || []).length;
  const withRefcode = (txData || []).filter((tx) => tx.refcode).length;
  const withClickId = (txData || []).filter((tx) => tx.click_id).length;
  const deterministic = (txData || []).filter((tx) => tx.refcode || tx.click_id).length;
  const deterministicRate = total > 0 ? (deterministic / total) * 100 : 0;

  const breakdown: KpiBreakdownItem[] = [
    { label: "With Refcode", value: withRefcode.toString(), percentage: total > 0 ? (withRefcode / total) * 100 : 0 },
    { label: "With Click ID", value: withClickId.toString(), percentage: total > 0 ? (withClickId / total) * 100 : 0 },
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
