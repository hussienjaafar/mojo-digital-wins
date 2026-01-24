/**
 * useActBlueMetrics - THE SINGLE SOURCE OF TRUTH for ActBlue dashboard metrics
 * 
 * This hook wraps the unified `get_actblue_dashboard_metrics` RPC which returns
 * all metrics needed for client dashboards in a single call.
 * 
 * Features:
 * - Timezone-aware daily bucketing
 * - Consistent channel detection (Meta, SMS, Email, Other, Unattributed)
 * - Previous period comparison for trends
 * - Attribution quality metrics
 * - Optional campaign/creative filtering
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import type { AttributionChannel } from "@/utils/channelDetection";


// ==================== Types ====================

export interface ActBlueSummary {
  totalDonations: number;
  totalRaised: number;
  totalNet: number;
  totalFees: number;
  uniqueDonors: number;
  averageDonation: number;
  recurringCount: number;
  recurringAmount: number;
  recurringRate: number;
  refundCount: number;
  refundAmount: number;
  refundRate: number;
}

export interface ActBluePreviousPeriod {
  totalDonations: number;
  totalRaised: number;
  totalNet: number;
  uniqueDonors: number;
  recurringCount: number;
  recurringAmount: number;
}

export interface ActBlueTrends {
  raisedTrend: number | null;
  donationsTrend: number | null;
  donorsTrend: number | null;
  recurringTrend: number | null;
}

export interface ActBlueDailyRollup {
  date: string;
  donations: number;
  raised: number;
  net: number;
  donors: number;
  recurring_donations: number;
  recurring_amount: number;
}

export interface ActBlueChannelBreakdown {
  channel: AttributionChannel;
  donations: number;
  raised: number;
  net: number;
  donors: number;
}

export interface ActBlueAttribution {
  attributedCount: number;
  totalCount: number;
  attributionRate: number;
}

export interface ActBlueMetadata {
  timezone: string;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  generatedAt: string;
}

export interface ActBlueMetricsData {
  summary: ActBlueSummary;
  previousPeriod: ActBluePreviousPeriod;
  trends: ActBlueTrends;
  dailyRollup: ActBlueDailyRollup[];
  channelBreakdown: ActBlueChannelBreakdown[];
  attribution: ActBlueAttribution;
  metadata: ActBlueMetadata;
}

export interface UseActBlueMetricsOptions {
  campaignId?: string | null;
  creativeId?: string | null;
  enabled?: boolean;
  useUtc?: boolean; // Optional override for UTC mode
}

// ==================== Query Keys ====================

export const actBlueMetricsKeys = {
  all: ['actblue-metrics'] as const,
  dashboard: (orgId: string, startDate: string, endDate: string, campaignId?: string | null, creativeId?: string | null, useUtc?: boolean) =>
    [...actBlueMetricsKeys.all, 'dashboard', orgId, startDate, endDate, campaignId, creativeId, useUtc] as const,
  sms: (orgId: string, startDate: string, endDate: string) =>
    [...actBlueMetricsKeys.all, 'sms', orgId, startDate, endDate] as const,
  health: (orgId: string) =>
    [...actBlueMetricsKeys.all, 'health', orgId] as const,
};

// ==================== RPC Response Types (match database output) ====================

interface RPCSummary {
  gross_donations: number;
  net_donations: number;
  total_fees: number;
  refunds: number;
  donation_count: number;
  refund_count: number;
  recurring_count: number;
  recurring_revenue: number;
  unique_donors: number;
}

interface RPCDaily {
  day: string;
  gross_donations: number;
  net_donations: number;
  donation_count: number;
  unique_donors?: number;
  recurring_count?: number;
  recurring_revenue?: number;
}

interface RPCChannel {
  channel: string;
  revenue: number;
  count: number;
  donors?: number;
}

interface RPCResponse {
  summary: RPCSummary;
  daily: RPCDaily[];
  channels: RPCChannel[];
  timezone: string;
}

// ==================== Data Transformation ====================

/**
 * Transforms the RPC response (database field names) to frontend interface names.
 * This is necessary because the database uses snake_case and different naming conventions.
 */
