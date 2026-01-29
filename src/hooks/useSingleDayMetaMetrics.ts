/**
 * useSingleDayMetaMetrics
 * 
 * Hook to fetch single-day Meta Ads metrics with previous day comparison.
 * Uses meta_ad_metrics_daily for ad performance data and get_actblue_dashboard_metrics
 * RPC for consistent attribution data that matches the multi-day view.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { subDays, format } from "date-fns";

interface MetaDayMetrics {
  // From meta_ad_metrics_daily
  spend: number;
  impressions: number;
  linkClicks: number;
  
  // From our attribution system (for display)
  ourAttributedRevenue: number;
  ourAttributedDonations: number;
}

export interface SingleDayMetaData {
  current: MetaDayMetrics;
  previous: MetaDayMetrics;
}

async function fetchDayMetaMetrics(
  organizationId: string,
  date: string
): Promise<MetaDayMetrics> {
  // Query 1: Meta ad metrics from meta_ad_metrics_daily
  const metricsQuery = supabase
    .from('meta_ad_metrics_daily')
    .select('spend, impressions, link_clicks')
    .eq('organization_id', organizationId)
    .eq('date', date);

  // Query 2: Our attribution via RPC (same source as multi-day view)
  const attributionQuery = supabase.rpc('get_actblue_dashboard_metrics', {
    p_organization_id: organizationId,
    p_start_date: date,
    p_end_date: date,
    p_campaign_id: null,
    p_creative_id: null,
    p_use_utc: false, // Use Eastern Time to match Hero KPIs and ActBlue dashboard
  });

  const [metricsResult, attributionResult] = await Promise.all([
    metricsQuery,
    attributionQuery,
  ]);

  if (metricsResult.error) throw metricsResult.error;
  if (attributionResult.error) throw attributionResult.error;

  // Aggregate all rows for the day (multiple ads/campaigns)
  const metaMetrics = (metricsResult.data || []).reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      impressions: acc.impressions + Number(row.impressions || 0),
      linkClicks: acc.linkClicks + Number(row.link_clicks || 0),
    }),
    { spend: 0, impressions: 0, linkClicks: 0 }
  );

  // Extract Meta channel from our attribution system
  const attributionData = attributionResult.data as { channels?: Array<{ channel: string; revenue: number; count: number }> } | null;
  const channels = attributionData?.channels || [];
  const metaChannel = channels.find((c) => c.channel === 'meta');

  return {
    spend: metaMetrics.spend,
    impressions: metaMetrics.impressions,
    linkClicks: metaMetrics.linkClicks,
    ourAttributedRevenue: metaChannel?.revenue || 0,
    ourAttributedDonations: metaChannel?.count || 0,
  };
}

export function useSingleDayMetaMetrics(organizationId: string | undefined) {
  const { startDate } = useDateRange();
  const previousDate = format(subDays(new Date(startDate), 1), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['single-day-meta', organizationId, startDate],
    queryFn: async (): Promise<SingleDayMetaData> => {
      const [current, previous] = await Promise.all([
        fetchDayMetaMetrics(organizationId!, startDate),
        fetchDayMetaMetrics(organizationId!, previousDate),
      ]);
      return { current, previous };
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}
