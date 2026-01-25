import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { donationKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { logger } from "@/lib/logger";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/metricDefinitions";
import { fetchDailyRollup, fetchPeriodSummary } from "@/lib/actblueRpcClient";
import type { DailyRollupRow, PeriodSummary } from "./useActBlueDailyRollupQuery";

/**
 * Convert a date string (e.g., '2026-01-22') to UTC timestamp boundaries
 * representing midnight-to-midnight in the org's local timezone.
 * 
 * For America/New_York:
 * - '2026-01-22' → start: '2026-01-22T05:00:00.000Z' (midnight ET = 5am UTC)
 * - '2026-01-22' → end: '2026-01-23T04:59:59.999Z' (11:59pm ET)
 */
function getTimezoneAwareBounds(
  startDate: string,
  endDate: string,
  timezone: string
): { startISO: string; endISO: string } {
  // Parse date strings as local dates in the org's timezone
  const startLocal = toZonedTime(new Date(`${startDate}T00:00:00`), timezone);
  const endLocal = toZonedTime(new Date(`${endDate}T23:59:59.999`), timezone);
  
  // Convert back to UTC for the database query
  const startUTC = fromZonedTime(new Date(`${startDate}T00:00:00`), timezone);
  const endUTC = fromZonedTime(new Date(`${endDate}T23:59:59.999`), timezone);
  
  return {
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
  };
}
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

async function fetchDonationMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonationMetricsResult> {
  // Convert date strings to timezone-aware UTC boundaries
  // This ensures raw transaction fetches match the canonical rollup day boundaries
  const { startISO, endISO } = getTimezoneAwareBounds(startDate, endDate, DEFAULT_ORG_TIMEZONE);
  
  logger.debug('Fetching donation metrics with timezone-aware bounds', {
    startDate,
    endDate,
    startISO,
    endISO,
    timezone: DEFAULT_ORG_TIMEZONE,
  });

  // Fetch CANONICAL ROLLUP for summary metrics and time series (timezone-aware)
  // AND raw transactions for donor details (top donors, recent donations, by source)
  const [
    canonicalDailyRollup,
    canonicalPeriodSummary,
    { data: allTransactions, error },
  ] = await Promise.all([
    fetchDailyRollup(organizationId, startDate, endDate),
    fetchPeriodSummary(organizationId, startDate, endDate),
    // Raw transactions for donor details, top donors, by source
    // NOW USES TIMEZONE-AWARE BOUNDARIES to match canonical rollup
    (supabase as any)
      .from("actblue_transactions_secure")
      .select("amount, net_amount, donor_email, donor_name, first_name, last_name, state, city, is_recurring, transaction_type, transaction_date, refcode, source_campaign, transaction_id, id")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startISO)
      .lte("transaction_date", endISO)
      .order("transaction_date", { ascending: false })
      .limit(2000),
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
    // Use donor_email as the key for donor aggregation (donor_id_hash doesn't exist in this view)
    const donorKey = d.donor_email || d.transaction_id || `${d.donor_name}-${d.transaction_date}-${d.amount}`;
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

export function useDonationMetricsQuery(
  organizationId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const storeRange = useDateRange();
  
  // Use provided dates or fall back to store
  const effectiveRange = {
    startDate: startDate || storeRange.startDate,
    endDate: endDate || storeRange.endDate,
  };

  // Removed diagnostic logging - using shared actblueRpcClient

  return useQuery({
    queryKey: donationKeys.metrics(organizationId || "", effectiveRange),
    queryFn: () => fetchDonationMetrics(organizationId!, effectiveRange.startDate, effectiveRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}

// Separate hook for time series only (lighter weight)
export function useDonationTimeSeriesQuery(
  organizationId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const storeRange = useDateRange();
  
  // Use provided dates or fall back to store
  const effectiveRange = {
    startDate: startDate || storeRange.startDate,
    endDate: endDate || storeRange.endDate,
  };

  return useQuery({
    queryKey: donationKeys.timeSeries(organizationId || "", effectiveRange),
    queryFn: async () => {
      const result = await fetchDonationMetrics(
        organizationId!,
        effectiveRange.startDate,
        effectiveRange.endDate
      );
      return result.timeSeries;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
