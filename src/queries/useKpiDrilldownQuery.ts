import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import type { KpiKey } from "@/stores/dashboardStore";
import { format, parseISO, addDays } from "date-fns";
import { logger } from "@/lib/logger";

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
    case "currentMrr":
      return fetchCurrentMrrDrilldown(organizationId, startDate, endDate);
    case "newMrr":
      return fetchNewMrrDrilldown(organizationId, startDate, endDate);
    case "uniqueDonors":
      return fetchDonorsDrilldown(organizationId, startDate, endDate);
    default:
      return null;
  }
}

async function fetchNetRevenueDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Use secure view with transaction_type for proper filtering
  const { data: dailyData } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("transaction_date, amount, net_amount, fee, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDateInclusive)
    .order("transaction_date", { ascending: true });

  const allTx = dailyData || [];

  // Separate donations from refunds
  const donations = allTx.filter((tx: any) => tx.transaction_type === 'donation');
  const refunds = allTx.filter((tx: any) => tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation');

  // Aggregate donations and refunds by day for refund-adjusted daily net
  const dailyMap = new Map<string, { gross: number; fees: number; donationNet: number; refundNet: number }>();

  donations.forEach((tx: any) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { gross: 0, fees: 0, donationNet: 0, refundNet: 0 };
    current.gross += Number(tx.amount) || 0;
    current.fees += Number(tx.fee) || 0;
    current.donationNet += Number(tx.net_amount ?? tx.amount) || 0;
    dailyMap.set(date, current);
  });

  // Subtract refund net amounts per day (same logic as KPI totals)
  refunds.forEach((tx: any) => {
    const date = format(parseISO(tx.transaction_date), "yyyy-MM-dd");
    const current = dailyMap.get(date) || { gross: 0, fees: 0, donationNet: 0, refundNet: 0 };
    current.refundNet += Math.abs(Number(tx.net_amount ?? tx.amount ?? 0));
    dailyMap.set(date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { donationNet, refundNet }]) => ({
      date: format(parseISO(date), "MMM d"),
      value: donationNet - refundNet, // Refund-adjusted daily net
    }));

  // Calculate totals (donations only, then subtract refunds)
  const totalGross = donations.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const totalFees = donations.reduce((sum: number, tx: any) => sum + Number(tx.fee || 0), 0);
  const totalRefunds = refunds.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.net_amount ?? tx.amount ?? 0)), 0);
  const totalNet = totalGross - totalFees - totalRefunds;

  // Breakdown by revenue type
  const breakdown: KpiBreakdownItem[] = [
    { label: "Gross Donations", value: `$${totalGross.toLocaleString()}`, percentage: 100 },
    { label: "Processing Fees", value: `$${totalFees.toLocaleString()}`, percentage: totalGross > 0 ? (totalFees / totalGross) * 100 : 0 },
    { label: "Refunds/Cancellations", value: `$${totalRefunds.toLocaleString()}`, percentage: totalGross > 0 ? (totalRefunds / totalGross) * 100 : 0 },
    { label: "Net Revenue", value: `$${totalNet.toLocaleString()}`, percentage: totalGross > 0 ? (totalNet / totalGross) * 100 : 0 },
  ];

  return {
    kpiKey: "netRevenue",
    label: "Net Revenue",
    value: `$${totalNet.toLocaleString()}`,
    trend: { value: 0, isPositive: true },
    description: "Total donations minus processing fees and refunds/cancellations",
    trendData,
    breakdown,
  };
}

