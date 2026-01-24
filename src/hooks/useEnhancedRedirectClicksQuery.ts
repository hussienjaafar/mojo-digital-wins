import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/metricDefinitions";

// ============================================================================
// Types
// ============================================================================

export type AttributionType = 'click_id' | 'refcode' | 'none';

export interface RefcodePerformance {
  refcode: string;
  totalClicks: number;
  uniqueSessions: number;
  metaAdClicks: number;
  withFbp: number;
  withFbc: number;
  cookieCaptureRate: number;
  avgCaptureScore: number;
  conversions: number;
  attributedConversions: number;
  revenue: number;
  attributedRevenue: number;
  conversionRate: number;
  attributionType: AttributionType;
}

export interface CampaignPerformance {
  campaign: string;
  totalClicks: number;
  uniqueSessions: number;
  metaAdClicks: number;
  cookieCaptureRate: number;
  conversions: number;
  revenue: number;
}

export interface DailyClickData {
  date: string;
  clicks: number;
  metaClicks: number;
  sessions: number;
  avgCaptureScore: number;
}

export interface HourlyClickData {
  hour: number;
  clicks: number;
  metaClicks: number;
}

export interface TrafficSourceBreakdown {
  mobile: number;
  desktop: number;
  other: number;
}

export interface EnhancedClicksSummary {
  totalClicks: number;
  uniqueSessions: number;
  metaAdClicks: number;
  cookieCaptureRate: number;
  avgCaptureScore: number;
  conversions: number;
  attributedRevenue: number;
  conversionRate: number;
}

