import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RefcodeClickData {
  refcode: string;
  totalClicks: number;
  uniqueSessions: number;
  metaAdClicks: number;
  withFbp: number;
  withFbc: number;
  cookieCaptureRate: number;
}

export interface DailyClickData {
  date: string;
  clicks: number;
  metaClicks: number;
}

export interface RedirectClicksData {
  summary: {
    totalClicks: number;
    uniqueSessions: number;
    metaAdClicks: number;
    cookieCaptureRate: number;
  };
  byRefcode: RefcodeClickData[];
  dailyTrend: DailyClickData[];
}

export const redirectClicksKeys = {
  all: ["redirect-clicks"] as const,
  byOrg: (orgId: string | undefined, days: number) =>
    [...redirectClicksKeys.all, orgId, days] as const,
};

async function fetchRedirectClicks(
  organizationId?: string,
  daysBack: number = 30
): Promise<RedirectClicksData> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString();

  // Build query
  let query = supabase
    .from("attribution_touchpoints")
    .select("*")
    .gte("occurred_at", startDateStr)
    .order("occurred_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: touchpoints, error } = await query;

  if (error) {
    console.error("Error fetching redirect clicks:", error);
    throw error;
  }

  if (!touchpoints || touchpoints.length === 0) {
    return {
      summary: {
        totalClicks: 0,
        uniqueSessions: 0,
        metaAdClicks: 0,
        cookieCaptureRate: 0,
      },
      byRefcode: [],
      dailyTrend: [],
    };
  }

  // Extract metadata safely
  const parseMetadata = (metadata: unknown): Record<string, unknown> => {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata as Record<string, unknown>;
    return {};
  };

  // Calculate unique sessions
  const sessionIds = new Set<string>();
  touchpoints.forEach((tp) => {
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;
    if (sessionId) {
      sessionIds.add(sessionId);
    }
  });

  // Meta ad clicks (those with fbclid)
  const metaClicks = touchpoints.filter((tp) => {
    const meta = parseMetadata(tp.metadata);
    return meta.fbclid || meta.fbc;
  });

  // Cookie capture (those with fbp or fbc)
  const withCookies = touchpoints.filter((tp) => {
    const meta = parseMetadata(tp.metadata);
    return meta.fbp || meta.fbc;
  });

  // Aggregate by refcode
  const refcodeMap = new Map<string, RefcodeClickData>();
  touchpoints.forEach((tp) => {
    const refcode = tp.refcode || "(no refcode)";
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;
    const hasFbclid = !!(meta.fbclid || meta.fbc);
    const hasFbp = !!meta.fbp;
    const hasFbc = !!meta.fbc;

    if (!refcodeMap.has(refcode)) {
      refcodeMap.set(refcode, {
        refcode,
        totalClicks: 0,
        uniqueSessions: 0,
        metaAdClicks: 0,
        withFbp: 0,
        withFbc: 0,
        cookieCaptureRate: 0,
      });
    }

    const entry = refcodeMap.get(refcode)!;
    entry.totalClicks++;
    if (hasFbclid) entry.metaAdClicks++;
    if (hasFbp) entry.withFbp++;
    if (hasFbc) entry.withFbc++;
  });

  // Calculate unique sessions per refcode and cookie capture rate
  const refcodeSessionMap = new Map<string, Set<string>>();
  touchpoints.forEach((tp) => {
    const refcode = tp.refcode || "(no refcode)";
    const meta = parseMetadata(tp.metadata);
    const sessionId = meta.session_id as string;

    if (!refcodeSessionMap.has(refcode)) {
      refcodeSessionMap.set(refcode, new Set());
    }
    if (sessionId) {
      refcodeSessionMap.get(refcode)!.add(sessionId);
    }
  });

  refcodeMap.forEach((entry, refcode) => {
    const sessions = refcodeSessionMap.get(refcode);
    entry.uniqueSessions = sessions ? sessions.size : entry.totalClicks;
    entry.cookieCaptureRate =
      entry.totalClicks > 0
        ? Math.round(((entry.withFbp + entry.withFbc) / entry.totalClicks) * 50)
        : 0;
  });

  // Daily trend
  const dailyMap = new Map<string, { clicks: number; metaClicks: number }>();
  touchpoints.forEach((tp) => {
    const date = tp.occurred_at.split("T")[0];
    const meta = parseMetadata(tp.metadata);
    const hasMeta = !!(meta.fbclid || meta.fbc);

    if (!dailyMap.has(date)) {
      dailyMap.set(date, { clicks: 0, metaClicks: 0 });
    }

    const entry = dailyMap.get(date)!;
    entry.clicks++;
    if (hasMeta) entry.metaClicks++;
  });

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      clicks: data.clicks,
      metaClicks: data.metaClicks,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byRefcode = Array.from(refcodeMap.values()).sort(
    (a, b) => b.totalClicks - a.totalClicks
  );

  return {
    summary: {
      totalClicks: touchpoints.length,
      uniqueSessions: sessionIds.size || touchpoints.length,
      metaAdClicks: metaClicks.length,
      cookieCaptureRate:
        touchpoints.length > 0
          ? Math.round((withCookies.length / touchpoints.length) * 100)
          : 0,
    },
    byRefcode,
    dailyTrend,
  };
}

export function useRedirectClicksQuery(
  organizationId?: string,
  daysBack: number = 30
) {
  return useQuery({
    queryKey: redirectClicksKeys.byOrg(organizationId, daysBack),
    queryFn: () => fetchRedirectClicks(organizationId, daysBack),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
