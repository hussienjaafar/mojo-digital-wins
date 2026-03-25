import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/metricDefinitions";

// ============================================================================
// Types
// ============================================================================

export type MatchQuality = "excellent" | "good" | "fair" | "poor";

export interface CAPIEvent {
  id: string;
  eventName: string;
  eventTime: string;
  status: "pending" | "delivered" | "failed" | "superseded";
  refcode: string | null;
  matchScore: number | null;
  matchQuality: MatchQuality | null;
  donationAmount: number | null;
  fbp: string | null;
  fbc: string | null;
  fbcLength: number; // NEW: Track fbc length for debugging
  isTruncated: boolean; // NEW: Flag if fbc is truncated
  sourceType: string | null; // NEW: Track source (webhook, backfill, enrichment_resend)
  deliveredAt: string | null;
  error: string | null;
}

export interface MatchQualityDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  unknown: number;
}

export interface CAPIEventsData {
  totalSent: number;
  pending: number;
  delivered: number;
  failed: number;
  matchQualityDistribution: MatchQualityDistribution;
  recentEvents: CAPIEvent[];
  avgMatchScore: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const capiEventsKeys = {
  all: ["capi-events"] as const,
  byOrg: (orgId: string | undefined, startDate: string, endDate: string) =>
    [...capiEventsKeys.all, orgId, startDate, endDate] as const,
};

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchCAPIEvents(
  organizationId?: string,
  startDate?: string,
  endDate?: string
): Promise<CAPIEventsData> {
  // Treat date ranges as organization-timezone days (ActBlue typically operates in ET)
  const tz = DEFAULT_ORG_TIMEZONE;

  const end = endDate || format(new Date(), "yyyy-MM-dd");
  const start = startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, "yyyy-MM-dd");
  })();

  // Use half-open interval: [start_day, end_day_exclusive) in org timezone
  const startUtc = fromZonedTime(`${start}T00:00:00`, tz).toISOString();
  const endExclusiveDay = format(addDays(parseISO(end), 1), "yyyy-MM-dd");
  const endExclusiveUtc = fromZonedTime(`${endExclusiveDay}T00:00:00`, tz).toISOString();

  let query = supabase
    .from("meta_conversion_events")
    .select("*")
    .gte("created_at", startUtc)
    .lt("created_at", endExclusiveUtc)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching CAPI events:", error);
    throw error;
  }

  const events = data || [];

  if (events.length === 0) {
    return {
      totalSent: 0,
      pending: 0,
      delivered: 0,
      failed: 0,
      matchQualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        unknown: 0,
      },
      recentEvents: [],
      avgMatchScore: 0,
    };
  }

  // Count by status
  let pending = 0;
  let delivered = 0;
  let failed = 0;
  let totalMatchScore = 0;
  let matchScoreCount = 0;

  const matchQualityDistribution: MatchQualityDistribution = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    unknown: 0,
  };

  events.forEach((event) => {
    // Status counts - handle both 'delivered' and 'sent' as delivered
    switch (event.status) {
      case "pending":
        pending++;
        break;
      case "delivered":
      case "sent":
        delivered++;
        break;
      case "failed":
        failed++;
        break;
    }

    // Match quality distribution
    const quality = event.match_quality as MatchQuality | null;
    if (quality && matchQualityDistribution.hasOwnProperty(quality)) {
      matchQualityDistribution[quality]++;
    } else {
      matchQualityDistribution.unknown++;
    }

    // Average match score
    if (event.match_score !== null) {
      totalMatchScore += event.match_score;
      matchScoreCount++;
    }
  });

  // Map recent events (first 20)
  const recentEvents: CAPIEvent[] = events.slice(0, 20).map((event) => {
    const customData = event.custom_data as Record<string, unknown> | null;
    const lastError = (event as Record<string, unknown>).last_error as string | undefined;
    const sourceType = (event as Record<string, unknown>).source_type as string | null;
    // Normalize 'sent' status to 'delivered' for UI consistency
    let normalizedStatus: "pending" | "delivered" | "failed" | "superseded" = 
      event.status === 'sent' ? 'delivered' : 
      (event.status as "pending" | "delivered" | "failed" | "superseded");
    const fbcValue = event.fbc || null;
    const fbcLength = fbcValue?.length || 0;
    return {
      id: event.id,
      eventName: event.event_name,
      eventTime: new Date(event.event_time * 1000).toISOString(),
      status: normalizedStatus,
      refcode: event.refcode,
      matchScore: event.match_score,
      matchQuality: event.match_quality as MatchQuality | null,
      donationAmount: customData?.value as number | null,
      fbp: event.fbp,
      fbc: fbcValue,
      fbcLength, // NEW: Track fbc length
      isTruncated: fbcLength > 0 && fbcLength <= 50, // NEW: Flag truncated fbc
      sourceType, // NEW: Track source type
      deliveredAt: event.delivered_at,
      error: lastError || null,
    };
  });

  return {
    totalSent: events.length,
    pending,
    delivered,
    failed,
    matchQualityDistribution,
    recentEvents,
    avgMatchScore:
      matchScoreCount > 0 ? Math.round(totalMatchScore / matchScoreCount) : 0,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useCAPIEventsQuery(
  organizationId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: capiEventsKeys.byOrg(organizationId, startDate || "", endDate || ""),
    queryFn: () => fetchCAPIEvents(organizationId, startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