export interface EnhancedRedirectClicksData {
  summary: EnhancedClicksSummary;
  byRefcode: RefcodePerformance[];
  byCampaign: CampaignPerformance[];
  byTrafficSource: TrafficSourceBreakdown;
  dailyTrend: DailyClickData[];
  hourlyTrend: HourlyClickData[];
  isSingleDay: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

export const enhancedRedirectClicksKeys = {
  all: ["enhanced-redirect-clicks"] as const,
  byOrg: (orgId: string | undefined, startDate: string, endDate: string) =>
    [...enhancedRedirectClicksKeys.all, orgId, startDate, endDate] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

const parseMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata as Record<string, unknown>;
  return {};
};

const detectTrafficSource = (referrer: string | undefined): "mobile" | "desktop" | "other" => {
  if (!referrer) return "other";
  const r = referrer.toLowerCase();
  if (r.includes("m.facebook.com") || r.includes("instagram") || r.includes("lm.facebook.com")) return "mobile";
  if (r.includes("l.facebook.com") || r.includes("facebook.com")) return "desktop";
  return "other";
};

// ============================================================================
// Data Fetching - Using Database RPCs for Accurate Attribution
// ============================================================================

async function fetchEnhancedRedirectClicks(
  organizationId?: string,
  startDate?: string,
  endDate?: string
): Promise<EnhancedRedirectClicksData> {
  // Default to last 30 days if no dates provided
  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();

  const isSingleDay = start === end;

  // If no organization, return empty state
  if (!organizationId) {
    return emptyState(isSingleDay);
  }

  // Call database RPCs for accurate Click ID matching
  const [summaryResult, metricsResult] = await Promise.all([
    supabase.rpc('get_link_tracking_summary', {
      p_organization_id: organizationId,
      p_start_date: start,
      p_end_date: end
    }),
    supabase.rpc('get_link_tracking_metrics', {
      p_organization_id: organizationId,
      p_start_date: start,
      p_end_date: end
    })
  ]);

  if (summaryResult.error) {
    console.error("Error fetching link tracking summary:", summaryResult.error);
    throw summaryResult.error;
  }

  if (metricsResult.error) {
    console.error("Error fetching link tracking metrics:", metricsResult.error);
    throw metricsResult.error;
  }

  const summaryData = summaryResult.data?.[0];
  const metricsData = metricsResult.data || [];

  // Fetch touchpoints for trend data and traffic source breakdown
  const tz = DEFAULT_ORG_TIMEZONE;
  const startUtc = fromZonedTime(`${start}T00:00:00`, tz).toISOString();
  const endExclusiveDay = format(addDays(parseISO(end), 1), "yyyy-MM-dd");
  const endExclusiveUtc = fromZonedTime(`${endExclusiveDay}T00:00:00`, tz).toISOString();

  const { data: touchpoints, error: touchpointsError } = await supabase
    .from("attribution_touchpoints")
    .select("occurred_at, metadata, utm_campaign, refcode")
    .eq("organization_id", organizationId)
    .gte("occurred_at", startUtc)
    .lt("occurred_at", endExclusiveUtc)
    .order("occurred_at", { ascending: false });

  if (touchpointsError) {
    console.error("Error fetching touchpoints for trends:", touchpointsError);
    throw touchpointsError;
  }

  // Return empty state if no data
  if (!touchpoints || touchpoints.length === 0) {
    return emptyState(isSingleDay);
  }

  // Process touchpoints for trends and traffic source
  const dailyMap = new Map<string, DailyClickData>();
  const hourlyMap = new Map<number, HourlyClickData>();
  const trafficSource: TrafficSourceBreakdown = { mobile: 0, desktop: 0, other: 0 };
  const campaignMap = new Map<string, CampaignPerformance>();
  const dailySessionMap = new Map<string, Set<string>>();
  const dailyCaptureScores = new Map<string, { total: number; count: number }>();
  const campaignSessionMap = new Map<string, Set<string>>();
  const refcodeToCampaign = new Map<string, string>();

  let totalCaptureScore = 0;
  let captureScoreCount = 0;

  touchpoints.forEach((tp) => {
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;
    const referrer = meta.referrer as string;
    const captureScore = (meta.capture_score as number) || 0;
    const hasFbclid = !!(meta.fbclid || meta.fbc);
    const date = tp.occurred_at.split("T")[0];
    const hour = new Date(tp.occurred_at).getHours();
    const source = detectTrafficSource(referrer);
    const campaign = tp.utm_campaign || "(no campaign)";
    const refcode = tp.refcode || "(no refcode)";

    // Track capture score
    if (captureScore > 0) {
      totalCaptureScore += captureScore;
      captureScoreCount++;
    }

    // Traffic source
    trafficSource[source]++;

    // Refcode to campaign mapping
    if (refcode !== "(no refcode)" && campaign !== "(no campaign)") {
      refcodeToCampaign.set(refcode, campaign);
    }

    // Aggregate by campaign
    if (!campaignMap.has(campaign)) {
      campaignMap.set(campaign, {
        campaign,
        totalClicks: 0,
        uniqueSessions: 0,
        metaAdClicks: 0,
        cookieCaptureRate: 0,
        conversions: 0,
        revenue: 0,
      });
      campaignSessionMap.set(campaign, new Set());
    }
    const campEntry = campaignMap.get(campaign)!;
    campEntry.totalClicks++;
    if (hasFbclid) campEntry.metaAdClicks++;
    if (sessionId) campaignSessionMap.get(campaign)!.add(sessionId);

    // Daily trend
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        clicks: 0,
        metaClicks: 0,
        sessions: 0,
        avgCaptureScore: 0,
      });
      dailySessionMap.set(date, new Set());
      dailyCaptureScores.set(date, { total: 0, count: 0 });
    }
    const dayEntry = dailyMap.get(date)!;
    dayEntry.clicks++;
    if (hasFbclid) dayEntry.metaClicks++;
    if (sessionId) dailySessionMap.get(date)!.add(sessionId);
    if (captureScore > 0) {
      const scores = dailyCaptureScores.get(date)!;
      scores.total += captureScore;
      scores.count++;
    }

