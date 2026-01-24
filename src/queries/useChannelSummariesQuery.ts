import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, isValid, differenceInCalendarDays, format } from "date-fns";
import { channelKeys } from "./queryKeys";

// ============================================================================
// Types
// ============================================================================

export interface MetaSummary {
  spend: number;
  conversions: number;
  roas: number;
  hasConversionValueData: boolean;
  lastDataDate: string | null;
  hasData: boolean;
}

export interface SmsSummary {
  sent: number;
  raised: number;
  cost: number;
  roi: number;
  campaignCount: number;
  lastDataDate: string | null;
  hasData: boolean;
}

export interface DonationsSummary {
  totalGross: number;
  totalNet: number;
  refundAmount: number;
  refundCount: number;
  donors: number;
  avgNet: number;
  transactionCount: number;
  lastDataDate: string | null;
  hasData: boolean;
}

export interface ChannelSummariesData {
  meta: MetaSummary;
  sms: SmsSummary;
  donations: DonationsSummary;
  /** Aggregate totals across all channels */
  totals: {
    totalRevenue: number;
    totalSpend: number;
    overallRoi: number;
  };
  /** ISO timestamp when data was fetched */
  fetchedAt: string;
}

export interface ChannelSummariesQueryResult {
  data: ChannelSummariesData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
  /** Check if data is stale relative to end date */
  isDataStale: (endDate: string) => boolean;
}

// ============================================================================
// Staleness Configuration
// ============================================================================

export type ChannelType = "meta" | "sms" | "donations";

/** Expected freshness windows in hours per channel */
const CHANNEL_FRESHNESS_HOURS: Record<ChannelType, number> = {
  meta: 48,      // Meta Ads: 48h
  sms: 24,       // SMS: 24h
  donations: 1,  // Donations: 1h (near real-time)
};

/**
 * Check if a channel's data is stale based on its freshness window.
 * Since lastDataDate is date-only (YYYY-MM-DD), we compare using calendar days.
 * Converts hours -> days using Math.max(1, Math.ceil(hours/24)) to avoid false stale flags.
 *
 * @param channel - The channel type
 * @param lastDataDate - The last data date (YYYY-MM-DD format) or null
 * @param endDate - The end date of the selected range (YYYY-MM-DD format)
 * @returns true if the channel is stale, false otherwise
 */
export function isChannelStale(
  channel: ChannelType,
  lastDataDate: string | null,
  endDate: string
): boolean {
  if (!lastDataDate) return false; // No data = not stale (handled separately as "No data")

  const lastDate = parseISO(lastDataDate);
  const rangeEnd = parseISO(endDate);

  if (!isValid(lastDate) || !isValid(rangeEnd)) return false;

  const daysDiff = differenceInCalendarDays(rangeEnd, lastDate);

  // Convert freshness hours to days (minimum 1 day since we're comparing dates)
  const freshnessHours = CHANNEL_FRESHNESS_HOURS[channel];
  const freshnessDays = Math.max(1, Math.ceil(freshnessHours / 24));

  return daysDiff > freshnessDays;
}

/**
 * Format a date string (YYYY-MM-DD) as "MMM d, yyyy" for display.
 * Returns null if the date is invalid or null.
 */
export function formatLastDataDate(dateString: string | null): string | null {
  if (!dateString) return null;

  const date = parseISO(dateString);
  if (!isValid(date)) return null;

  return format(date, "MMM d, yyyy");
}

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchMetaSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<MetaSummary> {
  const { data, error } = await supabase
    .from("meta_ad_metrics")
    .select("spend, conversions, conversion_value, date")
    .eq("organization_id", organizationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("[useChannelSummariesQuery] Meta fetch error:", error);
    throw error;
  }

  const metrics = data || [];
  const spend = metrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
  const conversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
  const conversionValue = metrics.reduce((sum, m) => sum + Number(m.conversion_value || 0), 0);
  const hasConversionValueData = conversionValue > 0;
  const roas = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0;
  const lastDataDate = metrics[0]?.date || null;

  return {
    spend,
    conversions,
    roas,
    hasConversionValueData,
    lastDataDate,
    hasData: metrics.length > 0,
  };
}

async function fetchSmsSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<SmsSummary> {
  // Use the get_sms_metrics RPC for accurate attribution-based metrics
  // This calculates raised/conversions by matching ActBlue transactions to campaigns
  const { data, error } = await (supabase as any).rpc('get_sms_metrics', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error("[useChannelSummariesQuery] SMS RPC error:", error);
    throw error;
  }

  // Extract totals from the RPC response
  const totals = data?.totals || {};
  const campaigns = data?.campaigns || [];
  
  const sent = totals.totalSent || 0;
  const raised = totals.totalAmountRaised || 0;
  const cost = totals.totalCost || 0;
  const roi = cost > 0 ? raised / cost : 0;
  
  // Get last data date from most recent campaign
  const lastDataDate = campaigns[0]?.sendDate?.split("T")[0] || null;

  return {
    sent,
    raised,
    cost,
    roi,
    campaignCount: totals.campaignCount || 0,
    lastDataDate,
    hasData: (totals.campaignCount || 0) > 0,
  };
}

