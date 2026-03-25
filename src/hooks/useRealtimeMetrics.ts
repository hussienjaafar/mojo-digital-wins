import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaMetric {
  id: string;
  date: string;
  campaign_id: string;
  ad_set_id: string | null;
  ad_id: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  conversions: number | null;
  conversion_value: number | null;
  roas: number | null;
  ad_creative_id: string | null;
  ad_creative_name: string | null;
  creative_type: string | null;
  placement: string | null;
  device_platform: string | null;
  frequency: number | null;
  relevance_score: number | null;
  cost_per_result: number | null;
}

export interface SMSMetric {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  status: string | null;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number | null;
  opt_outs: number | null;
  clicks: number | null;
  conversions: number | null;
  amount_raised: number | null;
  cost: number | null;
  message_text: string | null;
  phone_list_name: string | null;
  replies: number | null;
  skipped: number | null;
  previously_opted_out: number | null;
  send_date: string | null;
}

export interface Transaction {
  id: string;
  transaction_date: string;
  amount: number;
  net_amount: number | null;
  is_recurring: boolean | null;
  refcode: string | null;
  donor_email: string | null;
  donor_name: string | null;
}

export interface ROIAnalytic {
  id: string;
  campaign_id: string | null;
  date: string | null;
  platform: string;
  first_touch_attribution: number | null;
  last_touch_attribution: number | null;
  linear_attribution: number | null;
  position_based_attribution: number | null;
  time_decay_attribution: number | null;
  ltv_roi: number | null;
  campaign_roas: number | null;
}

export interface RealtimeMetricsResult {
  metaMetrics: MetaMetric[];
  smsMetrics: SMSMetric[];
  transactions: Transaction[];
  roiAnalytics: ROIAnalytic[];
  isLoading: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  error: Error | null;
}

export function useRealtimeMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): RealtimeMetricsResult {
  // Fetch Meta ad metrics
  const metaQuery = useQuery({
    queryKey: ["realtime-metrics", "meta", organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_metrics")
        .select(`
          id, date, campaign_id, ad_set_id, ad_id, 
          impressions, clicks, spend, reach, cpc, cpm, ctr, 
          conversions, conversion_value, roas,
          ad_creative_id, ad_creative_name, creative_type,
          placement, device_platform, frequency, relevance_score, cost_per_result
        `)
        .eq("organization_id", organizationId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw error;
      return (data || []) as MetaMetric[];
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch SMS campaign metrics
  const smsQuery = useQuery({
    queryKey: ["realtime-metrics", "sms", organizationId, startDate, endDate],
    queryFn: async () => {
      // Note: We use .or() with date casting for proper timestamp comparison
      // since send_date is timestamptz and startDate/endDate are date strings
      const { data, error } = await supabase
        .from("sms_campaigns")
        .select(`
          id, campaign_id, campaign_name, status,
          messages_sent, messages_delivered, messages_failed, opt_outs,
          clicks, conversions, amount_raised, cost,
          message_text, phone_list_name, replies, skipped, previously_opted_out, send_date
        `)
        .eq("organization_id", organizationId)
        .gte("send_date", `${startDate}T00:00:00Z`)
        .lte("send_date", `${endDate}T23:59:59Z`)
        .order("send_date", { ascending: false });

      if (error) throw error;
      return (data || []) as SMSMetric[];
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch transactions (using the secure view)
  const transactionsQuery = useQuery({
    queryKey: ["realtime-metrics", "transactions", organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actblue_transactions_secure")
        .select("id, transaction_date, amount, net_amount, is_recurring, refcode, donor_email, donor_name")
        .eq("organization_id", organizationId)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: true });

      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch ROI analytics for attribution
  const roiQuery = useQuery({
    queryKey: ["realtime-metrics", "roi", organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roi_analytics")
        .select(`
          id, campaign_id, date, platform,
          first_touch_attribution, last_touch_attribution, linear_attribution,
          position_based_attribution, time_decay_attribution,
          ltv_roi, campaign_roas
        `)
        .eq("organization_id", organizationId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;
      return (data || []) as ROIAnalytic[];
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = metaQuery.isLoading || smsQuery.isLoading || transactionsQuery.isLoading || roiQuery.isLoading;
  const error = metaQuery.error || smsQuery.error || transactionsQuery.error || roiQuery.error;

  // Calculate lastUpdate from the most recent dataUpdatedAt
  const lastUpdate = [
    metaQuery.dataUpdatedAt,
    smsQuery.dataUpdatedAt,
    transactionsQuery.dataUpdatedAt,
    roiQuery.dataUpdatedAt,
  ].reduce((latest, current) => Math.max(latest, current), 0);

  return {
    metaMetrics: metaQuery.data || [],
    smsMetrics: smsQuery.data || [],
    transactions: transactionsQuery.data || [],
    roiAnalytics: roiQuery.data || [],
    isLoading,
    isConnected: !isLoading && !error,
    lastUpdate: lastUpdate ? new Date(lastUpdate) : null,
    error: error as Error | null,
  };
}
