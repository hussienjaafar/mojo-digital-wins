import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange, useSelectedCampaignId, useSelectedCreativeId } from "@/stores/dashboardStore";
import { format, parseISO, subDays, eachDayOfInterval, addDays } from "date-fns";
import { logger } from "@/lib/logger";

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
  /** True if attribution data comes from fallback (transaction fields) instead of donation_attribution view */
  attributionFallbackMode: boolean;
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
  endDate: string,
  campaignId: string | null = null,
  creativeId: string | null = null
): Promise<DashboardMetricsResult> {
  const prevPeriod = getPreviousPeriod(startDate, endDate);
  const hasFilters = !!(campaignId || creativeId);

  // Use inclusive date range: [startDate, endDate+1day) to include full end date
  // This ensures transactions at 23:59:59 on endDate are included
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');
  const prevEndInclusive = format(addDays(parseISO(prevPeriod.end), 1), 'yyyy-MM-dd');

  // Helper to build attribution query with filters
  const buildAttrQuery = (start: string, endInc: string) => {
    let query = (supabase as any)
      .from('donation_attribution')
      .select('transaction_id, attribution_method, attributed_platform, attributed_campaign_id, attributed_creative_id, transaction_type, amount, net_amount, transaction_date')
      .eq('organization_id', organizationId)
      .gte('transaction_date', start)
      .lt('transaction_date', endInc);
    if (campaignId) query = query.eq('attributed_campaign_id', campaignId);
    if (creativeId) query = query.eq('attributed_creative_id', creativeId);
    return query;
  };

  // Helper to build meta query with campaign/creative filters
  const buildMetaQuery = (start: string, end: string) => {
    let query = (supabase as any)
      .from('meta_ad_metrics')
      .select('date, spend, impressions, clicks, conversions, campaign_id, ad_creative_id')
      .eq('organization_id', organizationId)
      .gte('date', start)
      .lte('date', end);
    // Filter by campaign_id if campaign filter is active
    if (campaignId) query = query.eq('campaign_id', campaignId);
    // Filter by ad_creative_id if creative filter is active
    if (creativeId) query = query.eq('ad_creative_id', creativeId);
    return query;
  };

  // Phase 1: Fetch attribution data first if filters are active
  // This gives us transaction_ids to filter the main transaction query
  let filteredTxIds: Set<string> | null = null;
  let prevFilteredTxIds: Set<string> | null = null;

  if (hasFilters) {
    const [{ data: attrData }, { data: prevAttrData }] = await Promise.all([
      buildAttrQuery(startDate, endDateInclusive),
      buildAttrQuery(prevPeriod.start, prevEndInclusive),
    ]);

    filteredTxIds = new Set((attrData || []).map((a: any) => a.transaction_id).filter(Boolean));
    prevFilteredTxIds = new Set((prevAttrData || []).map((a: any) => a.transaction_id).filter(Boolean));
  }

  // Phase 2: Fetch all data (transactions will be filtered client-side if filters active)
  const [
    { data: donationData },
    { data: prevDonationData },
    { data: attributionData },
    { data: prevAttributionData },
    { data: metaData },
    { data: prevMetaData },
    { data: smsData },
    { data: prevSmsData },
  ] = await Promise.all([
    // Current period donations - fetch all, filter client-side if needed
    (supabase as any)
      .from('actblue_transactions_secure')
      .select('id, amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign, click_id, fbclid')
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lt('transaction_date', endDateInclusive),
    // Previous period donations
    (supabase as any)
      .from('actblue_transactions_secure')
      .select('id, amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign, click_id, fbclid')
      .eq('organization_id', organizationId)
      .gte('transaction_date', prevPeriod.start)
      .lt('transaction_date', prevEndInclusive),
    // Attribution data (re-fetch for consistent results, or use cached from Phase 1)
    buildAttrQuery(startDate, endDateInclusive),
    buildAttrQuery(prevPeriod.start, prevEndInclusive),
    // Current period Meta (filtered by campaign if applicable)
    buildMetaQuery(startDate, endDate),
    // Previous period Meta
    buildMetaQuery(prevPeriod.start, prevPeriod.end),
    // Current period SMS (no campaign filter - SMS campaigns are independent)
    // Note: SMS spend is excluded when campaign filter is active since SMS has no campaign mapping
    (supabase as any)
      .from('sms_campaigns')
      .select('send_date, messages_sent, conversions, cost, amount_raised')
      .eq('organization_id', organizationId)
      .gte('send_date', startDate)
      .lt('send_date', endDateInclusive)
      .neq('status', 'draft'),
    // Previous period SMS
    (supabase as any)
      .from('sms_campaigns')
      .select('send_date, messages_sent, conversions, cost, amount_raised')
      .eq('organization_id', organizationId)
      .gte('send_date', prevPeriod.start)
      .lt('send_date', prevEndInclusive)
      .neq('status', 'draft'),
  ]);

  // Apply client-side filtering for donations only (not refunds)
  // Refunds don't carry campaign/creative attribution, so they cannot be filtered.
  // We include ALL refunds to ensure net revenue remains refund-adjusted under filters.
  const rawTransactions = donationData || [];
  const prevRawTransactions = prevDonationData || [];

  // Separate donations from refunds BEFORE filtering
  // This ensures refunds are preserved even when donations are filtered
  let donations = rawTransactions.filter((d: any) => d.transaction_type === 'donation');
  let prevDonations = prevRawTransactions.filter((d: any) => d.transaction_type === 'donation');

  // Refunds are NOT filtered by campaign/creative (they don't have attribution)
  // This ensures net revenue = filtered donation net - ALL refund net
  const refunds = rawTransactions.filter((d: any) => d.transaction_type === 'refund' || d.transaction_type === 'cancellation');
  const prevRefunds = prevRawTransactions.filter((d: any) => d.transaction_type === 'refund' || d.transaction_type === 'cancellation');

  // Apply campaign/creative filtering to donations only
  if (hasFilters && filteredTxIds) {
    donations = donations.filter((tx: any) => filteredTxIds!.has(tx.id));
  }
  if (hasFilters && prevFilteredTxIds) {
    prevDonations = prevDonations.filter((tx: any) => prevFilteredTxIds!.has(tx.id));
  }

  // When filtering by campaign or creative, exclude SMS spend
  // Rationale: SMS campaigns don't map to Meta campaigns or creatives.
  // Including SMS with a Meta creative filter would mix unrelated data.
  const smsMetrics = hasFilters ? [] : (smsData || []);
  const prevSmsMetrics = hasFilters ? [] : (prevSmsData || []);

  const attribution = attributionData || [];
  const prevAttribution = prevAttributionData || [];
  const metaMetrics = metaData || [];
  const prevMetaMetrics = prevMetaData || [];

  // Calculate current period KPIs using donations only (not refunds)
  const grossDonations = donations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const refundAmount = refunds.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
  const totalRaised = grossDonations; // Gross donations only
  const totalNetRevenue = donations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0) - refundAmount;
  const totalFees = donations.reduce((sum: number, d: any) => sum + Number(d.fee || 0), 0);
  const feePercentage = grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0;

  // Refund rate: refunds as percentage of gross donations
  const refundRate = grossDonations > 0 ? (refundAmount / grossDonations) * 100 : 0;

  // Recurring donations (only actual donations, not refunds)
  const recurringDonations = donations.filter((d: any) => d.is_recurring);
  const recurringRaised = recurringDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);

  // Recurring churn: cancellations and refunds of recurring subscriptions
  const recurringCancellations = refunds.filter((d: any) => d.is_recurring && d.transaction_type === 'cancellation').length;
  const recurringRefundsCount = refunds.filter((d: any) => d.is_recurring && d.transaction_type === 'refund').length;
  const recurringChurnEvents = recurringCancellations + recurringRefundsCount;
  const activeRecurringCount = recurringDonations.length;
  const recurringChurnRate = activeRecurringCount > 0 ? (recurringChurnEvents / activeRecurringCount) * 100 : 0;

  // Unique donors (from donations only, not refunds)
  const uniqueDonors = new Set(donations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean)).size;
  const currentDonorSet = new Set(donations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean));
  const prevDonorSet = new Set(prevDonations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean));

  let newDonors = 0;
  let returningDonors = 0;
  currentDonorSet.forEach((d) => {
    if (prevDonorSet.has(d)) returningDonors += 1;
    else newDonors += 1;
  });

  const recurringPercentage = donations.length > 0 ? (recurringDonations.length / donations.length) * 100 : 0;

  // Upsell metrics (from donations only)
  const upsellShown = donations.filter((d: any) => d.recurring_upsell_shown).length;
  const upsellSucceeded = donations.filter((d: any) => d.recurring_upsell_succeeded).length;
  const upsellConversionRate = upsellShown > 0 ? (upsellSucceeded / upsellShown) * 100 : 0;

  const totalMetaSpend = metaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const totalSMSCost = smsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const totalSpend = totalMetaSpend + totalSMSCost;
  // ROI = Net Revenue / Spend (investment multiplier: 1.5x = $1.50 back per $1 spent)
  const roi = totalSpend > 0 ? totalNetRevenue / totalSpend : 0;

  const totalImpressions = metaMetrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0);
  const totalClicks = metaMetrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
  const avgDonation = donations.length > 0 ? grossDonations / donations.length : 0;

  // Deterministic rate from donation_attribution (includes refcode, click_id, fbclid, sms_last_touch)
  // Fall back to transaction-level fields if attribution view is empty
  const donationAttributions = attribution.filter((a: any) => a.transaction_type === 'donation');
  let deterministicCount: number;
  let deterministicRate: number;

  if (donationAttributions.length > 0) {
    // Use attribution_method from donation_attribution view
    deterministicCount = donationAttributions.filter((a: any) =>
      a.attribution_method && a.attribution_method !== 'unattributed'
    ).length;
    deterministicRate = donationAttributions.length > 0
      ? (deterministicCount / donationAttributions.length) * 100
      : 0;
    logger.debug('Attribution quality from donation_attribution view', {
      total: donationAttributions.length,
      attributed: deterministicCount,
      rate: deterministicRate.toFixed(1) + '%',
    });
  } else {
    // Fallback: check transaction-level fields including click_id/fbclid
    deterministicCount = donations.filter((d: any) =>
      d.refcode || d.source_campaign || d.click_id || d.fbclid
    ).length;
    deterministicRate = donations.length > 0
      ? (deterministicCount / donations.length) * 100
      : 0;
    logger.warn('Attribution fallback: donation_attribution view returned no data, using transaction fields', {
      donationCount: donations.length,
      attributed: deterministicCount,
    });
  }
  
  // Track if we're using fallback mode for attribution (helps UI show warning)
  const attributionFallbackMode = donationAttributions.length === 0 && donations.length > 0;

  // Calculate previous period KPIs (using the same methodology as current period)
  const prevGrossDonations = prevDonations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const prevRefundAmount = prevRefunds.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
  const prevTotalRaised = prevGrossDonations;
  const prevTotalNetRevenue = prevDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0) - prevRefundAmount;
  const prevRefundRate = prevGrossDonations > 0 ? (prevRefundAmount / prevGrossDonations) * 100 : 0;

  const prevRecurringDonations = prevDonations.filter((d: any) => d.is_recurring);
  const prevRecurringRaised = prevRecurringDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const prevRecurringChurnEvents = prevRefunds.filter((d: any) => d.is_recurring).length;
  const prevRecurringChurnRate = prevRecurringDonations.length > 0 ? (prevRecurringChurnEvents / prevRecurringDonations.length) * 100 : 0;

  const prevUniqueDonors = new Set(prevDonations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean)).size;
  const prevRecurringPercentage = prevDonations.length > 0 ? (prevRecurringDonations.length / prevDonations.length) * 100 : 0;

  const prevMetaSpend = prevMetaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const prevSMSCost = prevSmsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const prevTotalSpend = prevMetaSpend + prevSMSCost;
  // ROI = Net Revenue / Spend (investment multiplier)
  const prevRoi = prevTotalSpend > 0 ? prevTotalNetRevenue / prevTotalSpend : 0;

  // Previous period deterministic rate using same logic as current period
  const prevDonationAttributions = prevAttribution.filter((a: any) => a.transaction_type === 'donation');
  let prevDeterministicRate: number;

  if (prevDonationAttributions.length > 0) {
    // Use attribution_method from donation_attribution view (same as current period)
    const prevDeterministicCount = prevDonationAttributions.filter((a: any) =>
      a.attribution_method && a.attribution_method !== 'unattributed'
    ).length;
    prevDeterministicRate = prevDonationAttributions.length > 0
      ? (prevDeterministicCount / prevDonationAttributions.length) * 100
      : 0;
  } else {
    // Fallback: check transaction-level fields (only when attribution data is empty)
    const prevDeterministicCount = prevDonations.filter((d: any) =>
      d.refcode || d.source_campaign || d.click_id || d.fbclid
    ).length;
    prevDeterministicRate = prevDonations.length > 0
      ? (prevDeterministicCount / prevDonations.length) * 100
      : 0;
  }

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
  // Donations are filtered by campaign/creative; refunds include ALL (not filterable)
  const donationsByDay = bucketByDay(donations, (d: any) => d.transaction_date);
  const refundsByDay = bucketByDay(refunds, (d: any) => d.transaction_date);
  const metaByDay = bucketMetaByDay(metaMetrics);
  const smsByDay = bucketByDay(smsMetrics, (s: any) => s.send_date);
  const prevDonationsByDay = bucketByDay(prevDonations, (d: any) => d.transaction_date);
  const prevRefundsByDay = bucketByDay(prevRefunds, (d: any) => d.transaction_date);
  const prevMetaByDay = bucketMetaByDay(prevMetaMetrics);
  const prevSmsByDay = bucketByDay(prevSmsMetrics, (s: any) => s.send_date);

  const timeSeries: DashboardTimeSeriesPoint[] = days.map((day, index) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLabel = format(day, 'MMM d');
    const prevDay = prevDays[index];
    const prevDayStr = prevDay ? format(prevDay, 'yyyy-MM-dd') : null;

    // O(1) lookups using pre-bucketed data
    const dayDonationsOnly = donationsByDay.get(dayStr) ?? [];
    const dayRefundsOnly = refundsByDay.get(dayStr) ?? [];
    const dayMeta = metaByDay.get(dayStr) ?? [];
    const daySms = smsByDay.get(dayStr) ?? [];

    const prevDayDonationsOnly = prevDayStr ? (prevDonationsByDay.get(prevDayStr) ?? []) : [];
    const prevDayRefundsOnly = prevDayStr ? (prevRefundsByDay.get(prevDayStr) ?? []) : [];
    const prevDayMeta = prevDayStr ? (prevMetaByDay.get(prevDayStr) ?? []) : [];
    const prevDaySms = prevDayStr ? (prevSmsByDay.get(prevDayStr) ?? []) : [];

    // Gross donations (donations only, not refunds)
    const grossDonationsDay = dayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const donationNetDay = dayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    // Refunds use net_amount when available, with Math.abs for consistent positive value
    const refundAmountDay = dayRefundsOnly.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
    // Net donations = donation net minus refund net (refund-adjusted for charts)
    const netDonationsDay = donationNetDay - refundAmountDay;

    const prevGross = prevDayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const prevDonationNet = prevDayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const prevRefundAmountDay = prevDayRefundsOnly.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
    // Previous period net donations also refund-adjusted
    const prevNetDonationsDay = prevDonationNet - prevRefundAmountDay;

    return {
      name: dayLabel,
      donations: grossDonationsDay,
      netDonations: netDonationsDay, // Refund-adjusted: donation net - refund net
      refunds: -refundAmountDay, // Negative for chart display
      metaSpend: dayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpend: daySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
      donationsPrev: prevGross,
      netDonationsPrev: prevNetDonationsDay, // Refund-adjusted for previous period
      refundsPrev: -prevRefundAmountDay,
      metaSpendPrev: prevDayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpendPrev: prevDaySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
    };
  });

  // Channel breakdown using donation counts from donation_attribution (not platform conversions)
  // This gives accurate attribution based on actual donor behavior, not platform-reported conversions
  let metaDonations = 0;
  let smsDonations = 0;
  let unattributedDonations = 0;

  if (donationAttributions.length > 0) {
    // Use donation_attribution view for accurate channel counts
    metaDonations = donationAttributions.filter((a: any) => a.attributed_platform === 'meta').length;
    smsDonations = donationAttributions.filter((a: any) => a.attributed_platform === 'sms').length;
    unattributedDonations = donationAttributions.filter((a: any) =>
      !a.attributed_platform || a.attribution_method === 'unattributed'
    ).length;

    // Log channel breakdown for observability
    logger.debug('Channel breakdown from donation_attribution', {
      meta: metaDonations,
      sms: smsDonations,
      unattributed: unattributedDonations,
      total: donationAttributions.length,
    });

    // Warn if SMS attribution is lower than expected (might indicate phone_hash issues)
    if (smsDonations === 0 && smsMetrics.length > 0) {
      logger.warn('SMS campaigns found but no SMS-attributed donations - check phone_hash population');
    }
  } else {
    // Fallback: use transaction-level fields
    metaDonations = donations.filter((d: any) =>
      d.click_id || d.fbclid || (d.source_campaign && d.source_campaign.toLowerCase().includes('meta'))
    ).length;
    // SMS attribution requires phone_hash matching, which we can't do client-side without the join
    // So fallback shows all non-meta attributed as "Direct/Unattributed"
    smsDonations = 0;
    unattributedDonations = donations.filter((d: any) =>
      !d.refcode && !d.source_campaign && !d.click_id && !d.fbclid
    ).length;

    logger.warn('Channel breakdown fallback: using transaction-level fields (SMS attribution unavailable)');
  }

  // Anything not in meta/sms/unattributed is "Other" (refcode without platform mapping, etc.)
  const otherAttributed = donations.length - metaDonations - smsDonations - unattributedDonations;

  const totalDonationsCount = donations.length || 1;
  const pct = (val: number) => Math.round((val / totalDonationsCount) * 100);

  // Build channel breakdown with "Unattributed" always visible
  const channelBreakdown: ChannelBreakdown[] = [
    { name: `Meta Ads (${pct(metaDonations)}%)`, value: metaDonations, label: `${metaDonations}` },
    { name: `SMS (${pct(smsDonations)}%)`, value: smsDonations, label: `${smsDonations}` },
  ];

  // Add "Other Attributed" if there are any
  if (otherAttributed > 0) {
    channelBreakdown.push({
      name: `Other (${pct(otherAttributed)}%)`,
      value: otherAttributed,
      label: `${otherAttributed}`,
    });
  }

  // Always show Unattributed bucket (even if 0) for transparency
  channelBreakdown.push({
    name: `Unattributed (${pct(unattributedDonations)}%)`,
    value: unattributedDonations,
    label: `${unattributedDonations}`,
  });

  // Store raw counts for return value
  const metaConversions = metaDonations;
  const smsConversions = smsDonations;
  const directDonationCount = unattributedDonations;

  // Build sparkline data from time series with calendar dates
  const sparklines: SparklineData = {
    netRevenue: timeSeries.map((d, i) => ({
      date: format(days[i], 'MMM d'),
      value: d.netDonations,
    })),
    roi: timeSeries.map((d, i) => {
      const daySpend = d.metaSpend + d.smsSpend;
      // ROI = Net Revenue / Spend (investment multiplier)
      return {
        date: format(days[i], 'MMM d'),
        value: daySpend > 0 ? d.netDonations / daySpend : 0,
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
      // O(1) bucket lookup - include all deterministic signals
      const dayStr = format(days[i], 'yyyy-MM-dd');
      const dayDonationsOnly = donationsByDay.get(dayStr) ?? [];
      const attributed = dayDonationsOnly.filter((don: any) =>
        don.refcode || don.source_campaign || don.click_id || don.fbclid
      ).length;
      return {
        date: format(days[i], 'MMM d'),
        value: dayDonationsOnly.length > 0 ? (attributed / dayDonationsOnly.length) * 100 : 0,
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
    // Attribution data quality flags
    attributionFallbackMode,
  };
}

export function useClientDashboardMetricsQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();
  const selectedCampaignId = useSelectedCampaignId();
  const selectedCreativeId = useSelectedCreativeId();

  return useQuery({
    queryKey: ['dashboard', 'metrics', organizationId, dateRange, selectedCampaignId, selectedCreativeId],
    queryFn: () => fetchDashboardMetrics(
      organizationId!,
      dateRange.startDate,
      dateRange.endDate,
      selectedCampaignId,
      selectedCreativeId
    ),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
