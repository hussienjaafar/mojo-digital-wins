import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, subDays, eachDayOfInterval, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { logger } from "@/lib/logger";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/metricDefinitions";
import type { DailyRollupRow, PeriodSummary } from "./useActBlueDailyRollupQuery";
import { detectChannelWithConfidence, type AttributionChannel } from "@/utils/channelDetection";

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
  /** Blended ROI using total net revenue (for reference) */
  blendedRoi: number;
  /** Revenue attributed to Meta ads via refcode matching */
  metaAttributedRevenue: number;
  /** Revenue attributed to SMS via refcode matching */
  smsAttributedRevenue: number;
  /** Total attributed revenue (Meta + SMS) */
  totalAttributedRevenue: number;
  /** Percentage of net revenue that is attributed to paid channels */
  attributionRate: number;
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
  newMrr: SparklineDataPoint[];
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
// IMPORTANT: All bucketing uses org timezone to match SQL day boundaries
// ============================================================================

/**
 * Extract yyyy-MM-dd from an ISO timestamp in the specified timezone.
 * This ensures client-side bucketing matches server-side (SQL) day boundaries.
 *
 * Example: "2025-01-15T00:30:00.000Z" in America/New_York:
 * - UTC: 2025-01-15 00:30
 * - ET (EST): 2025-01-14 19:30 → buckets to "2025-01-14"
 *
 * @param dateStr ISO timestamp string (e.g., "2024-01-15T12:30:00.000Z")
 * @param timezone IANA timezone (e.g., "America/New_York")
 * @returns yyyy-MM-dd string in the specified timezone, or null if invalid
 */
function extractDayKeyInTimezone(
  dateStr: string | null | undefined,
  timezone: string
): string | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return null;
    return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

/**
 * Bucket an array of items by day key for O(1) lookups.
 * Uses org timezone to ensure consistency with SQL day bucketing.
 *
 * @param items Array of items to bucket
 * @param getDateStr Function to extract date string from each item
 * @param timezone IANA timezone for day bucketing (default: America/New_York)
 * @returns Map from yyyy-MM-dd key to array of items for that day
 */
function bucketByDay<T>(
  items: T[],
  getDateStr: (item: T) => string | null | undefined,
  timezone: string = DEFAULT_ORG_TIMEZONE
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const dayKey = extractDayKeyInTimezone(getDateStr(item), timezone);
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

// ============================================================================
// Canonical ActBlue Rollup Functions (timezone-aware, single source of truth)
// ============================================================================

/**
 * Fetch daily ActBlue rollup from the canonical RPC.
 * This uses org timezone for day bucketing - the SINGLE SOURCE OF TRUTH.
 */
async function fetchCanonicalDailyRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DailyRollupRow[]> {
  const { data, error } = await (supabase as any).rpc('get_actblue_daily_rollup', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    logger.error('Failed to fetch canonical ActBlue daily rollup', { error, organizationId });
    throw new Error(`Failed to fetch daily rollup: ${error.message}`);
  }

  // Map RPC field names to frontend interface names
  // RPC returns: gross_raised, net_raised, transaction_count, recurring_count, recurring_amount, refund_count, refund_amount, unique_donors
  return (data || []).map((row: any) => {
    const grossDonations = Number(row.gross_raised) || 0;
    const netDonations = Number(row.net_raised) || 0;
    const donationCount = Number(row.transaction_count) || 0;
    const recurringCount = Number(row.recurring_count) || 0;
    const recurringRevenue = Number(row.recurring_amount) || 0;
    const refundCount = Number(row.refund_count) || 0;
    const refundAmount = Number(row.refund_amount) || 0;
    const totalFees = grossDonations - netDonations; // Fees = gross - net

    return {
      day: row.day,
      gross_raised: grossDonations,
      net_raised: netDonations,
      refunds: refundAmount,
      net_revenue: netDonations - refundAmount,
      total_fees: totalFees,
      donation_count: donationCount,
      unique_donors: Number(row.unique_donors) || 0,
      refund_count: refundCount,
      recurring_count: recurringCount,
      one_time_count: donationCount - recurringCount,
      recurring_revenue: recurringRevenue,
      one_time_revenue: netDonations - recurringRevenue,
      fee_percentage: grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0,
      refund_rate: donationCount > 0 ? (refundCount / donationCount) * 100 : 0,
    };
  });
}

/**
 * Fetch ActBlue period summary from the canonical RPC.
 * This uses org timezone for day bucketing - the SINGLE SOURCE OF TRUTH.
 */
async function fetchCanonicalPeriodSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const { data, error } = await (supabase as any).rpc('get_actblue_period_summary', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    logger.error('Failed to fetch canonical ActBlue period summary', { error, organizationId });
    throw new Error(`Failed to fetch period summary: ${error.message}`);
  }

  // Map RPC field names to frontend interface names
  // RPC returns: gross_raised, net_raised, transaction_count, recurring_count, recurring_amount, refund_count, refund_amount, unique_donors, avg_donation
  const row = data?.[0] || {};
  const grossDonations = Number(row.gross_raised) || 0;
  const netDonations = Number(row.net_raised) || 0;
  const donationCount = Number(row.transaction_count) || 0;
  const recurringCount = Number(row.recurring_count) || 0;
  const recurringRevenue = Number(row.recurring_amount) || 0;
  const refundCount = Number(row.refund_count) || 0;
  const refundAmount = Number(row.refund_amount) || 0;
  const totalFees = grossDonations - netDonations; // Fees = gross - net

  return {
    gross_raised: grossDonations,
    net_raised: netDonations,
    refunds: refundAmount,
    net_revenue: netDonations - refundAmount,
    total_fees: totalFees,
    donation_count: donationCount,
    unique_donors_approx: Number(row.unique_donors) || 0,
    refund_count: refundCount,
    recurring_count: recurringCount,
    one_time_count: donationCount - recurringCount,
    recurring_revenue: recurringRevenue,
    one_time_revenue: netDonations - recurringRevenue,
    avg_fee_percentage: grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0,
    refund_rate: donationCount > 0 ? (refundCount / donationCount) * 100 : 0,
    avg_donation: Number(row.avg_donation) || 0,
    days_with_donations: 0, // Not provided by RPC, compute separately if needed
  };
}

