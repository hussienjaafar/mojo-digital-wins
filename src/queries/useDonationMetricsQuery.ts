import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { donationKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, parseISO, eachDayOfInterval } from "date-fns";

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

interface DonationMetricsResult {
  metrics: DonationMetrics;
  timeSeries: DonationTimeSeries[];
  bySource: DonationBySource[];
  topDonors: Array<{
    email: string;
    totalAmount: number;
    donationCount: number;
  }>;
}

async function fetchDonationMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonationMetricsResult> {
  const { data: donations, error } = await supabase
    .from("actblue_transactions")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: true });

  if (error) throw error;

  const data = donations || [];

  // Calculate metrics
  const totalRaised = data.reduce((sum, d) => sum + (d.amount || 0), 0);
  const netRaised = data.reduce((sum, d) => sum + (d.net_amount || d.amount || 0), 0);
  const uniqueDonors = new Set(data.map((d) => d.donor_email)).size;
  const recurring = data.filter((d) => d.is_recurring);
  const oneTime = data.filter((d) => !d.is_recurring);
  const refunds = data.filter((d) => d.transaction_type === "refund");

  const metrics: DonationMetrics = {
    totalRaised,
    netRaised,
    totalDonations: data.length,
    uniqueDonors,
    averageDonation: data.length > 0 ? netRaised / data.length : 0,
    recurringCount: recurring.length,
    recurringRevenue: recurring.reduce((sum, d) => sum + (d.net_amount || d.amount || 0), 0),
    oneTimeCount: oneTime.length,
    oneTimeRevenue: oneTime.reduce((sum, d) => sum + (d.net_amount || d.amount || 0), 0),
    refundCount: refunds.length,
    refundAmount: refunds.reduce((sum, d) => sum + Math.abs(d.amount || 0), 0),
  };

  // Time series
  const dateInterval = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  const dailyMap = new Map<string, { donations: number; amount: number; donors: Set<string> }>();
  dateInterval.forEach((date) => {
    dailyMap.set(format(date, "yyyy-MM-dd"), { donations: 0, amount: 0, donors: new Set() });
  });

  data.forEach((d) => {
    const date = d.transaction_date.split("T")[0];
    const entry = dailyMap.get(date);
    if (entry) {
      entry.donations += 1;
      entry.amount += d.net_amount || d.amount || 0;
      if (d.donor_email) entry.donors.add(d.donor_email);
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

  // By source (refcode)
  const sourceMap = new Map<string, { count: number; amount: number }>();
  data.forEach((d) => {
    const source = d.refcode || d.source_campaign || "Direct";
    const entry = sourceMap.get(source) || { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += d.net_amount || d.amount || 0;
    sourceMap.set(source, entry);
  });

  const bySource: DonationBySource[] = Array.from(sourceMap.entries())
    .map(([source, entry]) => ({
      source,
      count: entry.count,
      amount: entry.amount,
      percentage: data.length > 0 ? (entry.count / data.length) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Top donors
  const donorMap = new Map<string, { totalAmount: number; donationCount: number }>();
  data.forEach((d) => {
    if (d.donor_email) {
      const entry = donorMap.get(d.donor_email) || { totalAmount: 0, donationCount: 0 };
      entry.totalAmount += d.net_amount || d.amount || 0;
      entry.donationCount += 1;
      donorMap.set(d.donor_email, entry);
    }
  });

  const topDonors = Array.from(donorMap.entries())
    .map(([email, entry]) => ({
      email,
      totalAmount: entry.totalAmount,
      donationCount: entry.donationCount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  return { metrics, timeSeries, bySource, topDonors };
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
