/**
 * ActBlue RPC Client - Single Source of Truth
 * 
 * This module provides shared RPC wrapper functions for ActBlue data.
 * All hooks should import from here to ensure consistent field mapping.
 * 
 * RPC Field Mapping (actual RPC response → frontend interface):
 * - gross_raised → gross_raised
 * - net_raised → net_raised  
 * - transaction_count → donation_count
 * - recurring_count → recurring_count
 * - recurring_amount → recurring_revenue
 * - refund_count → refund_count
 * - refund_amount → refunds
 * - unique_donors → unique_donors
 * - avg_donation → avg_donation
 * 
 * Note: total_fees is calculated as (gross_raised - net_raised) since
 * the RPC doesn't return an explicit fee field.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { DailyRollupRow, PeriodSummary } from "@/queries/useActBlueDailyRollupQuery";

/**
 * Fetch daily ActBlue rollup from the canonical RPC.
 * Uses org timezone for day bucketing - the SINGLE SOURCE OF TRUTH.
 */
export async function fetchDailyRollup(
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
  // RPC returns: gross_raised, net_raised, transaction_count, recurring_count, 
  // recurring_amount, refund_count, refund_amount, unique_donors
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
 * Uses org timezone for day bucketing - the SINGLE SOURCE OF TRUTH.
 */
export async function fetchPeriodSummary(
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
  // RPC returns: gross_raised, net_raised, transaction_count, recurring_count, 
  // recurring_amount, refund_count, refund_amount, unique_donors, avg_donation
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
    avg_donation: Number(row.avg_donation) || (grossDonations / (donationCount || 1)),
    days_with_donations: 0, // Not provided by RPC, compute separately if needed
  };
}

/**
 * Fetch both daily rollup and period summary in parallel
 */
export async function fetchActBlueRollup(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<{ dailyData: DailyRollupRow[]; summary: PeriodSummary }> {
  const [dailyData, summary] = await Promise.all([
    fetchDailyRollup(organizationId, startDate, endDate),
    fetchPeriodSummary(organizationId, startDate, endDate),
  ]);

  return { dailyData, summary };
}
