import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { metaKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, subDays, parseISO } from "date-fns";
import { STALE_TIMES, GC_TIMES } from "@/lib/query-config";

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
  // Link-specific metrics (accurate for CPC calculation)
  link_clicks: number;
  link_ctr: number;
  link_cpc: number;
}

export interface MetaDailyMetric {
  date: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
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
    link_clicks: number;
    link_ctr: number;
    link_cpc: number;
  };
  previousTotals: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    conversion_value: number;
    reach: number;
    link_clicks: number;
    link_ctr: number;
    link_cpc: number;
  };
  /** True if using fallback campaign-level data (less accurate) */
  isEstimated: boolean;
  /** Latest date with data available */
  latestDataDate: string | null;
  /** Attributed revenue from unified ActBlue/refcode attribution (our source of truth) */
  attributedRevenue: number;
  /** Attributed ROI based on our attribution data */
  attributedROI: number;
  /** Previous period attributed revenue */
  previousAttributedRevenue: number;
  /** Previous period attributed ROI */
  previousAttributedROI: number;
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
        link_clicks: 0,
        link_ctr: 0,
        link_cpc: 0,
      };
    }
    aggregated[metric.campaign_id].impressions += metric.impressions || 0;
    aggregated[metric.campaign_id].clicks += metric.clicks || 0;
    aggregated[metric.campaign_id].spend += Number(metric.spend || 0);
    aggregated[metric.campaign_id].conversions += metric.conversions || 0;
    aggregated[metric.campaign_id].conversion_value += Number(metric.conversion_value || 0);
    aggregated[metric.campaign_id].reach += metric.reach || 0;
    aggregated[metric.campaign_id].link_clicks += metric.link_clicks || 0;
  });

  // Calculate derived metrics
  Object.values(aggregated).forEach((metric) => {
    // Total clicks-based (all engagement)
    if (metric.clicks > 0) metric.cpc = metric.spend / metric.clicks;
    if (metric.impressions > 0) {
      metric.ctr = (metric.clicks / metric.impressions) * 100;
      metric.cpm = (metric.spend / metric.impressions) * 1000;
    }
    if (metric.spend > 0) metric.roas = metric.conversion_value / metric.spend;
    
    // Link clicks-based (accurate CPC)
    if (metric.link_clicks > 0) {
      metric.link_cpc = metric.spend / metric.link_clicks;
      if (metric.impressions > 0) {
        metric.link_ctr = (metric.link_clicks / metric.impressions) * 100;
      }
    }
  });

  return aggregated;
}

