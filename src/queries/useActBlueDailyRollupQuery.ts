/**
 * ActBlue Daily Rollup Query Hook
 *
 * Uses the canonical actblue_daily_rollup view as the SINGLE SOURCE OF TRUTH
 * for all ActBlue metrics. This ensures consistency across all dashboard components.
 *
 * Metric Contract (see src/lib/metricDefinitions.ts):
 * - gross_raised: SUM(amount) for donations (before fees)
 * - net_raised: SUM(net_amount) for donations (after fees, before refunds)
 * - refunds: SUM(ABS(net_amount)) for refunds/cancellations
 * - net_revenue: net_raised - refunds (final retained amount)
 *
 * Day Bucketing: Uses org timezone (default: America/New_York)
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface DailyRollupRow {
  day: string;
  gross_raised: number;
  net_raised: number;
  refunds: number;
  net_revenue: number;
  total_fees: number;
  donation_count: number;
  unique_donors: number;
  refund_count: number;
  recurring_count: number;
  one_time_count: number;
  recurring_revenue: number;
  one_time_revenue: number;
  fee_percentage: number;
  refund_rate: number;
}

export interface PeriodSummary {
  gross_raised: number;
  net_raised: number;
  refunds: number;
  net_revenue: number;
  total_fees: number;
  donation_count: number;
  unique_donors_approx: number;
  refund_count: number;
  recurring_count: number;
  one_time_count: number;
  recurring_revenue: number;
  one_time_revenue: number;
  avg_fee_percentage: number;
  refund_rate: number;
  avg_donation: number;
  days_with_donations: number;
}

export interface ActBlueRollupData {
  dailyData: DailyRollupRow[];
  summary: PeriodSummary;
}

// Query key factory
export const actBlueRollupKeys = {
  all: ['actblue-rollup'] as const,
  daily: (orgId: string, startDate: string, endDate: string) =>
    [...actBlueRollupKeys.all, 'daily', orgId, startDate, endDate] as const,
  summary: (orgId: string, startDate: string, endDate: string) =>
    [...actBlueRollupKeys.all, 'summary', orgId, startDate, endDate] as const,
};

/**
 * Fetch daily rollup data from the canonical view
 */
async function fetchDailyRollup(
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
    logger.error('Failed to fetch ActBlue daily rollup', { error, organizationId, startDate, endDate });
    throw new Error(`Failed to fetch daily rollup: ${error.message}`);
  }

  // Map RPC field names to frontend interface names
  return (data || []).map((row: any) => {
    const grossDonations = Number(row.gross_donations) || 0;
    const netDonations = Number(row.net_donations) || 0;
    const donationCount = Number(row.donation_count) || 0;
    const recurringCount = Number(row.recurring_count) || 0;
    const recurringRevenue = Number(row.recurring_revenue) || 0;
    const totalFees = Number(row.total_fees) || 0;
    const refundCount = Number(row.refund_count) || 0;

    return {
      day: row.day,
      gross_raised: grossDonations,
      net_raised: netDonations,
      refunds: Number(row.refunds) || 0,
      net_revenue: Number(row.net_revenue) || 0,
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
 * Fetch period summary from the canonical view
 */
async function fetchPeriodSummary(
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
    logger.error('Failed to fetch ActBlue period summary', { error, organizationId, startDate, endDate });
    throw new Error(`Failed to fetch period summary: ${error.message}`);
  }

  // Map RPC field names to frontend interface names
  const row = data?.[0] || {};
  const grossDonations = Number(row.total_gross_donations) || 0;
  const netDonations = Number(row.total_net_donations) || 0;
  const donationCount = Number(row.total_donation_count) || 0;
  const recurringCount = Number(row.total_recurring_count) || 0;
  const recurringRevenue = Number(row.total_recurring_revenue) || 0;
  const totalFees = Number(row.total_fees) || 0;
  const refundCount = Number(row.total_refund_count) || 0;

  return {
    gross_raised: grossDonations,
    net_raised: netDonations,
    refunds: Number(row.total_refunds) || 0,
    net_revenue: Number(row.total_net_revenue) || 0,
    total_fees: totalFees,
    donation_count: donationCount,
    unique_donors_approx: Number(row.total_unique_donors) || 0,
    refund_count: refundCount,
    recurring_count: recurringCount,
    one_time_count: donationCount - recurringCount,
    recurring_revenue: recurringRevenue,
    one_time_revenue: netDonations - recurringRevenue,
    avg_fee_percentage: grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0,
    refund_rate: donationCount > 0 ? (refundCount / donationCount) * 100 : 0,
    avg_donation: Number(row.overall_avg_donation) || 0,
    days_with_donations: 0, // Not provided by RPC
  };
}

/**
 * Combined query for both daily data and summary
 */
async function fetchActBlueRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ActBlueRollupData> {
  const [dailyData, summary] = await Promise.all([
    fetchDailyRollup(organizationId, startDate, endDate),
    fetchPeriodSummary(organizationId, startDate, endDate),
  ]);

  return { dailyData, summary };
}

/**
 * Hook for fetching ActBlue daily rollup data
 *
 * This is the CANONICAL source for ActBlue metrics.
 * Use this instead of direct queries to actblue_transactions for consistency.
 */
export function useActBlueDailyRollupQuery(
  organizationId: string | undefined,
  startDate: string,
  endDate: string
): UseQueryResult<ActBlueRollupData, Error> {
  return useQuery({
    queryKey: actBlueRollupKeys.daily(organizationId || '', startDate, endDate),
    queryFn: () => fetchActBlueRollup(organizationId!, startDate, endDate),
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

/**
 * Hook for fetching just the period summary (lighter query)
 */
export function useActBluePeriodSummaryQuery(
  organizationId: string | undefined,
  startDate: string,
  endDate: string
): UseQueryResult<PeriodSummary, Error> {
  return useQuery({
    queryKey: actBlueRollupKeys.summary(organizationId || '', startDate, endDate),
    queryFn: () => fetchPeriodSummary(organizationId!, startDate, endDate),
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}

export default useActBlueDailyRollupQuery;
