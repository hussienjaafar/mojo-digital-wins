import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, subDays, eachDayOfInterval } from "date-fns";

export interface DashboardKPIs {
  totalRaised: number;
  totalNetRevenue: number;
  totalFees: number;
  feePercentage: number;
  refundAmount: number;
  refundRate: number;
  recurringRaised: number;
  recurringChurnRate: number;
  recurringDonations: number;
  uniqueDonors: number;
  newDonors: number;
  returningDonors: number;
  recurringPercentage: number;
  upsellConversionRate: number;
  roi: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgDonation: number;
  donationCount: number;
  deterministicRate: number;
}

export interface DashboardTimeSeriesPoint {
  name: string;
  donations: number;
  netDonations: number;
  refunds: number;
  metaSpend: number;
  smsSpend: number;
  donationsPrev: number;
  netDonationsPrev: number;
  refundsPrev: number;
  metaSpendPrev: number;
  smsSpendPrev: number;
}

export interface ChannelBreakdown {
  name: string;
  value: number;
  label: string;
}

export interface SparklineDataPoint {
  date: string;
  value: number;
}

export interface SparklineData {
  netRevenue: SparklineDataPoint[];
  roi: SparklineDataPoint[];
  refundRate: SparklineDataPoint[];
  recurringHealth: SparklineDataPoint[];
  uniqueDonors: SparklineDataPoint[];
  attributionQuality: SparklineDataPoint[];
}

interface DashboardMetricsResult {
  kpis: DashboardKPIs;
  prevKpis: Partial<DashboardKPIs>;
  timeSeries: DashboardTimeSeriesPoint[];
  channelBreakdown: ChannelBreakdown[];
  sparklines: SparklineData;
  metaConversions: number;
  smsConversions: number;
  directDonations: number;
  metaSpend: number;
  smsSpend: number;
  smsMessagesSent: number;
}

function getPreviousPeriod(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, daysDiff);
  return {
    start: format(prevStart, 'yyyy-MM-dd'),
    end: format(prevEnd, 'yyyy-MM-dd'),
  };
}

// ============================================================================
// Performance: Bucket items by yyyy-MM-dd key for O(1) lookups
// ============================================================================

/**
 * Extract yyyy-MM-dd from an ISO-ish date string (e.g., "2024-01-15T12:30:00").
 * Returns null if the string doesn't start with a valid date format.
 */
function extractDayKey(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.length < 10) return null;
  // Check for yyyy-MM-dd format (positions 4 and 7 are '-')
  if (dateStr[4] !== '-' || dateStr[7] !== '-') return null;
  return dateStr.slice(0, 10);
}

/**
 * Bucket an array of items by day key for O(1) lookups.
 * @param items Array of items to bucket
 * @param getDateStr Function to extract date string from each item
 * @returns Map from yyyy-MM-dd key to array of items for that day
 */
function bucketByDay<T>(
  items: T[],
  getDateStr: (item: T) => string | null | undefined
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const dayKey = extractDayKey(getDateStr(item));
    if (dayKey) {
      const bucket = buckets.get(dayKey);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(dayKey, [item]);
      }
    }
  }
  return buckets;
}

/**
 * Bucket metaMetrics by date (already yyyy-MM-dd format).
 */
function bucketMetaByDay<T extends { date?: string }>(items: T[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    if (item.date) {
      const bucket = buckets.get(item.date);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(item.date, [item]);
      }
    }
  }
  return buckets;
}