async function fetchDonationsSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonationsSummary> {
  // Use canonical RPC for timezone-aware, single-source-of-truth metrics
  const { data, error } = await (supabase as any).rpc('get_actblue_period_summary', {
    p_organization_id: organizationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error("[useChannelSummariesQuery] Donations RPC error:", error);
    throw error;
  }

  // Map RPC field names (gross_raised, net_raised, transaction_count, etc.)
  const row = data?.[0] || {};
  const grossDonations = Number(row.gross_raised) || 0;
  const netDonations = Number(row.net_raised) || 0;
  const donationCount = Number(row.transaction_count) || 0;
  const refundCount = Number(row.refund_count) || 0;
  const refundAmount = Number(row.refund_amount) || 0;
  const uniqueDonors = Number(row.unique_donors) || 0;
  const avgDonation = Number(row.avg_donation) || 0;

  // For lastDataDate, we need a separate lightweight query
  const { data: latestTxn } = await supabase
    .from("actblue_transactions_secure")
    .select("transaction_date")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`)
    .order("transaction_date", { ascending: false })
    .limit(1);

  const lastDataDate = latestTxn?.[0]?.transaction_date?.split("T")[0] || null;

  return {
    totalGross: grossDonations,
    totalNet: netDonations,
    refundAmount,
    refundCount,
    donors: uniqueDonors,
    avgNet: avgDonation,
    transactionCount: donationCount,
    lastDataDate,
    hasData: donationCount > 0,
  };
}

async function fetchChannelSummaries(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ChannelSummariesData> {
  // Parallel fetch all channel data
  const [meta, sms, donations] = await Promise.all([
    fetchMetaSummary(organizationId, startDate, endDate),
    fetchSmsSummary(organizationId, startDate, endDate),
    fetchDonationsSummary(organizationId, startDate, endDate),
  ]);

  // Calculate aggregate totals
  const totalSpend = meta.spend + sms.cost;
  const totalRevenue = donations.totalNet;
  const overallRoi = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    meta,
    sms,
    donations,
    totals: {
      totalRevenue,
      totalSpend,
      overallRoi,
    },
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useChannelSummariesQuery(
  organizationId: string | undefined,
  startDate: string,
  endDate: string
): ChannelSummariesQueryResult {
  const query = useQuery({
    queryKey: channelKeys.summaries(organizationId || "", { startDate, endDate }),
    queryFn: () => fetchChannelSummaries(organizationId!, startDate, endDate),
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });

  /**
   * Check if any channel with data is stale based on per-channel freshness windows.
   * Returns true if ANY channel with hasData is beyond its expected freshness window.
   */
  const isDataStale = (endDateToCheck: string): boolean => {
    if (!query.data) return false;

    const { meta, sms, donations } = query.data;

    // Check each channel that has data against its freshness window
    const channelsToCheck: Array<{ channel: ChannelType; hasData: boolean; lastDataDate: string | null }> = [
      { channel: "meta", hasData: meta.hasData, lastDataDate: meta.lastDataDate },
      { channel: "sms", hasData: sms.hasData, lastDataDate: sms.lastDataDate },
      { channel: "donations", hasData: donations.hasData, lastDataDate: donations.lastDataDate },
    ];

    return channelsToCheck.some(
      ({ channel, hasData, lastDataDate }) =>
        hasData && isChannelStale(channel, lastDataDate, endDateToCheck)
    );
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
    isDataStale,
  };
}

// ============================================================================
// Legacy Compatibility Hook
// ============================================================================

/**
 * Legacy-compatible hook that matches the old useChannelSummaries interface.
 * Use useChannelSummariesQuery for new code.
 */
export function useChannelSummariesLegacy(
  organizationId: string,
  startDate: string,
  endDate: string
) {
  const { data, isLoading, error } = useChannelSummariesQuery(
    organizationId,
    startDate,
    endDate
  );

  // Return structure matching old useChannelSummaries hook
  return {
    meta: {
      spend: data?.meta.spend ?? 0,
      conversions: data?.meta.conversions ?? 0,
      roas: data?.meta.roas ?? 0,
      hasConversionValueData: data?.meta.hasConversionValueData ?? false,
      isLoading,
      lastDataDate: data?.meta.lastDataDate ?? null,
    },
    sms: {
      sent: data?.sms.sent ?? 0,
      raised: data?.sms.raised ?? 0,
      roi: data?.sms.roi ?? 0,
      isLoading,
      lastDataDate: data?.sms.lastDataDate ?? null,
      campaignCount: data?.sms.campaignCount ?? 0,
    },
    donations: {
      totalGross: data?.donations.totalGross ?? 0,
      totalNet: data?.donations.totalNet ?? 0,
      refundAmount: data?.donations.refundAmount ?? 0,
      refundCount: data?.donations.refundCount ?? 0,
      donors: data?.donations.donors ?? 0,
      avgNet: data?.donations.avgNet ?? 0,
      isLoading,
      lastDataDate: data?.donations.lastDataDate ?? null,
    },
    error,
  };
}