    // Hourly trend
    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, { hour, clicks: 0, metaClicks: 0 });
    }
    const hourEntry = hourlyMap.get(hour)!;
    hourEntry.clicks++;
    if (hasFbclid) hourEntry.metaClicks++;
  });

  // Calculate daily sessions and capture scores
  dailyMap.forEach((entry, date) => {
    const sessions = dailySessionMap.get(date);
    entry.sessions = sessions ? sessions.size : entry.clicks;
    const scores = dailyCaptureScores.get(date);
    entry.avgCaptureScore = scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0;
  });

  // Calculate campaign sessions and aggregate conversions from RPC data
  campaignMap.forEach((entry, campaign) => {
    const sessions = campaignSessionMap.get(campaign);
    entry.uniqueSessions = sessions ? sessions.size : entry.totalClicks;
    // Calculate campaign-level cookie rate based on its clicks
    const totalWithCookies = metricsData.reduce((sum: number, m: Record<string, unknown>) => {
      if (refcodeToCampaign.get(m.refcode as string) === campaign) {
        return sum + ((m.with_fbp as number) || 0) + ((m.with_fbc as number) || 0);
      }
      return sum;
    }, 0);
    entry.cookieCaptureRate = entry.totalClicks > 0 
      ? Math.round((totalWithCookies / entry.totalClicks) * 100) 
      : 0;
  });

  // Aggregate campaign-level conversions from refcode metrics
  metricsData.forEach((m: Record<string, unknown>) => {
    const refcode = m.refcode as string;
    const campaign = refcodeToCampaign.get(refcode);
    if (campaign && campaignMap.has(campaign)) {
      const campEntry = campaignMap.get(campaign)!;
      campEntry.conversions += (m.conversions as number) || 0;
      campEntry.revenue += (m.revenue as number) || 0;
    }
  });

  // Transform RPC metrics to RefcodePerformance
  const byRefcode: RefcodePerformance[] = metricsData.map((m: Record<string, unknown>) => ({
    refcode: m.refcode as string,
    totalClicks: (m.total_clicks as number) || 0,
    uniqueSessions: (m.unique_sessions as number) || 0,
    metaAdClicks: (m.meta_ad_clicks as number) || 0,
    withFbp: (m.with_fbp as number) || 0,
    withFbc: (m.with_fbc as number) || 0,
    cookieCaptureRate: (m.cookie_capture_rate as number) || 0,
    avgCaptureScore: 0, // Not tracked per-refcode from RPC
    conversions: (m.conversions as number) || 0,
    attributedConversions: (m.conversions as number) || 0,
    revenue: (m.revenue as number) || 0,
    attributedRevenue: (m.revenue as number) || 0,
    conversionRate: (m.total_clicks as number) > 0 && (m.conversions as number) > 0
      ? Math.round(((m.conversions as number) / (m.total_clicks as number)) * 100 * 100) / 100
      : -1, // -1 indicates N/A
    attributionType: (m.attribution_type as AttributionType) || 'none',
  }));

  const byCampaign = Array.from(campaignMap.values())
    .sort((a, b) => b.totalClicks - a.totalClicks);

  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyTrend = Array.from(hourlyMap.values())
    .sort((a, b) => a.hour - b.hour);

  return {
    summary: {
      totalClicks: (summaryData?.total_clicks as number) || 0,
      uniqueSessions: (summaryData?.unique_sessions as number) || 0,
      metaAdClicks: (summaryData?.meta_ad_clicks as number) || 0,
      cookieCaptureRate: (summaryData?.cookie_capture_rate as number) || 0,
      avgCaptureScore: captureScoreCount > 0 ? Math.round(totalCaptureScore / captureScoreCount) : 0,
      conversions: (summaryData?.conversions as number) || 0,
      attributedRevenue: (summaryData?.attributed_revenue as number) || 0,
      conversionRate: (summaryData?.conversion_rate as number) || 0,
    },
    byRefcode,
    byCampaign,
    byTrafficSource: trafficSource,
    dailyTrend,
    hourlyTrend,
    isSingleDay,
  };
}

function emptyState(isSingleDay: boolean): EnhancedRedirectClicksData {
  return {
    summary: {
      totalClicks: 0,
      uniqueSessions: 0,
      metaAdClicks: 0,
      cookieCaptureRate: 0,
      avgCaptureScore: 0,
      conversions: 0,
      attributedRevenue: 0,
      conversionRate: 0,
    },
    byRefcode: [],
    byCampaign: [],
    byTrafficSource: { mobile: 0, desktop: 0, other: 0 },
    dailyTrend: [],
    hourlyTrend: [],
    isSingleDay,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useEnhancedRedirectClicksQuery(
  organizationId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: enhancedRedirectClicksKeys.byOrg(organizationId, startDate || "", endDate || ""),
    queryFn: () => fetchEnhancedRedirectClicks(organizationId, startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
