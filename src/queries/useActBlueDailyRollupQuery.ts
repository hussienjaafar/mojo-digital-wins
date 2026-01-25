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
import { fetchDailyRollup, fetchPeriodSummary, fetchActBlueRollup } from '@/lib/actblueRpcClient';

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
