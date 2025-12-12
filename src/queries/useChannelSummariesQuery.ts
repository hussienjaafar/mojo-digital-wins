import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { data, error } = await supabase
    .from("sms_campaigns")
    .select("messages_sent, amount_raised, cost, send_date, status")
    .eq("organization_id", organizationId)
    .gte("send_date", startDate)
    .lte("send_date", `${endDate}T23:59:59`)
    .neq("status", "draft")
    .order("send_date", { ascending: false });

  if (error) {
    console.error("[useChannelSummariesQuery] SMS fetch error:", error);
    throw error;
  }

  const campaigns = data || [];
  const sent = campaigns.reduce((sum, c) => sum + (c.messages_sent || 0), 0);
  const raised = campaigns.reduce((sum, c) => sum + Number(c.amount_raised || 0), 0);
  const cost = campaigns.reduce((sum, c) => sum + Number(c.cost || 0), 0);
  const roi = cost > 0 ? raised / cost : 0;
  const lastDataDate = campaigns[0]?.send_date?.split("T")[0] || null;

  return {
    sent,
    raised,
    cost,
    roi,
    campaignCount: campaigns.length,
    lastDataDate,
    hasData: campaigns.length > 0,
  };
}

async function fetchDonationsSummary(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonationsSummary> {
  // Using secure view for defense-in-depth PII protection
  const { data, error } = await supabase
    .from("actblue_transactions_secure")
    .select("amount, net_amount, donor_email, donor_id_hash, transaction_date, transaction_type")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", `${endDate}T23:59:59`)
    .order("transaction_date", { ascending: false });

  if (error) {
    console.error("[useChannelSummariesQuery] Donations fetch error:", error);
    throw error;
  }

  const transactions = data || [];
  const totalGross = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalNet = transactions.reduce((sum, t) => sum + Number(t.net_amount ?? t.amount ?? 0), 0);

  const refunds = transactions.filter((t) => t.transaction_type === "refund");
  const refundAmount = refunds.reduce((sum, t) => sum + Math.abs(Number(t.net_amount ?? t.amount ?? 0)), 0);
  const refundCount = refunds.length;

  const uniqueDonors = new Set(
    transactions.map((d) => d.donor_id_hash || d.donor_email)
  ).size;

  const avgNet = transactions.length > 0 ? totalNet / transactions.length : 0;
  const lastDataDate = transactions[0]?.transaction_date?.split("T")[0] || null;

  return {
    totalGross,
    totalNet,
    refundAmount,
    refundCount,
    donors: uniqueDonors,
    avgNet,
    transactionCount: transactions.length,
    lastDataDate,
    hasData: transactions.length > 0,
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
   * Check if data is stale - i.e., if the last data date is older than the selected range end
   */
  const isDataStale = (endDateToCheck: string): boolean => {
    if (!query.data) return false;

    const { meta, sms, donations } = query.data;
    const dates = [meta.lastDataDate, sms.lastDataDate, donations.lastDataDate].filter(Boolean);

    if (dates.length === 0) return true;

    const mostRecentDate = dates.sort().reverse()[0]!;
    return mostRecentDate < endDateToCheck;
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
