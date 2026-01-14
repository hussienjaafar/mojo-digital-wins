import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { donationKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, eachDayOfInterval, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { logger } from "@/lib/logger";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/metricDefinitions";
import type { DailyRollupRow, PeriodSummary } from "./useActBlueDailyRollupQuery";

/**
 * Format a timestamp in org timezone for display purposes.
 * @param dateStr ISO timestamp string
 * @returns yyyy-MM-dd in org timezone
 */
function formatDateInOrgTimezone(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatInTimeZone(date, DEFAULT_ORG_TIMEZONE, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export interface DonationMetrics {
  totalRaised: number;
  netRaised: number;
  totalDonations: number;
  uniqueDonors: number;
  averageDonation: number;
  recurringCount: number;
  recurringRevenue: number;
  oneTimeCount: number;
  oneTimeRevenue: number;
  refundCount: number;
  refundAmount: number;
}

export interface DonationTimeSeries {
  date: string;
  donations: number;
  amount: number;
  donors: number;
}

export interface DonationBySource {
  source: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface TopDonor {
  id: string;
  name: string;
  email: string;
  state: string | null;
  totalAmount: number;
  donationCount: number;
  lastDonation: string;
}

/** Individual donation row for the Recent Donations table */
export interface DonationRow {
  id: string;                    // transaction_id for unique key
  donorName: string;             // donor_name or first_name + last_name
  email: string;                 // donor_email
  state: string | null;          // state
  city: string | null;           // city
  amount: number;                // gross amount
  netAmount: number;             // net amount (after fees)
  date: string;                  // transaction_date
  isRecurring: boolean;          // is_recurring
  refcode: string | null;        // refcode for attribution
}

interface DonationMetricsResult {
  metrics: DonationMetrics;
  timeSeries: DonationTimeSeries[];
  bySource: DonationBySource[];
  topDonors: TopDonor[];
  recentDonations: DonationRow[];
}

/**
 * Fetch canonical ActBlue daily rollup for timezone-aware metrics
 */
async function fetchCanonicalDailyRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DailyRollupRow[]> {
  const { data, error } = await (supabase as any).rpc('get_actblue_daily_rollup', {
    _organization_id: organizationId,
    _start_date: startDate,
    _end_date: endDate,
  });

  if (error) {
    logger.error('Failed to fetch canonical ActBlue daily rollup', { error, organizationId });
    throw new Error(`Failed to fetch daily rollup: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    day: row.day,
    gross_raised: Number(row.gross_raised) || 0,
    net_raised: Number(row.net_raised) || 0,
    refunds: Number(row.refunds) || 0,
    net_revenue: Number(row.net_revenue) || 0,
    total_fees: Number(row.total_fees) || 0,
    donation_count: Number(row.donation_count) || 0,
    unique_donors: Number(row.unique_donors) || 0,
    refund_count: Number(row.refund_count) || 0,
    recurring_count: Number(row.recurring_count) || 0,
    one_time_count: Number(row.one_time_count) || 0,
    recurring_revenue: Number(row.recurring_revenue) || 0,
    one_time_revenue: Number(row.one_time_revenue) || 0,
    fee_percentage: Number(row.fee_percentage) || 0,
    refund_rate: Number(row.refund_rate) || 0,
  }));
}

/**
 * Fetch canonical ActBlue period summary for timezone-aware metrics
 */
async function fetchCanonicalPeriodSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const { data, error } = await (supabase as any).rpc('get_actblue_period_summary', {
    _organization_id: organizationId,
    _start_date: startDate,
    _end_date: endDate,
  });

  if (error) {
    logger.error('Failed to fetch canonical ActBlue period summary', { error, organizationId });
    throw new Error(`Failed to fetch period summary: ${error.message}`);
  }

  const row = data?.[0] || {};
  return {
    gross_raised: Number(row.gross_raised) || 0,
    net_raised: Number(row.net_raised) || 0,
    refunds: Number(row.refunds) || 0,
    net_revenue: Number(row.net_revenue) || 0,
    total_fees: Number(row.total_fees) || 0,
    donation_count: Number(row.donation_count) || 0,
    unique_donors_approx: Number(row.unique_donors_approx) || 0,
    refund_count: Number(row.refund_count) || 0,
    recurring_count: Number(row.recurring_count) || 0,
    one_time_count: Number(row.one_time_count) || 0,
    recurring_revenue: Number(row.recurring_revenue) || 0,
    one_time_revenue: Number(row.one_time_revenue) || 0,
    avg_fee_percentage: Number(row.avg_fee_percentage) || 0,
    refund_rate: Number(row.refund_rate) || 0,
    avg_donation: Number(row.avg_donation) || 0,
    days_with_donations: Number(row.days_with_donations) || 0,
  };
}

async function fetchDonationMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonationMetricsResult> {
  // Use inclusive date range: [startDate, endDate+1day) to include full end date
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Fetch CANONICAL ROLLUP for summary metrics and time series (timezone-aware)
  // AND raw transactions for donor details (top donors, recent donations, by source)
  const [
    canonicalDailyRollup,
    canonicalPeriodSummary,
    { data: allTransactions, error },
  ] = await Promise.all([
    fetchCanonicalDailyRollup(organizationId, startDate, endDate),
    fetchCanonicalPeriodSummary(organizationId, startDate, endDate),
    // Still need raw transactions for donor details, top donors, by source
    (supabase as any)
      .from("actblue_transactions_secure")
      .select("amount, net_amount, donor_email, donor_name, first_name, last_name, state, city, donor_id_hash, is_recurring, transaction_type, transaction_date, refcode, source_campaign, transaction_id, id")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lt("transaction_date", endDateInclusive)
      .order("transaction_date", { ascending: true }),
  ]);

  if (error) throw error;

  const data = allTransactions || [];

  // Separate donations from refunds/cancellations (for donor-level details)
  const donations = data.filter((d: any) => d.transaction_type === "donation");
  const refunds = data.filter((d: any) => d.transaction_type === "refund" || d.transaction_type === "cancellation");

  // ============================================================================
  // Use CANONICAL ROLLUP for summary metrics - SINGLE SOURCE OF TRUTH
  // This ensures timezone-aware day bucketing matches SQL exactly
  // ============================================================================
  const metrics: DonationMetrics = {
    totalRaised: canonicalPeriodSummary.gross_raised,
    netRaised: canonicalPeriodSummary.net_revenue, // net_revenue = net_raised - refunds
    totalDonations: canonicalPeriodSummary.donation_count,
    uniqueDonors: canonicalPeriodSummary.unique_donors_approx,
    averageDonation: canonicalPeriodSummary.avg_donation,
    recurringCount: canonicalPeriodSummary.recurring_count,
    recurringRevenue: canonicalPeriodSummary.recurring_revenue,
    oneTimeCount: canonicalPeriodSummary.one_time_count,
    oneTimeRevenue: canonicalPeriodSummary.one_time_revenue,
    refundCount: canonicalPeriodSummary.refund_count,
    refundAmount: canonicalPeriodSummary.refunds,
  };

  logger.debug('Using canonical rollup for donation metrics', {
    gross: metrics.totalRaised,
    net: metrics.netRaised,
    donations: metrics.totalDonations,
    refunds: metrics.refundAmount,
  });

  // ============================================================================
  // Time series from CANONICAL DAILY ROLLUP - timezone-aware, SINGLE SOURCE OF TRUTH
  // ============================================================================
  const dateInterval = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  // Index canonical rollup by day for O(1) lookups
  const canonicalByDay = new Map<string, DailyRollupRow>();
  for (const row of canonicalDailyRollup) {
    canonicalByDay.set(row.day, row);
  }

  const timeSeries: DonationTimeSeries[] = dateInterval.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const canonicalDay = canonicalByDay.get(dateStr);

    return {
      date: dateStr,
      donations: canonicalDay?.donation_count ?? 0,
      amount: canonicalDay?.net_revenue ?? 0, // Use net_revenue for consistency
      donors: canonicalDay?.unique_donors ?? 0,
    };
  });

  // By source (refcode) - donations only
  const sourceMap = new Map<string, { count: number; amount: number }>();
  donations.forEach((d: any) => {
    const source = d.refcode || d.source_campaign || "Unattributed";
    const entry = sourceMap.get(source) || { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += Number(d.net_amount || d.amount || 0);
    sourceMap.set(source, entry);
  });

  const bySource: DonationBySource[] = Array.from(sourceMap.entries())
    .map(([source, entry]) => ({
      source,
      count: entry.count,
      amount: entry.amount,
      percentage: donations.length > 0 ? (entry.count / donations.length) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Top donors - donations only, preserve names and details
  const donorMap = new Map<string, {
    name: string;
    email: string;
    state: string | null;
    totalAmount: number;
    donationCount: number;
    lastDonation: string;
  }>();

  donations.forEach((d: any) => {
    const donorKey = d.donor_id_hash || d.donor_email;
    if (donorKey) {
      const existing = donorMap.get(donorKey);
      // Use org timezone for consistent date display
      const txDate = formatDateInOrgTimezone(d.transaction_date);
      
      // Construct full name from available fields
      const fullName = d.donor_name || 
        (d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : null) ||
        d.first_name || 
        "Anonymous";

      if (existing) {
        existing.totalAmount += Number(d.net_amount || d.amount || 0);
        existing.donationCount += 1;
        // Keep the most recent donation date
        if (txDate > existing.lastDonation) {
          existing.lastDonation = txDate;
        }
        // Keep the first non-anonymous name we find
        if (existing.name === "Anonymous" && fullName !== "Anonymous") {
          existing.name = fullName;
        }
        // Keep first non-null state
        if (!existing.state && d.state) {
          existing.state = d.state;
        }
      } else {
        donorMap.set(donorKey, {
          name: fullName,
          email: d.donor_email || "",
          state: d.state || null,
          totalAmount: Number(d.net_amount || d.amount || 0),
          donationCount: 1,
          lastDonation: txDate,
        });
      }
    }
  });

  const topDonors: TopDonor[] = Array.from(donorMap.entries())
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      email: entry.email,
      state: entry.state,
      totalAmount: entry.totalAmount,
      donationCount: entry.donationCount,
      lastDonation: entry.lastDonation,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 25);

  // Recent donations - individual transactions sorted by date (most recent first)
  const recentDonations: DonationRow[] = donations
    .map((d: any) => ({
      id: d.transaction_id || d.id || `${d.donor_email}-${d.transaction_date}-${d.amount}`,
      donorName: d.donor_name || 
        (d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : null) ||
        d.first_name || 
        "Anonymous",
      email: d.donor_email || "",
      state: d.state || null,
      city: d.city || null,
      amount: Number(d.amount || 0),
      netAmount: Number(d.net_amount || d.amount || 0),
      date: d.transaction_date,
      isRecurring: Boolean(d.is_recurring),
      refcode: d.refcode || null,
    }))
    .sort((a: DonationRow, b: DonationRow) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { metrics, timeSeries, bySource, topDonors, recentDonations };
}

export function useDonationMetricsQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: donationKeys.metrics(organizationId || "", dateRange),
    queryFn: () =>
      fetchDonationMetrics(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Separate hook for time series only (lighter weight)
export function useDonationTimeSeriesQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: donationKeys.timeSeries(organizationId || "", dateRange),
    queryFn: async () => {
      const result = await fetchDonationMetrics(
        organizationId!,
        dateRange.startDate,
        dateRange.endDate
      );
      return result.timeSeries;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
