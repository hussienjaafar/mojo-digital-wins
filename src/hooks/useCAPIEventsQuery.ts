import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type MatchQuality = "excellent" | "good" | "fair" | "poor";

export interface CAPIEvent {
  id: string;
  eventName: string;
  eventTime: string;
  status: "pending" | "delivered" | "failed";
  refcode: string | null;
  matchScore: number | null;
  matchQuality: MatchQuality | null;
  donationAmount: number | null;
  fbp: string | null;
  fbc: string | null;
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
  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();

  let query = supabase
    .from("meta_conversion_events")
    .select("*")
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`)
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
    // Status counts
    switch (event.status) {
      case "pending":
        pending++;
        break;
      case "delivered":
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
    return {
      id: event.id,
      eventName: event.event_name,
      eventTime: new Date(event.event_time * 1000).toISOString(),
      status: event.status as "pending" | "delivered" | "failed",
      refcode: event.refcode,
      matchScore: event.match_score,
      matchQuality: event.match_quality as MatchQuality | null,
      donationAmount: customData?.value as number | null,
      fbp: event.fbp,
      fbc: event.fbc,
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
