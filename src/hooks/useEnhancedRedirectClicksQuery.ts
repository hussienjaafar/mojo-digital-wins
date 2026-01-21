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
  attributedConversions: number; // Matched via fbclid/refcode2
  revenue: number;
  attributedRevenue: number; // Revenue from attributed conversions
  conversionRate: number;
  attributionType: AttributionType; // Track how attribution was determined
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
  if (r.includes("m.facebook.com") || r.includes("instagram")) return "mobile";
  if (r.includes("l.facebook.com") || r.includes("lm.facebook.com") || r.includes("facebook.com")) return "desktop";
  return "other";
};

// ============================================================================
// Data Fetching
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

  // Convert local dates to UTC for database queries (timezone-aware)
  const tz = DEFAULT_ORG_TIMEZONE;
  const startUtc = fromZonedTime(`${start}T00:00:00`, tz).toISOString();
  const endExclusiveDay = format(addDays(parseISO(end), 1), "yyyy-MM-dd");
  const endExclusiveUtc = fromZonedTime(`${endExclusiveDay}T00:00:00`, tz).toISOString();

  // Fetch touchpoints
  let touchpointsQuery = supabase
    .from("attribution_touchpoints")
    .select("*")
    .gte("occurred_at", startUtc)
    .lt("occurred_at", endExclusiveUtc)
    .order("occurred_at", { ascending: false });

  if (organizationId) {
    touchpointsQuery = touchpointsQuery.eq("organization_id", organizationId);
  }

  // Fetch donations for conversion matching (include refcode2 for fbclid matching)
  let donationsQuery = supabase
    .from("actblue_transactions")
    .select("donor_email, refcode, refcode2, amount, transaction_date")
    .gte("transaction_date", startUtc)
    .lt("transaction_date", endExclusiveUtc);

  if (organizationId) {
    donationsQuery = donationsQuery.eq("organization_id", organizationId);
  }

  const [touchpointsResult, donationsResult] = await Promise.all([
    touchpointsQuery,
    donationsQuery,
  ]);

  if (touchpointsResult.error) {
    console.error("Error fetching touchpoints:", touchpointsResult.error);
    throw touchpointsResult.error;
  }

  const touchpoints = touchpointsResult.data || [];
  const donations = donationsResult.data || [];

  // Return empty state if no data
  if (touchpoints.length === 0) {
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

  // Build donation lookup by refcode only (for aggregate metrics)
  // This captures ALL donations for a refcode, not just those from tracked visitors
  const donationsByRefcode = new Map<string, { count: number; revenue: number }>();
  donations.forEach((d) => {
    const refcode = d.refcode || "";
    const existing = donationsByRefcode.get(refcode) || { count: 0, revenue: 0 };
    donationsByRefcode.set(refcode, {
      count: existing.count + 1,
      revenue: existing.revenue + (d.amount || 0),
    });
  });

  // Build fbclid prefix lookup from donations with refcode2
  // ActBlue stores fbclid in refcode2 with "fb_" prefix and truncated
  // Key insight: refcode2 contains the fbclid, and refcode contains the campaign refcode (refcode1)
  // We need to attribute conversions to refcode1 based on refcode2 matching
  const donationsByFbclidPrefix = new Map<string, { 
    refcode: string; // The campaign refcode (refcode1) to attribute to
    count: number; 
    revenue: number;
  }>();
  
  donations.forEach((d) => {
    if (d.refcode2 && typeof d.refcode2 === 'string' && d.refcode2.startsWith('fb_')) {
      const fbclidPrefix = d.refcode2.replace('fb_', '');
      const campaignRefcode = d.refcode || "(no refcode)";
      
      // Group by prefix - if same prefix appears, they should have same refcode
      const existing = donationsByFbclidPrefix.get(fbclidPrefix);
      if (existing) {
        existing.count += 1;
        existing.revenue += d.amount || 0;
      } else {
        donationsByFbclidPrefix.set(fbclidPrefix, {
          refcode: campaignRefcode,
          count: 1,
          revenue: d.amount || 0,
        });
      }
    }
  });

  // Build a set of all touchpoint fbclids for matching
  const touchpointFbclids = new Set<string>();
  touchpoints.forEach((tp) => {
    const meta = parseMetadata(tp.metadata);
    const fbclid = meta.fbclid as string;
    if (fbclid) touchpointFbclids.add(fbclid);
  });

  // Match donations (via refcode2) to touchpoints and attribute to refcode1
  // This is the core click ID matching logic
  const clickIdAttributions = new Map<string, { conversions: number; revenue: number }>();
  const matchedPrefixes = new Set<string>(); // Track which prefixes we've already matched
  
  donationsByFbclidPrefix.forEach((donation, prefix) => {
    // Check if any touchpoint's fbclid starts with this prefix
    const hasMatch = Array.from(touchpointFbclids).some(
      (fbclid) => fbclid.startsWith(prefix)
    );
    
    if (hasMatch && !matchedPrefixes.has(prefix)) {
      const existing = clickIdAttributions.get(donation.refcode) || { conversions: 0, revenue: 0 };
      existing.conversions += donation.count;
      existing.revenue += donation.revenue;
      clickIdAttributions.set(donation.refcode, existing);
      matchedPrefixes.add(prefix);
    }
  });

  // Track which refcodes we've already attributed (to avoid double-counting)
  const attributedRefcodes = new Set<string>();

  // Process touchpoints
  const sessionIds = new Set<string>();
  const refcodeMap = new Map<string, RefcodePerformance>();
  const campaignMap = new Map<string, CampaignPerformance>();
  const dailyMap = new Map<string, DailyClickData>();
  const hourlyMap = new Map<number, HourlyClickData>();
  const trafficSource: TrafficSourceBreakdown = { mobile: 0, desktop: 0, other: 0 };
  const refcodeSessionMap = new Map<string, Set<string>>();
  const campaignSessionMap = new Map<string, Set<string>>();
  const refcodeToCampaign = new Map<string, string>(); // Track which campaign each refcode belongs to

  let totalCaptureScore = 0;
  let captureScoreCount = 0;
  let totalMetaClicks = 0;
  let totalWithCookies = 0;

  touchpoints.forEach((tp) => {
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;
    const refcode = tp.refcode || "(no refcode)";
    const campaign = tp.utm_campaign || "(no campaign)";
    const referrer = meta.referrer as string;
    const captureScore = (meta.capture_score as number) || 0;
    const hasFbclid = !!(meta.fbclid || meta.fbc);
    const hasFbp = !!meta.fbp;
    const hasFbc = !!meta.fbc;
    const hasCookies = hasFbp || hasFbc;
    const date = tp.occurred_at.split("T")[0];
    const hour = new Date(tp.occurred_at).getHours();
    const source = detectTrafficSource(referrer);

    // Track session
    if (sessionId) {
      sessionIds.add(sessionId);
    }

    // Track meta clicks and cookies
    if (hasFbclid) totalMetaClicks++;
    if (hasCookies) totalWithCookies++;

    // Track capture score
    if (captureScore > 0) {
      totalCaptureScore += captureScore;
      captureScoreCount++;
    }

    // Traffic source
    trafficSource[source]++;

    // Aggregate by refcode
    if (!refcodeMap.has(refcode)) {
      refcodeMap.set(refcode, {
        refcode,
        totalClicks: 0,
        uniqueSessions: 0,
        metaAdClicks: 0,
        withFbp: 0,
        withFbc: 0,
        cookieCaptureRate: 0,
        avgCaptureScore: 0,
        conversions: 0,
        attributedConversions: 0,
        revenue: 0,
        attributedRevenue: 0,
        conversionRate: 0,
        attributionType: 'none' as AttributionType,
      });
      refcodeSessionMap.set(refcode, new Set());
    }
    const refEntry = refcodeMap.get(refcode)!;
    refEntry.totalClicks++;
    if (hasFbclid) refEntry.metaAdClicks++;
    if (hasFbp) refEntry.withFbp++;
    if (hasFbc) refEntry.withFbc++;
    if (sessionId) refcodeSessionMap.get(refcode)!.add(sessionId);

    // Apply click ID attributed conversions (calculated above)
    // This uses the donation's refcode1, not the touchpoint's refcode
    const clickIdData = clickIdAttributions.get(refcode);
    if (clickIdData && !attributedRefcodes.has(`clickid_${refcode}`)) {
      refEntry.attributedConversions = clickIdData.conversions;
      refEntry.attributedRevenue = clickIdData.revenue;
      refEntry.conversions = clickIdData.conversions;
      refEntry.revenue = clickIdData.revenue;
      refEntry.attributionType = 'click_id';
      attributedRefcodes.add(`clickid_${refcode}`);
      attributedRefcodes.add(refcode); // Also mark to prevent refcode-only fallback
    }

    // Fallback: Attribute by refcode only for campaigns not using redirect links
    // Only apply if no click ID attribution was done
    if (!attributedRefcodes.has(refcode) && refcode !== "(no refcode)") {
      const refcodeDonations = donationsByRefcode.get(refcode);
      if (refcodeDonations && refcodeDonations.count > 0) {
        refEntry.conversions = refcodeDonations.count;
        refEntry.revenue = refcodeDonations.revenue;
        refEntry.attributionType = 'refcode';
        attributedRefcodes.add(refcode);
      }
    }

    // Track refcode-to-campaign mapping
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
    }
    const dayEntry = dailyMap.get(date)!;
    dayEntry.clicks++;
    if (hasFbclid) dayEntry.metaClicks++;

    // Hourly trend
    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, { hour, clicks: 0, metaClicks: 0 });
    }
    const hourEntry = hourlyMap.get(hour)!;
    hourEntry.clicks++;
    if (hasFbclid) hourEntry.metaClicks++;
  });

  // Calculate rates for refcodes
  refcodeMap.forEach((entry, refcode) => {
    const sessions = refcodeSessionMap.get(refcode);
    entry.uniqueSessions = sessions ? sessions.size : entry.totalClicks;
    entry.cookieCaptureRate =
      entry.totalClicks > 0
        ? Math.round(((entry.withFbp + entry.withFbc) / entry.totalClicks) * 50)
        : 0;
    entry.conversionRate =
      entry.totalClicks > 0
        ? Math.round((entry.conversions / entry.totalClicks) * 100 * 100) / 100
        : 0;
  });

  // Calculate rates for campaigns and aggregate conversions from refcodes
  campaignMap.forEach((entry, campaign) => {
    const sessions = campaignSessionMap.get(campaign);
    entry.uniqueSessions = sessions ? sessions.size : entry.totalClicks;
    entry.cookieCaptureRate =
      entry.totalClicks > 0
        ? Math.round(((totalWithCookies / touchpoints.length) * 100))
        : 0;
  });

  // Aggregate campaign-level conversions from refcodes belonging to each campaign
  refcodeToCampaign.forEach((campaign, refcode) => {
    const refcodeDonations = donationsByRefcode.get(refcode);
    if (refcodeDonations && campaignMap.has(campaign)) {
      const campEntry = campaignMap.get(campaign)!;
      campEntry.conversions += refcodeDonations.count;
      campEntry.revenue += refcodeDonations.revenue;
    }
  });

  // Calculate daily sessions
  const dailySessionMap = new Map<string, Set<string>>();
  const dailyCaptureScores = new Map<string, { total: number; count: number }>();
  touchpoints.forEach((tp) => {
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;
    const captureScore = (meta.capture_score as number) || 0;
    const date = tp.occurred_at.split("T")[0];

    if (!dailySessionMap.has(date)) {
      dailySessionMap.set(date, new Set());
      dailyCaptureScores.set(date, { total: 0, count: 0 });
    }
    if (sessionId) dailySessionMap.get(date)!.add(sessionId);
    if (captureScore > 0) {
      const scores = dailyCaptureScores.get(date)!;
      scores.total += captureScore;
      scores.count++;
    }
  });

  dailyMap.forEach((entry, date) => {
    const sessions = dailySessionMap.get(date);
    entry.sessions = sessions ? sessions.size : entry.clicks;
    const scores = dailyCaptureScores.get(date);
    entry.avgCaptureScore = scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0;
  });

  // Sort and format results
  const byRefcode = Array.from(refcodeMap.values())
    .sort((a, b) => b.totalClicks - a.totalClicks);

  const byCampaign = Array.from(campaignMap.values())
    .sort((a, b) => b.totalClicks - a.totalClicks);

  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyTrend = Array.from(hourlyMap.values())
    .sort((a, b) => a.hour - b.hour);

  // Calculate total conversions and revenue
  let totalConversions = 0;
  let totalRevenue = 0;
  byRefcode.forEach((r) => {
    totalConversions += r.conversions;
    totalRevenue += r.revenue;
  });

  return {
    summary: {
      totalClicks: touchpoints.length,
      uniqueSessions: sessionIds.size || touchpoints.length,
      metaAdClicks: totalMetaClicks,
      cookieCaptureRate:
        touchpoints.length > 0
          ? Math.round((totalWithCookies / touchpoints.length) * 100)
          : 0,
      avgCaptureScore:
        captureScoreCount > 0
          ? Math.round(totalCaptureScore / captureScoreCount)
          : 0,
      conversions: totalConversions,
      attributedRevenue: totalRevenue,
      conversionRate:
        touchpoints.length > 0
          ? Math.round((totalConversions / touchpoints.length) * 100 * 100) / 100
          : 0,
    },
    byRefcode,
    byCampaign,
    byTrafficSource: trafficSource,
    dailyTrend,
    hourlyTrend,
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