async function fetchDashboardMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DashboardMetricsResult> {
  const prevPeriod = getPreviousPeriod(startDate, endDate);

  // Parallel fetch all data
  const [
    { data: donationData },
    { data: prevDonationData },
    { data: metaData },
    { data: prevMetaData },
    { data: smsData },
    { data: prevSmsData },
  ] = await Promise.all([
    // Current period donations
    (supabase as any)
      .from('actblue_transactions_secure')
      .select('amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign')
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', `${endDate}T23:59:59`),
    // Previous period donations
    (supabase as any)
      .from('actblue_transactions_secure')
      .select('amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign')
      .eq('organization_id', organizationId)
      .gte('transaction_date', prevPeriod.start)
      .lte('transaction_date', `${prevPeriod.end}T23:59:59`),
    // Current period Meta
    (supabase as any)
      .from('meta_ad_metrics')
      .select('date, spend, impressions, clicks, conversions')
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .lte('date', endDate),
    // Previous period Meta
    (supabase as any)
      .from('meta_ad_metrics')
      .select('date, spend, impressions, clicks, conversions')
      .eq('organization_id', organizationId)
      .gte('date', prevPeriod.start)
      .lte('date', prevPeriod.end),
    // Current period SMS
    (supabase as any)
      .from('sms_campaigns')
      .select('send_date, messages_sent, conversions, cost, amount_raised')
      .eq('organization_id', organizationId)
      .gte('send_date', startDate)
      .lte('send_date', `${endDate}T23:59:59`)
      .neq('status', 'draft'),
    // Previous period SMS
    (supabase as any)
      .from('sms_campaigns')
      .select('send_date, messages_sent, conversions, cost, amount_raised')
      .eq('organization_id', organizationId)
      .gte('send_date', prevPeriod.start)
      .lte('send_date', `${prevPeriod.end}T23:59:59`)
      .neq('status', 'draft'),
  ]);

  const donations = donationData || [];
  const prevDonations = prevDonationData || [];
  const metaMetrics = metaData || [];
  const prevMetaMetrics = prevMetaData || [];
  const smsMetrics = smsData || [];
  const prevSmsMetrics = prevSmsData || [];

  // Calculate current period KPIs
  const totalRaised = donations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const totalNetRevenue = donations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const totalFees = donations.reduce((sum: number, d: any) => sum + Number(d.fee || 0), 0);
  const feePercentage = totalRaised > 0 ? (totalFees / totalRaised) * 100 : 0;
  
  const refunds = donations.filter((d: any) => d.transaction_type === 'refund');
  const refundAmount = refunds.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const refundRate = totalRaised > 0 ? (refundAmount / totalRaised) * 100 : 0;

  const recurringDonations = donations.filter((d: any) => d.is_recurring);
  const recurringRaised = recurringDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const recurringCancellations = recurringDonations.filter((d: any) => d.transaction_type === 'cancellation').length;
  const recurringRefunds = recurringDonations.filter((d: any) => d.transaction_type === 'refund').length;
  const recurringChurnEvents = recurringCancellations + recurringRefunds;
  const recurringChurnRate = recurringDonations.length > 0 ? (recurringChurnEvents / recurringDonations.length) * 100 : 0;

  const uniqueDonors = new Set(donations.map((d: any) => d.donor_id_hash || d.donor_email)).size;
  const currentDonorSet = new Set(donations.map((d: any) => d.donor_id_hash || d.donor_email));
  const prevDonorSet = new Set(prevDonations.map((d: any) => d.donor_id_hash || d.donor_email));
  
  let newDonors = 0;
  let returningDonors = 0;
  currentDonorSet.forEach((d) => {
    if (prevDonorSet.has(d)) returningDonors += 1;
    else newDonors += 1;
  });

  const recurringDonorCount = donations.filter((d: any) => d.is_recurring).length;
  const recurringPercentage = donations.length > 0 ? (recurringDonorCount / donations.length) * 100 : 0;

  const upsellShown = donations.filter((d: any) => d.recurring_upsell_shown).length;
  const upsellSucceeded = donations.filter((d: any) => d.recurring_upsell_succeeded).length;
  const upsellConversionRate = upsellShown > 0 ? (upsellSucceeded / upsellShown) * 100 : 0;

  const totalMetaSpend = metaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const totalSMSCost = smsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const totalSpend = totalMetaSpend + totalSMSCost;
  // ROI = (Revenue - Cost) / Cost, not ROAS which is Revenue / Cost
  const roi = totalSpend > 0 ? (totalNetRevenue - totalSpend) / totalSpend : 0;

  const totalImpressions = metaMetrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0);
  const totalClicks = metaMetrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
  const avgDonation = donations.length > 0 ? totalRaised / donations.length : 0;

  const deterministicCount = donations.filter((d: any) => d.refcode || d.source_campaign).length;
  const deterministicRate = donations.length > 0 ? (deterministicCount / donations.length) * 100 : 0;

  // Calculate previous period KPIs
  const prevTotalRaised = prevDonations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const prevTotalNetRevenue = prevDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const prevRefunds = prevDonations.filter((d: any) => d.transaction_type === 'refund');
  const prevRefundAmount = prevRefunds.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const prevRefundRate = prevTotalRaised > 0 ? (prevRefundAmount / prevTotalRaised) * 100 : 0;
  
  const prevRecurring = prevDonations.filter((d: any) => d.is_recurring);
  const prevRecurringRaised = prevRecurring.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const prevRecurringChurn = prevRecurring.filter((d: any) => d.transaction_type === 'cancellation' || d.transaction_type === 'refund').length;
  const prevRecurringChurnRate = prevRecurring.length > 0 ? (prevRecurringChurn / prevRecurring.length) * 100 : 0;
  
  const prevUniqueDonors = new Set(prevDonations.map((d: any) => d.donor_id_hash || d.donor_email)).size;
  const prevRecurringDonorCount = prevDonations.filter((d: any) => d.is_recurring).length;
  const prevRecurringPercentage = prevDonations.length > 0 ? (prevRecurringDonorCount / prevDonations.length) * 100 : 0;

  const prevMetaSpend = prevMetaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const prevSMSCost = prevSmsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const prevTotalSpend = prevMetaSpend + prevSMSCost;
  // ROI = (Revenue - Cost) / Cost
  const prevRoi = prevTotalSpend > 0 ? (prevTotalNetRevenue - prevTotalSpend) / prevTotalSpend : 0;

  const prevDeterministicCount = prevDonations.filter((d: any) => d.refcode || d.source_campaign).length;
  const prevDeterministicRate = prevDonations.length > 0 ? (prevDeterministicCount / prevDonations.length) * 100 : 0;

  // Build time series data
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
  const prevDays = eachDayOfInterval({
    start: parseISO(prevPeriod.start),
    end: parseISO(prevPeriod.end),
  });

  // Pre-bucket data by day for O(1) lookups instead of O(days × rows) filtering
  const donationsByDay = bucketByDay(donations, (d: any) => d.transaction_date);
  const metaByDay = bucketMetaByDay(metaMetrics);
  const smsByDay = bucketByDay(smsMetrics, (s: any) => s.send_date);
  const prevDonationsByDay = bucketByDay(prevDonations, (d: any) => d.transaction_date);
  const prevMetaByDay = bucketMetaByDay(prevMetaMetrics);
  const prevSmsByDay = bucketByDay(prevSmsMetrics, (s: any) => s.send_date);

  const timeSeries: DashboardTimeSeriesPoint[] = days.map((day, index) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLabel = format(day, 'MMM d');
    const prevDay = prevDays[index];
    const prevDayStr = prevDay ? format(prevDay, 'yyyy-MM-dd') : null;

    // O(1) lookups instead of O(n) filter calls
    const dayDonations = donationsByDay.get(dayStr) ?? [];
    const dayMeta = metaByDay.get(dayStr) ?? [];
    const daySms = smsByDay.get(dayStr) ?? [];
    const dayRefunds = dayDonations.filter((d: any) => d.transaction_type === 'refund');

    const prevDayDonations = prevDayStr ? (prevDonationsByDay.get(prevDayStr) ?? []) : [];
    const prevDayMeta = prevDayStr ? (prevMetaByDay.get(prevDayStr) ?? []) : [];
    const prevDaySms = prevDayStr ? (prevSmsByDay.get(prevDayStr) ?? []) : [];
    const prevDayRefunds = prevDayDonations.filter((d: any) => d.transaction_type === 'refund');

    const grossDonations = dayDonations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const netDonations = dayDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const refundAmountDay = dayRefunds.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);

    const prevGross = prevDayDonations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const prevNet = prevDayDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const prevRefundAmountDay = prevDayRefunds.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);

    return {
      name: dayLabel,
      donations: grossDonations,
      netDonations,
      refunds: -refundAmountDay,
      metaSpend: dayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpend: daySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
      donationsPrev: prevGross,
      netDonationsPrev: prevNet,
      refundsPrev: -prevRefundAmountDay,
      metaSpendPrev: prevDayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpendPrev: prevDaySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
    };
  });

  // Channel breakdown
  const metaConversions = metaMetrics.reduce((sum: number, m: any) => sum + (m.conversions || 0), 0);
  const smsConversions = smsMetrics.reduce((sum: number, s: any) => sum + (s.conversions || 0), 0);
  const directDonationCount = donations.filter((d: any) => !d.refcode).length;
  const total = metaConversions + smsConversions + directDonationCount || 1;
  const pct = (val: number) => Math.round((val / total) * 100);

  const channelBreakdown: ChannelBreakdown[] = [
    { name: `Meta Ads (${pct(metaConversions)}%)`, value: metaConversions, label: `${metaConversions}` },
    { name: `SMS (${pct(smsConversions)}%)`, value: smsConversions, label: `${smsConversions}` },
    { name: `Direct (${pct(directDonationCount)}%)`, value: directDonationCount, label: `${directDonationCount}` },
  ];

  // Build sparkline data from time series with calendar dates
  const sparklines: SparklineData = {
    netRevenue: timeSeries.map((d, i) => ({
      date: format(days[i], 'MMM d'),
      value: d.netDonations,
    })),
    roi: timeSeries.map((d, i) => {
      const daySpend = d.metaSpend + d.smsSpend;
      // ROI = (Revenue - Cost) / Cost
      return {
        date: format(days[i], 'MMM d'),
        value: daySpend > 0 ? (d.netDonations - daySpend) / daySpend : 0,
      };
    }),
    refundRate: timeSeries.map((d, i) => {
      const gross = d.donations;
      const refundAbs = Math.abs(d.refunds);
      return {
        date: format(days[i], 'MMM d'),
        value: gross > 0 ? (refundAbs / gross) * 100 : 0,
      };
    }),
    recurringHealth: timeSeries.map((d, i) => {
      // O(1) bucket lookup + filter for recurring only
      const dayStr = format(days[i], 'yyyy-MM-dd');
      const dayDonations = (donationsByDay.get(dayStr) ?? []).filter((don: any) => don.is_recurring);
      return {
        date: format(days[i], 'MMM d'),
        value: dayDonations.reduce((sum: number, don: any) => sum + Number(don.net_amount ?? don.amount ?? 0), 0),
      };
    }),
    uniqueDonors: timeSeries.map((d, i) => {
      // O(1) bucket lookup
      const dayStr = format(days[i], 'yyyy-MM-dd');
      const dayDonations = donationsByDay.get(dayStr) ?? [];
      return {
        date: format(days[i], 'MMM d'),
        value: new Set(dayDonations.map((don: any) => don.donor_id_hash || don.donor_email)).size,
      };
    }),
    attributionQuality: timeSeries.map((d, i) => {
      // O(1) bucket lookup
      const dayStr = format(days[i], 'yyyy-MM-dd');
      const dayDonations = donationsByDay.get(dayStr) ?? [];
      const attributed = dayDonations.filter((don: any) => don.refcode || don.source_campaign).length;
      return {
        date: format(days[i], 'MMM d'),
        value: dayDonations.length > 0 ? (attributed / dayDonations.length) * 100 : 0,
      };
    }),
  };

  return {
    kpis: {
      totalRaised,
      totalNetRevenue,
      totalFees,
      feePercentage,
      refundAmount,
      refundRate,
      recurringRaised,
      recurringChurnRate,
      recurringDonations: recurringDonations.length,
      uniqueDonors,
      newDonors,
      returningDonors,
      recurringPercentage,
      upsellConversionRate,
      roi,
      totalSpend,
      totalImpressions,
      totalClicks,
      avgDonation,
      donationCount: donations.length,
      deterministicRate,
    },
    prevKpis: {
      totalRaised: prevTotalRaised,
      totalNetRevenue: prevTotalNetRevenue,
      refundAmount: prevRefundAmount,
      refundRate: prevRefundRate,
      recurringRaised: prevRecurringRaised,
      recurringChurnRate: prevRecurringChurnRate,
      uniqueDonors: prevUniqueDonors,
      recurringPercentage: prevRecurringPercentage,
      roi: prevRoi,
      totalSpend: prevTotalSpend,
      deterministicRate: prevDeterministicRate,
    },
    timeSeries,
    channelBreakdown,
    sparklines,
    metaConversions,
    smsConversions,
    directDonations: directDonationCount,
    metaSpend: totalMetaSpend,
    smsSpend: totalSMSCost,
    smsMessagesSent: smsMetrics.reduce((sum: number, s: any) => sum + (s.messages_sent || 0), 0),
  };
}

export function useClientDashboardMetricsQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: ['dashboard', 'metrics', organizationId, dateRange],
    queryFn: () => fetchDashboardMetrics(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