function aggregateDailyMetrics(data: any[]): MetaDailyMetric[] {
  const byDate: Record<string, MetaDailyMetric> = {};
  data?.forEach((metric) => {
    const date = metric.date;
    if (!byDate[date]) {
      byDate[date] = { date, spend: 0, conversions: 0, impressions: 0, clicks: 0, link_clicks: 0 };
    }
    byDate[date].spend += Number(metric.spend || 0);
    byDate[date].conversions += metric.conversions || 0;
    byDate[date].impressions += metric.impressions || 0;
    byDate[date].clicks += metric.clicks || 0;
    byDate[date].link_clicks += metric.link_clicks || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateTotals(metrics: Record<string, MetaMetrics>) {
  const base = Object.values(metrics).reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      spend: acc.spend + m.spend,
      conversions: acc.conversions + m.conversions,
      conversion_value: acc.conversion_value + m.conversion_value,
      reach: acc.reach + m.reach,
      link_clicks: acc.link_clicks + m.link_clicks,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, reach: 0, link_clicks: 0 }
  );
  
  // Calculate derived link metrics
  const link_ctr = base.impressions > 0 ? (base.link_clicks / base.impressions) * 100 : 0;
  const link_cpc = base.link_clicks > 0 ? base.spend / base.link_clicks : 0;
  
  return {
    ...base,
    link_ctr,
    link_cpc,
  };
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

  // Fetch campaigns, ad-level metrics, and unified attribution in parallel
  const [campaignRes, adLevelMetricsRes, attributionRes, prevAttributionRes] = await Promise.all([
    supabase
      .from("meta_campaigns")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("meta_ad_metrics_daily")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
    // Unified attribution RPC - same source as Hero KPIs and Performance Overview
    supabase.rpc('get_actblue_dashboard_metrics', {
      p_organization_id: organizationId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_use_utc: false, // Eastern Time for consistency
    }),
    // Previous period attribution
    supabase.rpc('get_actblue_dashboard_metrics', {
      p_organization_id: organizationId,
      p_start_date: format(prevStart, "yyyy-MM-dd"),
      p_end_date: format(prevEnd, "yyyy-MM-dd"),
      p_use_utc: false,
    }),
  ]);

  if (campaignRes.error) throw campaignRes.error;
  if (adLevelMetricsRes.error) throw adLevelMetricsRes.error;

  const campaigns = campaignRes.data || [];
  let isEstimated = false;
  let metricsData: any[] = (adLevelMetricsRes.data || []) as any[];
  let latestDataDate: string | null = null;

  // If no ad-level data, fall back to campaign-level metrics
  if (metricsData.length === 0) {
    const fallbackRes = await supabase
      .from("meta_ad_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    
    if (fallbackRes.error) throw fallbackRes.error;
    metricsData = fallbackRes.data as any[] ?? [];
    isEstimated = true;
  }

  // Determine latest data date
  if (metricsData.length > 0) {
    latestDataDate = metricsData[metricsData.length - 1].date;
  }

  // Fetch previous period metrics (use same source for consistency)
  let prevMetricsData: any[] = [];
  if (isEstimated) {
    const prevRes = await supabase
      .from("meta_ad_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", format(prevStart, "yyyy-MM-dd"))
      .lte("date", format(prevEnd, "yyyy-MM-dd"));
    prevMetricsData = prevRes.data || [];
  } else {
    const prevRes = await supabase
      .from("meta_ad_metrics_daily")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", format(prevStart, "yyyy-MM-dd"))
      .lte("date", format(prevEnd, "yyyy-MM-dd"));
    prevMetricsData = prevRes.data || [];
  }

  const metrics = aggregateMetrics(metricsData);
  const dailyMetrics = aggregateDailyMetrics(metricsData);
  const previousPeriodMetrics = aggregateMetrics(prevMetricsData);
  const totals = calculateTotals(metrics);
  const previousTotals = calculateTotals(previousPeriodMetrics);

  // Extract Meta-attributed revenue from unified attribution RPC
  // This uses the same source of truth as Hero KPIs and Performance Overview
  const attributionData = attributionRes.data as { channels?: Array<{ channel: string; revenue: number }> } | null;
  const metaChannel = attributionData?.channels?.find((c: { channel: string }) => c.channel === 'meta');
  const attributedRevenue = metaChannel?.revenue || 0;
  const attributedROI = totals.spend > 0 ? attributedRevenue / totals.spend : 0;

  // Previous period attribution
  const prevAttributionData = prevAttributionRes.data as { channels?: Array<{ channel: string; revenue: number }> } | null;
  const prevMetaChannel = prevAttributionData?.channels?.find((c: { channel: string }) => c.channel === 'meta');
  const previousAttributedRevenue = prevMetaChannel?.revenue || 0;
  const previousAttributedROI = previousTotals.spend > 0 ? previousAttributedRevenue / previousTotals.spend : 0;

  return {
    campaigns,
    metrics,
    dailyMetrics,
    previousPeriodMetrics,
    totals,
    previousTotals,
    isEstimated,
    latestDataDate,
    attributedRevenue,
    attributedROI,
    previousAttributedRevenue,
    previousAttributedROI,
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
    staleTime: STALE_TIMES.dashboard, // Consistent with other dashboard hooks
    gcTime: GC_TIMES.dashboard,
  });
}