async function fetchRoiDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Fetch revenue and spend
  const [{ data: txData }, { data: metaData }, { data: smsData }] = await Promise.all([
    (supabase as any)
      .from("actblue_transactions_secure")
      .select("amount, net_amount, fee, transaction_type, transaction_date")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lt("transaction_date", endDateInclusive),
    supabase
      .from("meta_ad_metrics")
      .select("date, spend")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate),
    (supabase as any)
      .from("sms_campaigns")
      .select("send_date, cost")
      .eq("organization_id", organizationId)
      .gte("send_date", startDate)
      .lt("send_date", endDateInclusive)
      .neq("status", "draft"),
  ]);

  // Calculate net revenue (donations - fees - refunds)
  const allTx = txData || [];
  const donations = allTx.filter((tx: any) => tx.transaction_type === 'donation');
  const refunds = allTx.filter((tx: any) => tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation');

  const donationNet = donations.reduce((sum: number, tx: any) => sum + Number(tx.net_amount ?? tx.amount ?? 0), 0);
  const refundAmount = refunds.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.net_amount ?? tx.amount ?? 0)), 0);
  const totalRevenue = donationNet - refundAmount;

  const metaSpend = (metaData || []).reduce((sum: number, d: any) => sum + Number(d.spend || 0), 0);
  const smsSpend = (smsData || []).reduce((sum: number, d: any) => sum + Number(d.cost || 0), 0);
  const totalSpend = metaSpend + smsSpend;
  // ROI = Net Revenue / Total Spend (investment multiplier)
  const roi = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Daily ROI trend
  const dailyMap = new Map<string, { revenue: number; spend: number }>();

  // Add donations by day
  donations.forEach((tx: any) => {
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    const current = dailyMap.get(date) || { revenue: 0, spend: 0 };
    current.revenue += Number(tx.net_amount ?? tx.amount ?? 0);
    dailyMap.set(date, current);
  });

  // Subtract refunds
  refunds.forEach((tx: any) => {
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    const current = dailyMap.get(date) || { revenue: 0, spend: 0 };
    current.revenue -= Math.abs(Number(tx.net_amount ?? tx.amount ?? 0));
    dailyMap.set(date, current);
  });

  // Add spend by day
  (metaData || []).forEach((d: any) => {
    const current = dailyMap.get(d.date) || { revenue: 0, spend: 0 };
    current.spend += Number(d.spend || 0);
    dailyMap.set(d.date, current);
  });

  (smsData || []).forEach((d: any) => {
    const date = d.send_date?.split('T')[0];
    if (!date) return;
    const current = dailyMap.get(date) || { revenue: 0, spend: 0 };
    current.spend += Number(d.cost || 0);
    dailyMap.set(date, current);
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
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  const { data: txData } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("transaction_date, amount, net_amount, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDateInclusive);

  const allTx = txData || [];

  // Separate donations and refunds
  const donations = allTx.filter((tx: any) => tx.transaction_type === "donation");
  const refunds = allTx.filter((tx: any) => tx.transaction_type === "refund" || tx.transaction_type === "cancellation");

  // Use gross amount for donation totals, net_amount for refunds (with Math.abs)
  const totalDonations = donations.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const refundedAmount = refunds.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.net_amount ?? tx.amount ?? 0)), 0);
  const refundRate = totalDonations > 0 ? (refundedAmount / totalDonations) * 100 : 0;

  // Daily refund rate trend - use net_amount for refunds
  const dailyMap = new Map<string, { donations: number; refunded: number }>();

  donations.forEach((tx: any) => {
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    const current = dailyMap.get(date) || { donations: 0, refunded: 0 };
    current.donations += Number(tx.amount) || 0;
    dailyMap.set(date, current);
  });

  refunds.forEach((tx: any) => {
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    const current = dailyMap.get(date) || { donations: 0, refunded: 0 };
    current.refunded += Math.abs(Number(tx.net_amount ?? tx.amount ?? 0));
    dailyMap.set(date, current);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { donations, refunded }]) => ({
      date: format(parseISO(date), "MMM d"),
      value: donations > 0 ? (refunded / donations) * 100 : 0,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Gross Donations", value: `$${totalDonations.toLocaleString()}`, percentage: 100 },
    { label: "Refunds/Cancellations", value: `$${refundedAmount.toLocaleString()}`, percentage: refundRate },
    { label: "Net Retained", value: `$${(totalDonations - refundedAmount).toLocaleString()}`, percentage: 100 - refundRate },
    { label: "Refund Count", value: refunds.length.toString() },
  ];

  return {
    kpiKey: "refundRate",
    label: "Refund Rate",
    value: `${refundRate.toFixed(1)}%`,
    trend: { value: 0, isPositive: refundRate <= 5 },
    description: "Percentage of donations refunded or cancelled",
    trendData,
    breakdown,
  };
}

interface RecurringHealthV2Response {
  current_active_mrr: number;
  current_active_donors: number;
  current_paused_donors: number;
  current_cancelled_donors: number;
  current_failed_donors: number;
  current_churned_donors: number;
  new_recurring_mrr: number;
  new_recurring_donors: number;
  period_recurring_revenue: number;
  period_recurring_transactions: number;
  avg_recurring_amount: number;
  upsell_shown: number;
  upsell_succeeded: number;
  upsell_rate: number;
}