/**
 * Fetch timezone-aware attributed revenue using server-side RPC.
 * This ensures date comparisons use the org's timezone, matching ActBlue reports.
 */
async function fetchAttributedRevenueTz(
  organizationId: string,
  startDate: string,
  endDate: string,
  timezone: string = DEFAULT_ORG_TIMEZONE
): Promise<{ meta: number; sms: number; metaCount: number; smsCount: number; unattributedCount: number }> {
  const { data, error } = await (supabase as any).rpc('get_attributed_revenue_tz', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_timezone: timezone,
  });

  if (error) {
    logger.warn('Failed to fetch attributed revenue with timezone, falling back to client-side', { error });
    return { meta: 0, sms: 0, metaCount: 0, smsCount: 0, unattributedCount: 0 };
  }

  const rows = data || [];
  const metaRow = rows.find((r: any) => r.channel === 'meta');
  const smsRow = rows.find((r: any) => r.channel === 'sms');
  const unattributedRow = rows.find((r: any) => r.channel === 'unattributed');

  return {
    meta: Number(metaRow?.net_raised) || 0,
    sms: Number(smsRow?.net_raised) || 0,
    metaCount: Number(metaRow?.donation_count) || 0,
    smsCount: Number(smsRow?.donation_count) || 0,
    unattributedCount: Number(unattributedRow?.donation_count) || 0,
  };
}

/**
 * Fetch filtered ActBlue rollup using server-side RPC.
 * This is used when campaign/creative filters are active for better performance.
 */
