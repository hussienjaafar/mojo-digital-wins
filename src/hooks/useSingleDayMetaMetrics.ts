/**
 * useSingleDayMetaMetrics
 * 
 * Hook to fetch single-day Meta Ads metrics with previous day comparison.
 * Uses meta_ad_metrics_daily for accurate link click data.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { subDays, format } from "date-fns";

interface MetaDayMetrics {
  spend: number;
  impressions: number;
  linkClicks: number;
  conversions: number;
  conversionValue: number;
}

export interface SingleDayMetaData {
  current: MetaDayMetrics;
  previous: MetaDayMetrics;
}

async function fetchDayMetaMetrics(
  organizationId: string,
  date: string
): Promise<MetaDayMetrics> {
  const { data, error } = await supabase
    .from('meta_ad_metrics_daily')
    .select('spend, impressions, link_clicks, conversions, conversion_value')
    .eq('organization_id', organizationId)
    .eq('date', date);

  if (error) throw error;

  // Aggregate all rows for the day (multiple ads/campaigns)
  return (data || []).reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      impressions: acc.impressions + Number(row.impressions || 0),
      linkClicks: acc.linkClicks + Number(row.link_clicks || 0),
      conversions: acc.conversions + Number(row.conversions || 0),
      conversionValue: acc.conversionValue + Number(row.conversion_value || 0),
    }),
    { spend: 0, impressions: 0, linkClicks: 0, conversions: 0, conversionValue: 0 }
  );
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