async function fetchCurrentMrrDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Fetch recurring health data using the v2 RPC
  const { data: healthData } = await supabase.rpc('get_recurring_health_v2', {
    _organization_id: organizationId,
    _start_date: startDate,
    _end_date: endDate,
  });

  const health = (healthData?.[0] || {}) as RecurringHealthV2Response;
  const currentMrr = Number(health.current_active_mrr || 0);
  const activeDonors = Number(health.current_active_donors || 0);
  const avgAmount = Number(health.avg_recurring_amount || 0);
  const churnedDonors = Number(health.current_churned_donors || 0);
  const pausedDonors = Number(health.current_paused_donors || 0);
  const cancelledDonors = Number(health.current_cancelled_donors || 0);
  
  const totalDonors = activeDonors + churnedDonors + pausedDonors + cancelledDonors;
  const activeRate = totalDonors > 0 ? (activeDonors / totalDonors) * 100 : 0;

  const breakdown: KpiBreakdownItem[] = [
    { label: "Current Active MRR", value: `$${currentMrr.toLocaleString()}` },
    { label: "Active Donors", value: activeDonors.toLocaleString(), percentage: activeRate },
    { label: "Avg Recurring Amount", value: `$${avgAmount.toFixed(2)}` },
    { label: "Churned Donors", value: churnedDonors.toLocaleString() },
    { label: "Paused Donors", value: pausedDonors.toLocaleString() },
    { label: "Cancelled Donors", value: cancelledDonors.toLocaleString() },
  ];

  return {
    kpiKey: "currentMrr",
    label: "Current Active MRR",
    value: `$${currentMrr.toLocaleString()}`,
    trend: { value: 0, isPositive: true },
    description: "Expected monthly revenue from currently active recurring donors",
    trendData: [],
    breakdown,
  };
}

async function fetchNewMrrDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Fetch recurring health data using the v2 RPC
  const { data: healthData } = await supabase.rpc('get_recurring_health_v2', {
    _organization_id: organizationId,
    _start_date: startDate,
    _end_date: endDate,
  });

  const health = (healthData?.[0] || {}) as RecurringHealthV2Response;
  const newMrr = Number(health.new_recurring_mrr || 0);
  const newDonors = Number(health.new_recurring_donors || 0);
  const periodRevenue = Number(health.period_recurring_revenue || 0);
  const periodTx = Number(health.period_recurring_transactions || 0);

  const breakdown: KpiBreakdownItem[] = [
    { label: "New MRR Added", value: `$${newMrr.toLocaleString()}` },
    { label: "New Recurring Donors", value: newDonors.toLocaleString() },
    { label: "Period Recurring Revenue", value: `$${periodRevenue.toLocaleString()}` },
    { label: "Period Transactions", value: periodTx.toLocaleString() },
  ];

  return {
    kpiKey: "newMrr",
    label: "New MRR Added",
    value: `$${newMrr.toLocaleString()}`,
    trend: { value: newDonors, isPositive: newDonors > 0 },
    description: "MRR from donors who started recurring in the selected period",
    trendData: [],
    breakdown,
  };
}

async function fetchDonorsDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Use secure view with donor_id_hash for unique identification
  const { data: txData } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("transaction_date, donor_email, donor_id_hash, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDateInclusive);

  const allTx = txData || [];

  // Only count donors from donations (not refunds)
  const donations = allTx.filter((tx: any) => tx.transaction_type === 'donation');

  // Use donor_id_hash for unique identification (falls back to email)
  const getDonorKey = (tx: any) => tx.donor_id_hash || tx.donor_email;
  const uniqueDonors = new Set(donations.map(getDonorKey).filter(Boolean)).size;

  // Daily unique donors trend
  const dailyDonors = new Map<string, Set<string>>();
  donations.forEach((tx: any) => {
    const donorKey = getDonorKey(tx);
    if (!donorKey) return;
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    if (!dailyDonors.has(date)) {
      dailyDonors.set(date, new Set());
    }
    dailyDonors.get(date)!.add(donorKey);
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyDonors.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, donors]) => ({
      date: format(parseISO(date), "MMM d"),
      value: donors.size,
    }));

  const avgDonationsPerDonor = uniqueDonors > 0 ? (donations.length / uniqueDonors).toFixed(1) : "0";

  const breakdown: KpiBreakdownItem[] = [
    { label: "Unique Donors", value: uniqueDonors.toString() },
    { label: "Total Donations", value: donations.length.toString() },
    { label: "Avg Donations/Donor", value: avgDonationsPerDonor },
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
