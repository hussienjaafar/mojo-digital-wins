/**
 * ActBlue RPC Client - Single Source of Truth
 *
 * This module provides shared RPC wrapper functions for ActBlue data.
 * All hooks should import from here to ensure consistent field mapping.
 *
 * Internally calls the unified `get_actblue_dashboard_metrics` RPC which
 * returns summary + daily + channels in a single call. The individual
 * fetch functions extract the relevant portion and map field names to
 * match the DailyRollupRow and PeriodSummary interfaces.
 *
 * RPC Response Field Mapping (dashboard_metrics → frontend interface):
 * - summary.gross_donations → gross_raised
 * - summary.net_donations → net_raised
 * - summary.donation_count → donation_count
 * - summary.recurring_count → recurring_count
 * - summary.recurring_revenue → recurring_revenue
 * - summary.refund_count → refund_count
 * - summary.refunds → refunds
 * - summary.unique_donors → unique_donors
 * - summary.total_fees → total_fees
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { DailyRollupRow, PeriodSummary } from "@/queries/useActBlueDailyRollupQuery";

/** Shape of the unified RPC JSON response */
interface DashboardMetricsResponse {
  summary: {
    gross_donations: number;
    net_donations: number;
    total_fees: number;
    refunds: number;
    donation_count: number;
    refund_count: number;
    recurring_count: number;
    recurring_revenue: number;
    unique_donors: number;
  };
  daily: Array<{
    day: string;
    gross_donations: number;
    net_donations: number;
    donation_count: number;
    unique_donors?: number;
    recurring_count?: number;
    recurring_revenue?: number;
  }>;
  channels: Array<{
    channel: string;
    revenue: number;
    net_revenue?: number;
    count: number;
    donors?: number;
  }>;
  timezone: string;
}

/**
 * Internal: call the unified get_actblue_dashboard_metrics RPC once
 * and return the raw JSON response.
 */
async function fetchDashboardMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DashboardMetricsResponse> {
  const { data, error } = await supabase.rpc('get_actblue_dashboard_metrics', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_campaign_id: null,
    p_creative_id: null,
    p_use_utc: false,
  });

  if (error) {
    logger.error('Failed to fetch ActBlue dashboard metrics', { error, organizationId, startDate, endDate });
    throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from get_actblue_dashboard_metrics');
  }

  return data as unknown as DashboardMetricsResponse;
}

/**
 * Map a daily row from the unified RPC to the DailyRollupRow interface.
 */
function mapDailyRow(row: DashboardMetricsResponse['daily'][number]): DailyRollupRow {
  const grossDonations = Number(row.gross_donations) || 0;
  const netDonations = Number(row.net_donations) || 0;
  const donationCount = Number(row.donation_count) || 0;
  const recurringCount = Number(row.recurring_count) || 0;
  const recurringRevenue = Number(row.recurring_revenue) || 0;
  const totalFees = grossDonations - netDonations;
  // Note: daily rows from dashboard_metrics don't include refund breakdown
  // Refunds are in the summary only; daily refunds default to 0
  const refundAmount = 0;
  const refundCount = 0;

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
    refund_rate: 0,
  };
}

/**
 * Map the summary from the unified RPC to the PeriodSummary interface.
 */
function mapSummary(summary: DashboardMetricsResponse['summary'], dailyCount: number): PeriodSummary {
  const grossDonations = Number(summary.gross_donations) || 0;
  const netDonations = Number(summary.net_donations) || 0;
  const donationCount = Number(summary.donation_count) || 0;
  const recurringCount = Number(summary.recurring_count) || 0;
  const recurringRevenue = Number(summary.recurring_revenue) || 0;
  const refundCount = Number(summary.refund_count) || 0;
  const refundAmount = Number(summary.refunds) || 0;
  const totalFees = Number(summary.total_fees) || (grossDonations - netDonations);

  return {
    gross_raised: grossDonations,
    net_raised: netDonations,
    refunds: refundAmount,
    net_revenue: netDonations - refundAmount,
    total_fees: totalFees,
    donation_count: donationCount,
    unique_donors_approx: Number(summary.unique_donors) || 0,
    refund_count: refundCount,
    recurring_count: recurringCount,
    one_time_count: donationCount - recurringCount,
    recurring_revenue: recurringRevenue,
    one_time_revenue: netDonations - recurringRevenue,
    avg_fee_percentage: grossDonations > 0 ? (totalFees / grossDonations) * 100 : 0,
    refund_rate: donationCount > 0 ? (refundCount / donationCount) * 100 : 0,
    avg_donation: grossDonations / (donationCount || 1),
    days_with_donations: dailyCount,
  };
}

/**
 * Fetch daily ActBlue rollup via the unified dashboard metrics RPC.
 * Preserves the DailyRollupRow interface for downstream consumers.
 */
export async function fetchDailyRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DailyRollupRow[]> {
  const response = await fetchDashboardMetrics(organizationId, startDate, endDate);
  return (response.daily || []).map(mapDailyRow);
}

/**
 * Fetch ActBlue period summary via the unified dashboard metrics RPC.
 * Preserves the PeriodSummary interface for downstream consumers.
 */
export async function fetchPeriodSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const response = await fetchDashboardMetrics(organizationId, startDate, endDate);
  const daysWithDonations = (response.daily || []).filter(d => (Number(d.donation_count) || 0) > 0).length;
  return mapSummary(response.summary || {} as DashboardMetricsResponse['summary'], daysWithDonations);
}

/**
 * Fetch both daily rollup and period summary in a single RPC call.
 * Previously made 2 parallel calls; now makes just 1.
 */
export async function fetchActBlueRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<{ dailyData: DailyRollupRow[]; summary: PeriodSummary }> {
  const response = await fetchDashboardMetrics(organizationId, startDate, endDate);

  const dailyData = (response.daily || []).map(mapDailyRow);
  const daysWithDonations = dailyData.filter(d => d.donation_count > 0).length;
  const summary = mapSummary(response.summary || {} as DashboardMetricsResponse['summary'], daysWithDonations);

  return { dailyData, summary };
}

/**
 * Fetch SMS channel data from the ActBlue RPC channel breakdown.
 * Used as a fallback when the sms_campaigns table has no data,
 * since ActBlue tracks which form (e.g. mpac-sms2) each donation came through.
 */
export async function fetchSmsChannelFromActBlue(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<{ donations: number; raised: number; net: number }> {
  const response = await fetchDashboardMetrics(organizationId, startDate, endDate);
  const smsChannel = (response.channels || []).find(c => c.channel === 'sms');

  return {
    donations: smsChannel?.count || 0,
    raised: Number(smsChannel?.revenue || 0),
    net: Number(smsChannel?.net_revenue || smsChannel?.revenue || 0),
  };
}
