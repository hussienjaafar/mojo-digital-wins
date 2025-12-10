import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { channelKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";

export interface ChannelSummary {
  channel: "donations" | "meta" | "sms";
  label: string;
  totalRevenue: number;
  totalSpend: number;
  transactions: number;
  roi: number;
  trend: number;
  isLoading?: boolean;
}

interface ChannelSummariesResult {
  donations: ChannelSummary;
  meta: ChannelSummary;
  sms: ChannelSummary;
  totals: {
    revenue: number;
    spend: number;
    roi: number;
  };
}

async function fetchChannelSummaries(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ChannelSummariesResult> {
  // Parallel fetch all channel data
  const [donationsResult, metaResult, smsResult] = await Promise.all([
    // Donations
    supabase
      .from("actblue_transactions")
      .select("amount, net_amount, transaction_type")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate),

    // Meta Ads
    supabase
      .from("meta_ad_metrics")
      .select("spend, impressions, clicks, conversions")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate),

    // SMS
    supabase
      .from("sms_campaigns")
      .select("cost, messages_sent, opt_outs")
      .eq("organization_id", organizationId)
      .gte("send_date", startDate)
      .lte("send_date", endDate),
  ]);

  // Process donations
  const donations = donationsResult.data || [];
  const donationRevenue = donations.reduce(
    (sum, d) => sum + (d.net_amount || d.amount || 0),
    0
  );

  // Process Meta
  const metaData = metaResult.data || [];
  const metaSpend = metaData.reduce((sum, m) => sum + (m.spend || 0), 0);
  const metaConversions = metaData.reduce((sum, m) => sum + (m.conversions || 0), 0);

  // Process SMS
  const smsData = smsResult.data || [];
  const smsSpend = smsData.reduce((sum, s) => sum + (s.cost || 0), 0);
  const smsSent = smsData.reduce((sum, s) => sum + (s.messages_sent || 0), 0);

  // Calculate ROIs
  const totalSpend = metaSpend + smsSpend;
  const totalRevenue = donationRevenue;

  const calcROI = (revenue: number, spend: number) =>
    spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

  return {
    donations: {
      channel: "donations",
      label: "Donations",
      totalRevenue: donationRevenue,
      totalSpend: 0,
      transactions: donations.length,
      roi: 0, // N/A for donations
      trend: 0, // TODO: Calculate from previous period
    },
    meta: {
      channel: "meta",
      label: "Meta Ads",
      totalRevenue: 0, // Attribution needed
      totalSpend: metaSpend,
      transactions: metaConversions,
      roi: 0, // Needs attribution
      trend: 0,
    },
    sms: {
      channel: "sms",
      label: "SMS",
      totalRevenue: 0, // Attribution needed
      totalSpend: smsSpend,
      transactions: smsSent,
      roi: 0, // Needs attribution
      trend: 0,
    },
    totals: {
      revenue: totalRevenue,
      spend: totalSpend,
      roi: calcROI(totalRevenue, totalSpend),
    },
  };
}

export function useChannelSummariesQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: channelKeys.summaries(organizationId || "", dateRange),
    queryFn: () =>
      fetchChannelSummaries(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