function transformRPCResponse(
  raw: RPCResponse,
  startDate: string,
  endDate: string
): ActBlueMetricsData {
  const summary = raw.summary || {} as RPCSummary;
  
  const totalDonations = summary.donation_count || 0;
  const totalRaised = summary.gross_donations || 0;
  const totalNet = summary.net_donations || 0;
  const uniqueDonors = summary.unique_donors || 0;
  const averageDonation = totalDonations > 0 ? totalRaised / totalDonations : 0;
  const recurringCount = summary.recurring_count || 0;
  const recurringAmount = summary.recurring_revenue || 0;
  const recurringRate = totalDonations > 0 ? (recurringCount / totalDonations) * 100 : 0;
  const refundCount = summary.refund_count || 0;
  const refundAmount = summary.refunds || 0;
  const refundRate = totalDonations > 0 ? (refundCount / totalDonations) * 100 : 0;

  // Transform daily data
  const dailyRollup: ActBlueDailyRollup[] = (raw.daily || []).map(d => ({
    date: d.day,
    donations: d.donation_count || 0,
    raised: d.gross_donations || 0,
    net: d.net_donations || 0,
    donors: d.unique_donors || 0,
    recurring_donations: d.recurring_count || 0,
    recurring_amount: d.recurring_revenue || 0,
  }));

  // Transform channel breakdown
  const channelBreakdown: ActBlueChannelBreakdown[] = (raw.channels || []).map(c => ({
    channel: c.channel as AttributionChannel,
    donations: c.count || 0,
    raised: c.revenue || 0,
    net: c.revenue || 0, // Approximate - fees not broken down by channel
    donors: c.donors || 0,
  }));

  // Calculate attribution metrics from channel data
  const attributedCount = channelBreakdown
    .filter(c => c.channel !== 'unattributed' && c.channel !== 'other')
    .reduce((sum, c) => sum + c.donations, 0);

  return {
    summary: {
      totalDonations,
      totalRaised,
      totalNet,
      totalFees: summary.total_fees || 0,
      uniqueDonors,
      averageDonation,
      recurringCount,
      recurringAmount,
      recurringRate,
      refundCount,
      refundAmount,
      refundRate,
    },
    dailyRollup,
    channelBreakdown,
    previousPeriod: {
      totalDonations: 0,
      totalRaised: 0,
      totalNet: 0,
      uniqueDonors: 0,
      recurringCount: 0,
      recurringAmount: 0,
    },
    trends: {
      raisedTrend: null,
      donationsTrend: null,
      donorsTrend: null,
      recurringTrend: null,
    },
    attribution: {
      attributedCount,
      totalCount: totalDonations,
      attributionRate: totalDonations > 0 ? Math.round((attributedCount / totalDonations) * 100) : 0,
    },
    metadata: {
      timezone: raw.timezone || 'America/New_York',
      startDate,
      endDate,
      previousStartDate: '',
      previousEndDate: '',
      generatedAt: new Date().toISOString(),
    },
  };
}

// ==================== Data Fetching ====================

async function fetchActBlueMetrics(
  organizationId: string,
  startDate: string,
  endDate: string,
  campaignId?: string | null,
  creativeId?: string | null,
  useUtc: boolean = false
): Promise<ActBlueMetricsData> {
  const { data, error } = await supabase.rpc('get_actblue_dashboard_metrics', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_campaign_id: campaignId || null,
    p_creative_id: creativeId || null,
    p_use_utc: useUtc,
  });

  if (error) {
    console.error('[useActBlueMetrics] RPC error:', error);
    throw new Error(`Failed to fetch ActBlue metrics: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from get_actblue_dashboard_metrics');
  }

  // Transform RPC response to match frontend interface
  return transformRPCResponse(data as unknown as RPCResponse, startDate, endDate);
}

// ==================== Hook ====================

/**
 * Primary hook for fetching all ActBlue dashboard metrics.
 * Uses the unified `get_actblue_dashboard_metrics` RPC.
 * 
 * Always uses Eastern Time boundaries to match ActBlue's Fundraising Performance dashboard.
 */
export function useActBlueMetrics(
  organizationId: string | undefined,
  options: UseActBlueMetricsOptions = {}
) {
  const { startDate, endDate } = useDateRange();
  const { campaignId, creativeId, enabled = true } = options;

  return useQuery({
    queryKey: actBlueMetricsKeys.dashboard(
      organizationId || '',
      startDate,
      endDate,
      campaignId,
      creativeId,
      false // Always use ET (not UTC)
    ),
    queryFn: () => fetchActBlueMetrics(
      organizationId!,
      startDate,
      endDate,
      campaignId,
      creativeId,
      false // Always use ET (not UTC)
    ),
    enabled: enabled && !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ==================== Derived Hooks ====================

/**
 * Convenience hook to get just the summary metrics
 */
export function useActBlueSummary(organizationId: string | undefined) {
  const query = useActBlueMetrics(organizationId);
  return {
    ...query,
    data: query.data?.summary,
    trends: query.data?.trends,
    previousPeriod: query.data?.previousPeriod,
  };
}

/**
 * Convenience hook to get channel breakdown
 */
export function useActBlueChannels(organizationId: string | undefined) {
  const query = useActBlueMetrics(organizationId);
  return {
    ...query,
    data: query.data?.channelBreakdown,
    attribution: query.data?.attribution,
  };
}

/**
 * Convenience hook to get daily rollup for charts
 */
export function useActBlueDailyData(organizationId: string | undefined) {
  const query = useActBlueMetrics(organizationId);
  return {
    ...query,
    data: query.data?.dailyRollup,
    metadata: query.data?.metadata,
  };
}

// ==================== SMS Metrics Hook ====================

export interface SMSMetricsData {
  summary: {
    totalDonations: number;
    totalRaised: number;
    totalNet: number;
    uniqueDonors: number;
    averageDonation: number;
    recurringCount: number;
    // SMS-specific fields
    totalSent: number;
    totalDelivered: number;
    totalClicks: number;
    totalOptOuts: number;
    totalCost: number;
    campaignCount: number;
  };
  previousPeriod: {
    totalDonations: number;
    totalRaised: number;
    totalSent: number;
    totalDelivered: number;
    totalClicks: number;
    totalOptOuts: number;
    totalCost: number;
  };
  trends: {
    raisedTrend: number | null;
    donationsTrend: number | null;
  };
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string;
    donations: number;
    raised: number;
    net: number;
    donors: number;
    cost: number;
    sent: number;
    delivered: number;
    clicks: number;
    optOuts: number;
    first_donation: string;
    last_donation: string;
    send_date?: string;
    // AI analysis fields
    topic?: string | null;
    topic_summary?: string | null;
    tone?: string | null;
    urgency_level?: string | null;
    call_to_action?: string | null;
    key_themes?: string[] | null;
    analyzed_at?: string | null;
  }>;
  dailyMetrics: Array<{
    date: string;
    donations: number;
    raised: number;
    donors: number;
    sent: number;
    delivered: number;
    clicks: number;
    optOuts: number;
    cost: number;
  }>;
  metadata: {
    timezone: string;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
    generatedAt: string;
    attributionMethod?: string;
    refcodePatterns?: string[];
  };
}

async function fetchSMSMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<SMSMetricsData> {
  const { data, error } = await supabase.rpc('get_sms_metrics', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error('[useSMSMetrics] RPC error:', error);
    throw new Error(`Failed to fetch SMS metrics: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from get_sms_metrics');
  }

  return data as unknown as SMSMetricsData;
}

