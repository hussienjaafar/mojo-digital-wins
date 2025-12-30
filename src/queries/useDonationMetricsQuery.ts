import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { donationKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, eachDayOfInterval, addDays } from "date-fns";
import { logger } from "@/lib/logger";

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
  // Use inclusive date range: [startDate, endDate+1day) to include full end date
  const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

  // Use actblue_transactions_secure for PII protection
  // Include donor_name, first_name, last_name, state for complete donor info
  const { data: allTransactions, error } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("amount, net_amount, donor_email, donor_name, first_name, last_name, state, donor_id_hash, is_recurring, transaction_type, transaction_date, refcode, source_campaign")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDateInclusive)
    .order("transaction_date", { ascending: true });

  if (error) throw error;

  const data = allTransactions || [];

  // Separate donations from refunds/cancellations for accurate metrics
  const donations = data.filter((d: any) => d.transaction_type === "donation");
  const refunds = data.filter((d: any) => d.transaction_type === "refund" || d.transaction_type === "cancellation");

  // Calculate metrics using donations only (not refunds)
  const totalRaised = donations.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  // Refunds use net_amount when available, with Math.abs for consistent positive value
  const refundAmount = refunds.reduce((sum: number, d: any) => sum + Math.abs(Number(d.net_amount ?? d.amount ?? 0)), 0);
  const netRaised = donations.reduce((sum: number, d: any) => sum + Number(d.net_amount || d.amount || 0), 0) - refundAmount;

  const uniqueDonors = new Set(donations.map((d: any) => d.donor_id_hash || d.donor_email).filter(Boolean)).size;

  // Log refund metrics for observability
  if (refunds.length > 0) {
    const refundRate = totalRaised > 0 ? (refundAmount / totalRaised) * 100 : 0;
    logger.debug('Donation metrics refund summary', {
      donationCount: donations.length,
      refundCount: refunds.length,
      refundAmount: refundAmount.toFixed(2),
      refundRate: refundRate.toFixed(1) + '%',
    });
    if (refundRate > 10) {
      logger.warn('High refund rate detected', { refundRate: refundRate.toFixed(1) + '%' });
    }
  }
  const recurring = donations.filter((d: any) => d.is_recurring);
  const oneTime = donations.filter((d: any) => !d.is_recurring);

  const metrics: DonationMetrics = {
    totalRaised,
    netRaised,
    totalDonations: donations.length,
    uniqueDonors,
    averageDonation: donations.length > 0 ? totalRaised / donations.length : 0,
    recurringCount: recurring.length,
    recurringRevenue: recurring.reduce((sum: number, d: any) => sum + Number(d.net_amount || d.amount || 0), 0),
    oneTimeCount: oneTime.length,
    oneTimeRevenue: oneTime.reduce((sum: number, d: any) => sum + Number(d.net_amount || d.amount || 0), 0),
    refundCount: refunds.length,
    refundAmount,
  };

  // Time series (using donations only)
  const dateInterval = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  const dailyMap = new Map<string, { donations: number; amount: number; donors: Set<string> }>();
  dateInterval.forEach((date) => {
    dailyMap.set(format(date, "yyyy-MM-dd"), { donations: 0, amount: 0, donors: new Set() });
  });

  // Use donations only (not refunds) for time series
  donations.forEach((d: any) => {
    const date = d.transaction_date?.split("T")[0];
    if (!date) return;
    const entry = dailyMap.get(date);
    if (entry) {
      entry.donations += 1;
      entry.amount += Number(d.net_amount || d.amount || 0);
      const donorKey = d.donor_id_hash || d.donor_email;
      if (donorKey) entry.donors.add(donorKey);
    }
  });

  const timeSeries: DonationTimeSeries[] = Array.from(dailyMap.entries()).map(
    ([date, entry]) => ({
      date,
      donations: entry.donations,
      amount: entry.amount,
      donors: entry.donors.size,
    })
  );

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
      const txDate = d.transaction_date?.split("T")[0] || "";
      
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
