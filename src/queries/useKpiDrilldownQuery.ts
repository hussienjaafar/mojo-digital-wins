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

async function fetchRecurringDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  const { data: txData } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("transaction_date, amount, net_amount, is_recurring, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDateInclusive);

  const allTx = txData || [];

  // Only count donations (not refunds) for recurring metrics
  const donations = allTx.filter((tx: any) => tx.transaction_type === 'donation');
  const recurringDonations = donations.filter((tx: any) => tx.is_recurring === true);
  const oneTimeDonations = donations.filter((tx: any) => !tx.is_recurring);

  const recurringTotal = recurringDonations.reduce((sum: number, tx: any) => sum + Number(tx.net_amount ?? tx.amount ?? 0), 0);
  const oneTimeTotal = oneTimeDonations.reduce((sum: number, tx: any) => sum + Number(tx.net_amount ?? tx.amount ?? 0), 0);
  const overallTotal = recurringTotal + oneTimeTotal;
  const recurringPercentage = overallTotal > 0 ? (recurringTotal / overallTotal) * 100 : 0;

  // Daily recurring revenue trend
  const dailyMap = new Map<string, number>();
  recurringDonations.forEach((tx: any) => {
    const date = tx.transaction_date?.split('T')[0];
    if (!date) return;
    dailyMap.set(date, (dailyMap.get(date) || 0) + Number(tx.net_amount ?? tx.amount ?? 0));
  });

  const trendData: KpiTrendPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: format(parseISO(date), "MMM d"),
      value,
    }));

  const breakdown: KpiBreakdownItem[] = [
    { label: "Recurring Revenue", value: `$${recurringTotal.toLocaleString()}`, percentage: recurringPercentage },
    { label: "One-time Revenue", value: `$${oneTimeTotal.toLocaleString()}`, percentage: 100 - recurringPercentage },
    { label: "Recurring Donations", value: recurringDonations.length.toString() },
    { label: "One-time Donations", value: oneTimeDonations.length.toString() },
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

async function fetchAttributionDrilldown(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<KpiDrilldownData> {
  // Use inclusive date range
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Try to use donation_attribution view for accurate attribution data
  const [{ data: attrData }, { data: txData }] = await Promise.all([
    (supabase as any)
      .from("donation_attribution")
      .select("attribution_method, attributed_platform, transaction_type")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lt("transaction_date", endDateInclusive)
      .eq("transaction_type", "donation"),
    (supabase as any)
      .from("actblue_transactions_secure")
      .select("refcode, source_campaign, click_id, fbclid, transaction_type")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lt("transaction_date", endDateInclusive)
      .eq("transaction_type", "donation"),
  ]);

  const attributions = attrData || [];
  const donations = txData || [];

  let breakdown: KpiBreakdownItem[];
  let deterministicRate: number;

  if (attributions.length > 0) {
    // Use donation_attribution view for accurate breakdown
    const byMethod: Record<string, number> = {};
    attributions.forEach((a: any) => {
      const method = a.attribution_method || 'unattributed';
      byMethod[method] = (byMethod[method] || 0) + 1;
    });

    const total = attributions.length;
    const deterministic = total - (byMethod['unattributed'] || 0);
    deterministicRate = total > 0 ? (deterministic / total) * 100 : 0;

    // Log attribution breakdown for observability
    logger.debug('Attribution drilldown from donation_attribution', {
      total,
      byMethod,
      deterministicRate: deterministicRate.toFixed(1) + '%',
    });

    // Warn if SMS attribution is missing when expected
    if ((byMethod['sms_last_touch'] || 0) === 0) {
      logger.debug('No SMS last-touch attributions found in drilldown');
    }

    breakdown = [
      { label: "Refcode", value: (byMethod['refcode'] || 0).toString(), percentage: total > 0 ? ((byMethod['refcode'] || 0) / total) * 100 : 0 },
      { label: "Click ID/FBCLID", value: (byMethod['click_id'] || 0).toString(), percentage: total > 0 ? ((byMethod['click_id'] || 0) / total) * 100 : 0 },
      { label: "SMS Last-Touch", value: (byMethod['sms_last_touch'] || 0).toString(), percentage: total > 0 ? ((byMethod['sms_last_touch'] || 0) / total) * 100 : 0 },
      { label: "Regex Match", value: (byMethod['regex'] || 0).toString(), percentage: total > 0 ? ((byMethod['regex'] || 0) / total) * 100 : 0 },
      { label: "Unattributed", value: (byMethod['unattributed'] || 0).toString(), percentage: total > 0 ? ((byMethod['unattributed'] || 0) / total) * 100 : 0 },
      { label: "Total Donations", value: total.toString() },
    ];
  } else {
    // Fallback to transaction-level fields
    logger.warn('Attribution drilldown fallback: donation_attribution view returned no data');

    const total = donations.length;
    const withRefcode = donations.filter((tx: any) => tx.refcode).length;
    const withClickId = donations.filter((tx: any) => tx.click_id || tx.fbclid).length;
    const withCampaign = donations.filter((tx: any) => tx.source_campaign && !tx.refcode && !tx.click_id && !tx.fbclid).length;
    const deterministic = donations.filter((tx: any) => tx.refcode || tx.source_campaign || tx.click_id || tx.fbclid).length;
    const unattributed = total - deterministic;
    deterministicRate = total > 0 ? (deterministic / total) * 100 : 0;

    logger.debug('Attribution fallback breakdown', {
      total,
      withRefcode,
      withClickId,
      withCampaign,
      unattributed,
    });

    breakdown = [
      { label: "With Refcode", value: withRefcode.toString(), percentage: total > 0 ? (withRefcode / total) * 100 : 0 },
      { label: "With Click ID/FBCLID", value: withClickId.toString(), percentage: total > 0 ? (withClickId / total) * 100 : 0 },
      { label: "With Campaign", value: withCampaign.toString(), percentage: total > 0 ? (withCampaign / total) * 100 : 0 },
      { label: "Unattributed", value: unattributed.toString(), percentage: total > 0 ? (unattributed / total) * 100 : 0 },
      { label: "Total Donations", value: total.toString() },
    ];
  }

  return {
    kpiKey: "attributionQuality",
    label: "Attribution Quality",
    value: `${deterministicRate.toFixed(0)}%`,
    trend: { value: 0, isPositive: deterministicRate >= 50 },
    description: "Percentage of donations with deterministic attribution (refcode, click_id, SMS, etc.)",
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