/**
 * Hook for fetching SMS-specific metrics.
 * Uses the dedicated `get_sms_metrics` RPC with unified channel detection.
 * 
 * @param organizationId - The organization ID to fetch metrics for
 * @param startDate - Optional start date (falls back to store if not provided)
 * @param endDate - Optional end date (falls back to store if not provided)
 */
export function useSMSMetricsUnified(
  organizationId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const storeRange = useDateRange();
  
  // Use provided dates or fall back to store (same pattern as useDonationMetricsQuery)
  const effectiveStartDate = startDate || storeRange.startDate;
  const effectiveEndDate = endDate || storeRange.endDate;

  return useQuery({
    queryKey: actBlueMetricsKeys.sms(organizationId || '', effectiveStartDate, effectiveEndDate),
    queryFn: () => fetchSMSMetrics(organizationId!, effectiveStartDate, effectiveEndDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false, // Fail fast instead of infinite skeleton on errors
  });
}

// ==================== Client Health Check Hook ====================

export interface ClientHealthData {
  transactions: {
    total_transactions: number;
    last_30_days: number;
    earliest_transaction: string | null;
    latest_transaction: string | null;
    unique_refcodes: number;
    transactions_with_refcode: number;
    unique_forms: number;
  };
  channelBreakdown: Array<{
    channel: AttributionChannel;
    count: number;
  }>;
  smsFormsDetected: string[];
  metaCampaigns: {
    meta_campaigns: number;
    active_campaigns: number;
  };
  attribution: {
    total_attributed: number;
    deterministic: number;
    sms_attributed: number;
    meta_attributed: number;
  };
  healthChecks: {
    hasTransactions: boolean;
    hasRecentData: boolean;
    hasRefcodes: boolean;
    hasSmsDetected: boolean;
    hasMetaCampaigns: boolean;
    hasAttribution: boolean;
  };
  recommendations: string[] | null;
  generatedAt: string;
}

async function fetchClientHealth(organizationId: string): Promise<ClientHealthData> {
  const { data, error } = await supabase.rpc('check_client_data_health', {
    p_org_id: organizationId,
  });

  if (error) {
    console.error('[useClientHealth] RPC error:', error);
    throw new Error(`Failed to check client health: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from check_client_data_health');
  }

  return data as unknown as ClientHealthData;
}

/**
 * Hook for checking client data health during onboarding.
 * Returns validation status and recommendations.
 */
export function useClientHealth(organizationId: string | undefined) {
  return useQuery({
    queryKey: actBlueMetricsKeys.health(organizationId || ''),
    queryFn: () => fetchClientHealth(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