async function fetchFilteredActBlueRollup(
  organizationId: string,
  startDate: string,
  endDate: string,
  campaignId: string | null,
  creativeId: string | null,
  timezone: string = DEFAULT_ORG_TIMEZONE
): Promise<{ daily: DailyRollupRow[]; summary: PeriodSummary }> {
  const { data, error } = await (supabase as any).rpc('get_actblue_filtered_rollup', {
    p_org_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_campaign_id: campaignId || null,
    p_creative_id: creativeId || null,
    p_timezone: timezone,
  });

  if (error) {
    logger.error('Failed to fetch filtered ActBlue rollup', { error, organizationId });
    throw new Error(`Failed to fetch filtered rollup: ${error.message}`);
  }

  const daily: DailyRollupRow[] = (data || []).map((row: any) => ({
    day: row.day,
    gross_raised: Number(row.gross_raised) || 0,
    net_raised: Number(row.net_raised) || 0,
    // net_revenue = net_raised - refund_amount (RPC returns them separately)
    refunds: Number(row.refund_amount) || 0,
    net_revenue: (Number(row.net_raised) || 0) - (Number(row.refund_amount) || 0),
    total_fees: 0, // Not returned by filtered RPC, calculate from gross - net
    donation_count: Number(row.transaction_count) || 0,
    unique_donors: Number(row.unique_donors) || 0,
    refund_count: Number(row.refund_count) || 0,
    recurring_count: Number(row.recurring_count) || 0,
    one_time_count: (Number(row.transaction_count) || 0) - (Number(row.recurring_count) || 0),
    recurring_revenue: Number(row.recurring_amount) || 0,
    one_time_revenue: (Number(row.gross_raised) || 0) - (Number(row.recurring_amount) || 0),
    fee_percentage: 0, // Calculated in summary
    refund_rate: 0, // Calculated in summary
  }));

  // Aggregate to summary
  const grossRaised = daily.reduce((sum, d) => sum + d.gross_raised, 0);
  const netRaised = daily.reduce((sum, d) => sum + d.net_raised, 0);
  const refunds = daily.reduce((sum, d) => sum + d.refunds, 0);
  const donationCount = daily.reduce((sum, d) => sum + d.donation_count, 0);
  const uniqueDonors = daily.reduce((sum, d) => sum + d.unique_donors, 0);
  const refundCount = daily.reduce((sum, d) => sum + d.refund_count, 0);
  const recurringCount = daily.reduce((sum, d) => sum + d.recurring_count, 0);
  const recurringRevenue = daily.reduce((sum, d) => sum + d.recurring_revenue, 0);
  const totalFees = grossRaised - netRaised; // Estimate fees from gross - net
  const netRevenue = netRaised - refunds;

  const summary: PeriodSummary = {
    gross_raised: grossRaised,
    net_raised: netRaised,
    refunds,
    net_revenue: netRevenue,
    total_fees: totalFees,
    donation_count: donationCount,
    unique_donors_approx: uniqueDonors,
    refund_count: refundCount,
    recurring_count: recurringCount,
    one_time_count: donationCount - recurringCount,
    recurring_revenue: recurringRevenue,
    one_time_revenue: grossRaised - recurringRevenue,
    avg_fee_percentage: grossRaised > 0 ? (totalFees / grossRaised) * 100 : 0,
    refund_rate: grossRaised > 0 ? (refunds / grossRaised) * 100 : 0,
    avg_donation: donationCount > 0 ? grossRaised / donationCount : 0,
    days_with_donations: daily.filter(d => d.donation_count > 0).length,
  };

  return { daily, summary };
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
    // donation_attribution now includes attributed_platform and contribution_form for SMS detection
    let query = (supabase as any)
      .from('donation_attribution')
      .select('transaction_id, attribution_method, attributed_campaign_id, attributed_creative_id, attributed_ad_id, attributed_platform, contribution_form, refcode, transaction_type, amount, net_amount, transaction_date')
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

  // Phase 2: Fetch all data
  // - When no filters: use canonical rollup for ActBlue metrics (timezone-aware)
  // - When filters: use get_actblue_filtered_rollup RPC for server-side filtering
  // - Raw transactions still needed for: attribution analysis, donor tracking, upsell metrics
  
  // Helper to fetch true unique donors using the new RPC
  const fetchTrueUniqueDonors = async (start: string, end: string) => {
    const { data, error } = await (supabase as any).rpc('get_actblue_true_unique_donors', {
      p_organization_id: organizationId,
      p_start_date: start,
      p_end_date: end,
      p_timezone: 'America/New_York',
    });
    if (error) {
      logger.warn('Failed to fetch true unique donors, falling back to client-side', { error });
      return null;
    }
    const row = data?.[0] || {};
    return {
      uniqueDonors: Number(row.unique_donors) || 0,
      newDonors: Number(row.new_donors) || 0,
      returningDonors: Number(row.returning_donors) || 0,
    };
  };

  const [
    { data: donationData },
    { data: prevDonationData },
    { data: attributionData },
    { data: prevAttributionData },
    { data: metaData },
    { data: prevMetaData },
    { data: smsData },
    { data: prevSmsData },
    canonicalDailyRollup,
    canonicalPeriodSummary,
    prevCanonicalSummary,
    filteredRollup,
    prevFilteredRollup,
    trueUniqueDonorsData,
    prevTrueUniqueDonorsData,
    attributedRevenueTz,
    prevAttributedRevenueTz,
  ] = await Promise.all([
    // Current period donations - fetch all, filter client-side if needed
    // Still needed for: attribution, donors, upsell tracking
    (supabase as any)
      .from('actblue_transactions_secure')
      // NOTE: actblue_transactions_secure intentionally excludes certain PII/derived fields.
      // Do NOT select non-existent columns (e.g. donor_id_hash) or the whole query will fail.
      // IMPORTANT: contribution_form is required for SMS attribution fallback (e.g., moliticosms)
      .select('id, amount, net_amount, fee, donor_email, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign, click_id, fbclid, contribution_form')
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lt('transaction_date', endDateInclusive),
    // Previous period donations
    (supabase as any)
      .from('actblue_transactions_secure')
      // IMPORTANT: contribution_form is required for SMS attribution fallback (e.g., moliticosms)
      .select('id, amount, net_amount, fee, donor_email, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign, click_id, fbclid, contribution_form')
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
    // Canonical ActBlue daily rollup - timezone-aware, SINGLE SOURCE OF TRUTH
    fetchCanonicalDailyRollup(organizationId, startDate, endDate),
    // Canonical ActBlue period summary
    fetchCanonicalPeriodSummary(organizationId, startDate, endDate),
    // Previous period canonical summary
    fetchCanonicalPeriodSummary(organizationId, prevPeriod.start, prevPeriod.end),
    // Filtered rollup using server-side RPC (only used when campaign/creative filters are active)
    hasFilters
      ? fetchFilteredActBlueRollup(organizationId, startDate, endDate, campaignId, creativeId)
      : Promise.resolve(null),
    // Previous period filtered rollup
    hasFilters
      ? fetchFilteredActBlueRollup(organizationId, prevPeriod.start, prevPeriod.end, campaignId, creativeId)
      : Promise.resolve(null),
    // True unique donors - uses COUNT(DISTINCT donor_email) for accurate multi-day counts
    !hasFilters ? fetchTrueUniqueDonors(startDate, endDate) : Promise.resolve(null),
    // Previous period true unique donors
    !hasFilters ? fetchTrueUniqueDonors(prevPeriod.start, prevPeriod.end) : Promise.resolve(null),
    // Timezone-aware attributed revenue - CRITICAL for accurate Meta/SMS revenue attribution
    fetchAttributedRevenueTz(organizationId, startDate, endDate),
    // Previous period attributed revenue
    fetchAttributedRevenueTz(organizationId, prevPeriod.start, prevPeriod.end),
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

  // ============================================================================
  // ActBlue KPIs: Use CANONICAL ROLLUP when no filters, FILTERED ROLLUP RPC when filtered
  // This ensures timezone-aware day bucketing matches SQL exactly
  // ============================================================================
  let totalRaised: number;
  let totalNetRevenue: number;
  let refundAmount: number;
  let totalFees: number;
  let feePercentage: number;
  let refundRate: number;

  if (!hasFilters) {
    // Use canonical rollup for ActBlue metrics - SINGLE SOURCE OF TRUTH
    totalRaised = canonicalPeriodSummary.gross_raised;
    totalNetRevenue = canonicalPeriodSummary.net_revenue;
    refundAmount = canonicalPeriodSummary.refunds;
    totalFees = canonicalPeriodSummary.total_fees;
    feePercentage = canonicalPeriodSummary.avg_fee_percentage;
    refundRate = canonicalPeriodSummary.refund_rate;

    logger.debug('Using canonical rollup for ActBlue KPIs', {
      gross: totalRaised,
      net: totalNetRevenue,
      refunds: refundAmount,
      fees: totalFees,
    });
  } else if (filteredRollup) {
    // With filters, use server-side filtered rollup RPC for accurate ActBlue metrics
    totalRaised = filteredRollup.summary.gross_raised;
    totalNetRevenue = filteredRollup.summary.net_revenue;
    refundAmount = filteredRollup.summary.refunds;
    totalFees = filteredRollup.summary.total_fees;
    feePercentage = filteredRollup.summary.avg_fee_percentage;
    refundRate = filteredRollup.summary.refund_rate;

    logger.debug('Using filtered rollup RPC for ActBlue KPIs (campaign/creative filter active)', {
      gross: totalRaised,
      net: totalNetRevenue,
      refunds: refundAmount,
      dailyRows: filteredRollup.daily.length,
    });
  } else {
    // Fallback to client-side calculation if filtered rollup failed
    const grossDonations = donations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    refundAmount = refunds.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
    totalRaised = grossDonations;
    totalNetRevenue = donations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0) - refundAmount;
    totalFees = donations.reduce((sum: number, d: any) => sum + Number(d.fee || 0), 0);
    feePercentage = grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0;
    refundRate = grossDonations > 0 ? (refundAmount / grossDonations) * 100 : 0;

    logger.warn('Filtered rollup RPC returned null, falling back to client-side calculation', {
      gross: totalRaised,
      filtered: donations.length,
    });
  }

  // Recurring donations (only actual donations, not refunds)
  const recurringDonations = donations.filter((d: any) => d.is_recurring);
  const recurringRaised = recurringDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);

  // Recurring churn: cancellations and refunds of recurring subscriptions
  const recurringCancellations = refunds.filter((d: any) => d.is_recurring && d.transaction_type === 'cancellation').length;
  const recurringRefundsCount = refunds.filter((d: any) => d.is_recurring && d.transaction_type === 'refund').length;
  const recurringChurnEvents = recurringCancellations + recurringRefundsCount;
  const activeRecurringCount = recurringDonations.length;
  const recurringChurnRate = activeRecurringCount > 0 ? (recurringChurnEvents / activeRecurringCount) * 100 : 0;

  // Unique donors: Use TRUE unique donors from RPC when available (accurate across multi-day ranges)
  // Falls back to client-side Set when filters are active (filtered rollup doesn't have unique donors RPC)
  let uniqueDonors: number;
  let newDonors: number;
  let returningDonors: number;

  if (trueUniqueDonorsData && !hasFilters) {
    // Use RPC for accurate COUNT(DISTINCT donor_email) across the full date range
    uniqueDonors = trueUniqueDonorsData.uniqueDonors;
    newDonors = trueUniqueDonorsData.newDonors;
    returningDonors = trueUniqueDonorsData.returningDonors;
    logger.debug('Using true unique donors from RPC', { uniqueDonors, newDonors, returningDonors });
  } else {
    // Fallback: client-side de-duplication (may be inaccurate for multi-day ranges if paginated)
    uniqueDonors = new Set(donations.map((d: any) => d.donor_email).filter(Boolean)).size;
    const currentDonorSet = new Set(donations.map((d: any) => d.donor_email).filter(Boolean));
    const prevDonorSet = new Set(prevDonations.map((d: any) => d.donor_email).filter(Boolean));
    
    newDonors = 0;
    returningDonors = 0;
    currentDonorSet.forEach((d) => {
      if (prevDonorSet.has(d)) returningDonors += 1;
      else newDonors += 1;
    });
    logger.debug('Using client-side unique donors (filters active or RPC failed)', { uniqueDonors, newDonors, returningDonors });
  }

  const recurringPercentage = donations.length > 0 ? (recurringDonations.length / donations.length) * 100 : 0;

  // Upsell metrics (from donations only)
  const upsellShown = donations.filter((d: any) => d.recurring_upsell_shown).length;
  const upsellSucceeded = donations.filter((d: any) => d.recurring_upsell_succeeded).length;
  const upsellConversionRate = upsellShown > 0 ? (upsellSucceeded / upsellShown) * 100 : 0;

  const totalMetaSpend = metaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const totalSMSCost = smsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const totalSpend = totalMetaSpend + totalSMSCost;
  // Note: ROI is now calculated later after channel attribution is computed

  const totalImpressions = metaMetrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0);
  const totalClicks = metaMetrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
  // Average donation: use canonical summary when no filters
  const avgDonation = !hasFilters
    ? canonicalPeriodSummary.avg_donation
    : (donations.length > 0 ? totalRaised / donations.length : 0);

  // Deterministic rate from donation_attribution (includes refcode, click_id, fbclid, sms_last_touch)
  // Fall back to transaction-level fields if attribution view is empty
  const donationAttributions = attribution.filter((a: any) => a.transaction_type === 'donation');
  
  // Helper to get attribution channel consistently - defined here so it can be reused for prev period
  const getAttributionChannel = (a: any): AttributionChannel => {
    // Prefer direct platform from view (computed server-side with latest logic)
    if (a.attributed_platform) {
      return a.attributed_platform as AttributionChannel;
    }
    
    // Fallback to client-side detection for records without attributed_platform
    const result = detectChannelWithConfidence({
      attribution_method: a.attribution_method,
      attributed_campaign_id: a.attributed_campaign_id,
      attributed_ad_id: a.attributed_ad_id,
      attributed_creative_id: a.attributed_creative_id,
      refcode: a.refcode,
      contribution_form: a.contribution_form,
    });
    return result.channel;
  };
  
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

  // ============================================================================
  // Previous Period ActBlue KPIs: Use CANONICAL ROLLUP when no filters, FILTERED ROLLUP when filtered
  // ============================================================================
  let prevTotalRaised: number;
  let prevTotalNetRevenue: number;
  let prevRefundAmount: number;
  let prevRefundRate: number;

  if (!hasFilters) {
    // Use canonical rollup for previous period - SINGLE SOURCE OF TRUTH
    prevTotalRaised = prevCanonicalSummary.gross_raised;
    prevTotalNetRevenue = prevCanonicalSummary.net_revenue;
    prevRefundAmount = prevCanonicalSummary.refunds;
    prevRefundRate = prevCanonicalSummary.refund_rate;
  } else if (prevFilteredRollup) {
    // With filters, use server-side filtered rollup RPC for previous period
    prevTotalRaised = prevFilteredRollup.summary.gross_raised;
    prevTotalNetRevenue = prevFilteredRollup.summary.net_revenue;
    prevRefundAmount = prevFilteredRollup.summary.refunds;
    prevRefundRate = prevFilteredRollup.summary.refund_rate;
  } else {
    // Fallback to client-side calculation if filtered rollup failed
    const prevGrossDonations = prevDonations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    prevRefundAmount = prevRefunds.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
    prevTotalRaised = prevGrossDonations;
    prevTotalNetRevenue = prevDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0) - prevRefundAmount;
    prevRefundRate = prevGrossDonations > 0 ? (prevRefundAmount / prevGrossDonations) * 100 : 0;
  }

  const prevRecurringDonations = prevDonations.filter((d: any) => d.is_recurring);
  const prevRecurringRaised = prevRecurringDonations.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
  const prevRecurringChurnEvents = prevRefunds.filter((d: any) => d.is_recurring).length;
  const prevRecurringChurnRate = prevRecurringDonations.length > 0 ? (prevRecurringChurnEvents / prevRecurringDonations.length) * 100 : 0;

  // Previous period unique donors: Use TRUE unique donors from RPC when available
  const prevUniqueDonors = prevTrueUniqueDonorsData && !hasFilters
    ? prevTrueUniqueDonorsData.uniqueDonors
    : new Set(prevDonations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean)).size;
  const prevRecurringPercentage = prevDonations.length > 0 ? (prevRecurringDonations.length / prevDonations.length) * 100 : 0;

  const prevMetaSpend = prevMetaMetrics.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);
  const prevSMSCost = prevSmsMetrics.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0);
  const prevTotalSpend = prevMetaSpend + prevSMSCost;

  // Previous period deterministic rate using same logic as current period
  const prevDonationAttributions = prevAttribution.filter((a: any) => a.transaction_type === 'donation');
  let prevDeterministicRate: number;
  let prevMetaAttributedRevenue = 0;
  let prevSmsAttributedRevenue = 0;

  if (prevDonationAttributions.length > 0) {
    // Use attribution_method from donation_attribution view (same as current period)
    const prevDeterministicCount = prevDonationAttributions.filter((a: any) =>
      a.attribution_method && a.attribution_method !== 'unattributed'
    ).length;
    prevDeterministicRate = prevDonationAttributions.length > 0
      ? (prevDeterministicCount / prevDonationAttributions.length) * 100
      : 0;
    
    // Calculate previous period attributed revenue by channel
    for (const a of prevDonationAttributions) {
      const channel = getAttributionChannel(a);
      const revenueValue = Number(a.net_amount ?? a.amount ?? 0);
      
      if (channel === 'meta') {
        prevMetaAttributedRevenue += revenueValue;
      } else if (channel === 'sms') {
        prevSmsAttributedRevenue += revenueValue;
      }
    }
  } else {
    // Fallback: check transaction-level fields (only when attribution data is empty)
    const prevDeterministicCount = prevDonations.filter((d: any) =>
      d.refcode || d.source_campaign || d.click_id || d.fbclid
    ).length;
    prevDeterministicRate = prevDonations.length > 0
      ? (prevDeterministicCount / prevDonations.length) * 100
      : 0;
    
    // Calculate previous period attributed revenue using fallback detection
    const getTransactionChannel = (d: any): AttributionChannel => {
      const result = detectChannelWithConfidence({
        refcode: d.refcode,
        source_campaign: d.source_campaign,
        click_id: d.click_id,
        fbclid: d.fbclid,
        contribution_form: d.contribution_form,
      });
      return result.channel;
    };
    
    for (const d of prevDonations) {
      const channel = getTransactionChannel(d);
      const revenueValue = Number(d.net_amount ?? d.amount ?? 0);
      
      if (channel === 'meta') {
        prevMetaAttributedRevenue += revenueValue;
      } else if (channel === 'sms') {
        prevSmsAttributedRevenue += revenueValue;
      }
    }
  }
  
  // Previous period ROI = Attributed Revenue / Spend
  const prevTotalAttributedRevenue = prevMetaAttributedRevenue + prevSmsAttributedRevenue;
  const prevRoi = prevTotalSpend > 0 ? prevTotalAttributedRevenue / prevTotalSpend : 0;

  // ============================================================================
  // Build time series data
  // When no filters: Use CANONICAL DAILY ROLLUP for ActBlue metrics (timezone-aware)
  // When filters: Use client-side bucketing of filtered transactions
  // ============================================================================
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
  const prevDays = eachDayOfInterval({
    start: parseISO(prevPeriod.start),
    end: parseISO(prevPeriod.end),
  });

  // Pre-bucket Meta/SMS by day (these don't have timezone issues - already in yyyy-MM-dd)
  const metaByDay = bucketMetaByDay(metaMetrics);
  const smsByDay = bucketByDay(smsMetrics, (s: any) => s.send_date);
  const prevMetaByDay = bucketMetaByDay(prevMetaMetrics);
  const prevSmsByDay = bucketByDay(prevSmsMetrics, (s: any) => s.send_date);

  // For filtered case, still need transaction bucketing (used for attribution sparklines too)
  const donationsByDay = bucketByDay(donations, (d: any) => d.transaction_date);
  const refundsByDay = bucketByDay(refunds, (d: any) => d.transaction_date);
  const prevDonationsByDay = bucketByDay(prevDonations, (d: any) => d.transaction_date);
  const prevRefundsByDay = bucketByDay(prevRefunds, (d: any) => d.transaction_date);

  // Index canonical rollup by day for O(1) lookups
  const canonicalByDay = new Map<string, DailyRollupRow>();
  for (const row of canonicalDailyRollup) {
    canonicalByDay.set(row.day, row);
  }

  // Index filtered rollup by day for O(1) lookups (when filters are active)
  const filteredByDay = new Map<string, DailyRollupRow>();
  if (filteredRollup) {
    for (const row of filteredRollup.daily) {
      filteredByDay.set(row.day, row);
    }
  }
  const prevFilteredByDay = new Map<string, DailyRollupRow>();
  if (prevFilteredRollup) {
    for (const row of prevFilteredRollup.daily) {
      prevFilteredByDay.set(row.day, row);
    }
  }

  const timeSeries: DashboardTimeSeriesPoint[] = days.map((day, index) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLabel = format(day, 'MMM d');
    const prevDay = prevDays[index];
    const prevDayStr = prevDay ? format(prevDay, 'yyyy-MM-dd') : null;

    // Meta/SMS lookups (not affected by timezone issues)
    const dayMeta = metaByDay.get(dayStr) ?? [];
    const daySms = smsByDay.get(dayStr) ?? [];
    const prevDayMeta = prevDayStr ? (prevMetaByDay.get(prevDayStr) ?? []) : [];
    const prevDaySms = prevDayStr ? (prevSmsByDay.get(prevDayStr) ?? []) : [];

    // ActBlue metrics: Use canonical rollup when no filters, filtered rollup when filtered
    let grossDonationsDay: number;
    let netDonationsDay: number;
    let refundAmountDay: number;

    if (!hasFilters) {
      // Use canonical rollup - SINGLE SOURCE OF TRUTH (timezone-aware)
      const canonicalDay = canonicalByDay.get(dayStr);
      grossDonationsDay = canonicalDay?.gross_raised ?? 0;
      // netDonations = net_revenue (already refund-adjusted in canonical)
      netDonationsDay = canonicalDay?.net_revenue ?? 0;
      refundAmountDay = canonicalDay?.refunds ?? 0;
    } else if (filteredRollup) {
      // With filters, use server-side filtered rollup RPC
      const filteredDay = filteredByDay.get(dayStr);
      grossDonationsDay = filteredDay?.gross_raised ?? 0;
      netDonationsDay = filteredDay?.net_revenue ?? 0;
      refundAmountDay = filteredDay?.refunds ?? 0;
    } else {
      // Fallback: client-side bucketing
      const dayDonationsOnly = donationsByDay.get(dayStr) ?? [];
      const dayRefundsOnly = refundsByDay.get(dayStr) ?? [];
      grossDonationsDay = dayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      const donationNetDay = dayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
      refundAmountDay = dayRefundsOnly.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
      netDonationsDay = donationNetDay - refundAmountDay;
    }

    // Previous period: use filtered rollup when available, otherwise client-side bucketing
    let prevGross: number;
    let prevNetDonationsDay: number;
    let prevRefundAmountDay: number;

    if (prevFilteredRollup && prevDayStr) {
      const prevFilteredDay = prevFilteredByDay.get(prevDayStr);
      prevGross = prevFilteredDay?.gross_raised ?? 0;
      prevNetDonationsDay = prevFilteredDay?.net_revenue ?? 0;
      prevRefundAmountDay = prevFilteredDay?.refunds ?? 0;
    } else {
      const prevDayDonationsOnly = prevDayStr ? (prevDonationsByDay.get(prevDayStr) ?? []) : [];
      const prevDayRefundsOnly = prevDayStr ? (prevRefundsByDay.get(prevDayStr) ?? []) : [];
      prevGross = prevDayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      const prevDonationNet = prevDayDonationsOnly.reduce((sum: number, d: any) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
      prevRefundAmountDay = prevDayRefundsOnly.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
      prevNetDonationsDay = prevDonationNet - prevRefundAmountDay;
    }

    return {
      name: dayLabel,
      donations: grossDonationsDay,
      netDonations: netDonationsDay,
      refunds: -refundAmountDay, // Negative for chart display
      metaSpend: dayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpend: daySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
      donationsPrev: prevGross,
      netDonationsPrev: prevNetDonationsDay,
      refundsPrev: -prevRefundAmountDay,
      metaSpendPrev: prevDayMeta.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
      smsSpendPrev: prevDaySms.reduce((sum: number, s: any) => sum + Number(s.cost || 0), 0),
    };
  });

  // Channel breakdown using TIMEZONE-AWARE RPC for attributed revenue (matches ActBlue reports)
  // The client-side calculation still runs for donation counts for the pie chart,
  // but revenue figures use the RPC which properly handles timezone conversion
  let metaDonations = 0;
  let smsDonations = 0;
  let unattributedDonations = 0;
  
  // USE THE TIMEZONE-AWARE RPC RESULTS FOR REVENUE (fixes $181 vs $131 discrepancy)
  // This ensures date boundaries match ActBlue's timezone (org_timezone, default Eastern)
  const metaAttributedRevenue = attributedRevenueTz?.meta || 0;
  const smsAttributedRevenue = attributedRevenueTz?.sms || 0;

  // Use RPC counts if available, otherwise fall back to client-side
  if (attributedRevenueTz && (attributedRevenueTz.metaCount > 0 || attributedRevenueTz.smsCount > 0 || attributedRevenueTz.unattributedCount > 0)) {
    metaDonations = attributedRevenueTz.metaCount;
    smsDonations = attributedRevenueTz.smsCount;
    unattributedDonations = attributedRevenueTz.unattributedCount;
    
    logger.debug('Channel breakdown from timezone-aware RPC', {
      meta: metaDonations,
      metaRevenue: metaAttributedRevenue,
      sms: smsDonations,
      smsRevenue: smsAttributedRevenue,
      unattributed: unattributedDonations,
    });
  } else if (donationAttributions.length > 0) {
    // Fallback to client-side attribution view (for counts only, revenue still from RPC)
    for (const a of donationAttributions) {
      const channel = getAttributionChannel(a);
      
      if (channel === 'meta') {
        metaDonations += 1;
      } else if (channel === 'sms') {
        smsDonations += 1;
      } else if (channel === 'unattributed' || a.attribution_method === 'unattributed') {
        unattributedDonations += 1;
      }
    }

    logger.debug('Channel breakdown from donation_attribution (counts only)', {
      meta: metaDonations,
      metaRevenue: metaAttributedRevenue,
      sms: smsDonations,
      smsRevenue: smsAttributedRevenue,
      unattributed: unattributedDonations,
      total: donationAttributions.length,
    });
  } else {
    // Last fallback: use unified channel detection on transaction-level fields
    const getTransactionChannel = (d: any): AttributionChannel => {
      const result = detectChannelWithConfidence({
        refcode: d.refcode,
        source_campaign: d.source_campaign,
        click_id: d.click_id,
        fbclid: d.fbclid,
        contribution_form: d.contribution_form,
      });
      return result.channel;
    };

    for (const d of donations) {
      const channel = getTransactionChannel(d);
      
      if (channel === 'meta') {
        metaDonations += 1;
      } else if (channel === 'sms') {
        smsDonations += 1;
      } else if (channel === 'unattributed') {
        unattributedDonations += 1;
      }
    }

    logger.warn('Channel breakdown fallback: using unified channel detection on transaction fields (counts only)');
  }

  // Calculate total attributed revenue and attribution rate
  const totalAttributedRevenue = metaAttributedRevenue + smsAttributedRevenue;
  const attributionRate = totalNetRevenue > 0 ? (totalAttributedRevenue / totalNetRevenue) * 100 : 0;

  // ROI = Attributed Revenue / Spend (only revenue from paid channels)
  const attributedRoi = totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0;
  // Keep blended ROI for reference (total net revenue / spend)
  const blendedRoi = totalSpend > 0 ? totalNetRevenue / totalSpend : 0;

  logger.debug('ROI calculation (attributed, timezone-aware)', {
    metaAttributedRevenue,
    smsAttributedRevenue,
    totalAttributedRevenue,
    totalSpend,
    attributedRoi: attributedRoi.toFixed(2) + 'x',
    blendedRoi: blendedRoi.toFixed(2) + 'x',
    attributionRate: attributionRate.toFixed(1) + '%',
  });

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
    newMrr: (() => {
      // Calculate daily new recurring MRR by finding first recurring transaction per donor
      const firstRecurringByDonor = new Map<string, { date: string; amount: number }>();
      for (const don of donations.filter((d: any) => d.is_recurring)) {
        const email = don.donor_id_hash || don.donor_email;
        if (!email) continue;
        const txnDate = don.transaction_date;
        const existing = firstRecurringByDonor.get(email);
        if (!existing || txnDate < existing.date) {
          firstRecurringByDonor.set(email, { date: txnDate, amount: Number(don.net_amount ?? don.amount ?? 0) });
        }
      }
      // Bucket by day within the selected period (using org timezone for consistency)
      return days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        let dayTotal = 0;
        for (const [, { date, amount }] of firstRecurringByDonor) {
          if (extractDayKeyInTimezone(date, DEFAULT_ORG_TIMEZONE) === dayStr) {
            dayTotal += amount;
          }
        }
        return { date: format(day, 'MMM d'), value: dayTotal };
      });
    })(),
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
      roi: attributedRoi,
      blendedRoi,
      metaAttributedRevenue,
      smsAttributedRevenue,
      totalAttributedRevenue,
      attributionRate,
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

  return useQuery({
    queryKey: ['dashboard', 'metrics', organizationId, dateRange],
    queryFn: () => fetchDashboardMetrics(
      organizationId!,
      dateRange.startDate,
      dateRange.endDate,
      null,
      null
    ),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
