import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { metaKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, subDays, parseISO } from "date-fns";

export interface MetaCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string;
  daily_budget: number;
  lifetime_budget: number;
}

export interface MetaMetrics {
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  reach: number;
  cpc: number;
  ctr: number;
  roas: number;
  cpm: number;
}

export interface MetaDailyMetric {
  date: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

export interface MetaAdsMetricsResult {
  campaigns: MetaCampaign[];
  metrics: Record<string, MetaMetrics>;
  dailyMetrics: MetaDailyMetric[];
  previousPeriodMetrics: Record<string, MetaMetrics>;
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    conversion_value: number;
    reach: number;
  };
  previousTotals: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    conversion_value: number;
    reach: number;
  };
}

function aggregateMetrics(data: any[]): Record<string, MetaMetrics> {
  const aggregated: Record<string, MetaMetrics> = {};
  data?.forEach((metric) => {
    if (!aggregated[metric.campaign_id]) {
      aggregated[metric.campaign_id] = {
        campaign_id: metric.campaign_id,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversion_value: 0,
        reach: 0,
        cpc: 0,
        ctr: 0,
        roas: 0,
        cpm: 0,
      };
    }
    aggregated[metric.campaign_id].impressions += metric.impressions || 0;
    aggregated[metric.campaign_id].clicks += metric.clicks || 0;
    aggregated[metric.campaign_id].spend += Number(metric.spend || 0);
    aggregated[metric.campaign_id].conversions += metric.conversions || 0;
    aggregated[metric.campaign_id].conversion_value += Number(metric.conversion_value || 0);
    aggregated[metric.campaign_id].reach += metric.reach || 0;
  });

  // Calculate derived metrics
  Object.values(aggregated).forEach((metric) => {
    if (metric.clicks > 0) metric.cpc = metric.spend / metric.clicks;
    if (metric.impressions > 0) {
      metric.ctr = (metric.clicks / metric.impressions) * 100;
      metric.cpm = (metric.spend / metric.impressions) * 1000;
    }
    if (metric.spend > 0) metric.roas = metric.conversion_value / metric.spend;
  });

  return aggregated;
}

function aggregateDailyMetrics(data: any[]): MetaDailyMetric[] {
  const byDate: Record<string, MetaDailyMetric> = {};
  data?.forEach((metric) => {
    const date = metric.date;
    if (!byDate[date]) {
      byDate[date] = { date, spend: 0, conversions: 0, impressions: 0, clicks: 0 };
    }
    byDate[date].spend += Number(metric.spend || 0);
    byDate[date].conversions += metric.conversions || 0;
    byDate[date].impressions += metric.impressions || 0;
    byDate[date].clicks += metric.clicks || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateTotals(metrics: Record<string, MetaMetrics>) {
  return Object.values(metrics).reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      spend: acc.spend + m.spend,
      conversions: acc.conversions + m.conversions,
      conversion_value: acc.conversion_value + m.conversion_value,
      reach: acc.reach + m.reach,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, reach: 0 }
  );
}

async function fetchMetaAdsMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<MetaAdsMetricsResult> {
  // Calculate previous period
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, daysDiff);

  // Parallel fetch all data
  const [campaignRes, currentMetricsRes, prevMetricsRes] = await Promise.all([
    supabase
      .from("meta_campaigns")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("meta_ad_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
    supabase
      .from("meta_ad_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", format(prevStart, "yyyy-MM-dd"))
      .lte("date", format(prevEnd, "yyyy-MM-dd")),
  ]);

  if (campaignRes.error) throw campaignRes.error;
  if (currentMetricsRes.error) throw currentMetricsRes.error;

  const campaigns = campaignRes.data || [];
  const metrics = aggregateMetrics(currentMetricsRes.data || []);
  const dailyMetrics = aggregateDailyMetrics(currentMetricsRes.data || []);
  const previousPeriodMetrics = aggregateMetrics(prevMetricsRes.data || []);
  const totals = calculateTotals(metrics);
  const previousTotals = calculateTotals(previousPeriodMetrics);

  return {
    campaigns,
    metrics,
    dailyMetrics,
    previousPeriodMetrics,
    totals,
    previousTotals,
  };
}

export function useMetaAdsMetricsQuery(
  organizationId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  const globalDateRange = useDateRange();

  // Use provided dates if available, otherwise fall back to global date range
  const effectiveStartDate = startDate ?? globalDateRange.startDate;
  const effectiveEndDate = endDate ?? globalDateRange.endDate;

  return useQuery({
    queryKey: metaKeys.metrics(organizationId || "", { startDate: effectiveStartDate, endDate: effectiveEndDate }),
    queryFn: () =>
      fetchMetaAdsMetrics(organizationId!, effectiveStartDate, effectiveEndDate),
    enabled: !!organizationId && !!effectiveStartDate && !!effectiveEndDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
