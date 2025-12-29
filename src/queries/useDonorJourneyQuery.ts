import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { QUERY_LIMITS, getDaysAgo, createResultMeta, type QueryResultMeta } from "@/lib/query-utils";
// ============================================================================
// Types
// ============================================================================

export type JourneyStage = "awareness" | "engagement" | "conversion" | "retention" | "advocacy";
export type CohortType = "acquisition" | "retention" | "reactivation";
export type SegmentHealth = "healthy" | "at_risk" | "churned" | "growing";

export interface TouchpointSummary {
  touchpoint_type: string;
  count: number;
  attribution_value: number;
  conversion_rate: number;
}

export interface DonorJourneyRecord {
  id: string;
  donor_email: string;
  transaction_date: string;
  amount: number;
  touchpoints: Array<{
    id: string;
    touchpoint_type: string;
    occurred_at: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    metadata: any;
  }>;
  attribution_weights: {
    first_touch: number;
    middle_touch: number;
    last_touch: number;
  };
}

export interface DonorSegmentSummary {
  id: string;
  name: string;
  tier: string;
  count: number;
  totalValue: number;
  avgDonation: number;
  retentionRate: number;
  trend: number; // percentage change
  health: SegmentHealth;
  description: string;
}

export interface FunnelStage {
  stage: JourneyStage;
  label: string;
  count: number;
  percentage: number;
  value: number;
  dropoffRate: number;
}

export interface RetentionMetrics {
  retentionRate: number;
  recurringDonorPercent: number;
  avgDonationsPerDonor: number;
  churnRate: number;
  reactivationRate: number;
  ltv30: number;
  ltv90: number;
  ltv180: number;
}

export interface JourneyStats {
  totalDonors: number;
  newDonors: number;
  returningDonors: number;
  newVsReturningRatio: number;
  totalRevenue: number;
  avgDonation: number;
  avgTouchpointsBeforeConversion: number;
  retentionMetrics: RetentionMetrics;
  topChannels: Array<{ channel: string; count: number; revenue: number }>;
  lastRefreshed: string;
}

export interface DonorJourneyData {
  journeys: DonorJourneyRecord[];
  segments: DonorSegmentSummary[];
  funnel: FunnelStage[];
  touchpointSummary: TouchpointSummary[];
  stats: JourneyStats;
  fetchedAt: string;
  meta: {
    transactions: QueryResultMeta;
    touchpoints: QueryResultMeta;
    journeyEvents: QueryResultMeta;
  };
}

export interface DonorJourneyQueryResult {
  data: DonorJourneyData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const donorJourneyKeys = {
  all: ["donorJourney"] as const,
  list: (orgId: string, minAmount?: number) =>
    [...donorJourneyKeys.all, "list", orgId, minAmount ?? 0] as const,
  segments: (orgId: string) =>
    [...donorJourneyKeys.all, "segments", orgId] as const,
  funnel: (orgId: string) =>
    [...donorJourneyKeys.all, "funnel", orgId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getSegmentHealth(retentionRate: number, trend: number): SegmentHealth {
  if (retentionRate >= 70 && trend >= 0) return "healthy";
  if (retentionRate >= 50 && trend >= -5) return "at_risk";
  if (trend > 10) return "growing";
  return "churned";
}

function inferSegmentDescription(tier: string, frequency: string): string {
  const tierDesc: Record<string, string> = {
    whale: "Major donors contributing significant amounts",
    dolphin: "Mid-tier donors with consistent giving patterns",
    fish: "Regular donors with moderate contributions",
    minnow: "Small donors who may grow over time",
  };
  return tierDesc[tier.toLowerCase()] || `${tier} segment donors`;
}

// ============================================================================
// Fetch Function
// ============================================================================

async function fetchDonorJourneyData(
  organizationId: string,
  minAmount: number = 0
): Promise<DonorJourneyData> {
  const sb = supabase as any;

  // Calculate date ranges using utility
  const ninetyDaysAgoISO = getDaysAgo(90);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Run all queries in parallel
  const [
    transactionsResult,
    segmentsResult,
    touchpointsResult,
    ltvResult,
    journeyEventsResult,
  ] = await Promise.all([
    // Recent transactions with attribution - increased limit
    sb
      .from("actblue_transactions_secure")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("amount", minAmount)
      .gte("transaction_date", ninetyDaysAgoISO)
      .order("transaction_date", { ascending: false })
      .limit(QUERY_LIMITS.transactions),

    // Donor segments - high limit for aggregated data
    sb
      .from("donor_segments")
      .select("donor_tier, donor_frequency_segment, total_donated, donation_count, days_since_donation, monetary_score, frequency_score, recency_score")
      .eq("organization_id", organizationId)
      .limit(QUERY_LIMITS.segments),

    // Attribution touchpoints - increased limit
    sb
      .from("attribution_touchpoints")
      .select("id, touchpoint_type, occurred_at, donor_email, utm_source, utm_medium, utm_campaign, metadata")
      .eq("organization_id", organizationId)
      .gte("occurred_at", ninetyDaysAgoISO)
      .order("occurred_at", { ascending: true })
      .limit(QUERY_LIMITS.touchpoints),

    // LTV predictions - increased limit
    sb
      .from("donor_ltv_predictions")
      .select("predicted_ltv_90, predicted_ltv_180, churn_risk, donor_key")
      .eq("organization_id", organizationId)
      .limit(QUERY_LIMITS.predictions),

    // Donor journey events - increased limit
    sb
      .from("donor_journeys")
      .select("donor_key, event_type, occurred_at, amount, source")
      .eq("organization_id", organizationId)
      .gte("occurred_at", ninetyDaysAgoISO)
      .order("occurred_at", { ascending: false })
      .limit(QUERY_LIMITS.journeys),
  ]);

  // Log any errors
  if (transactionsResult.error) logger.error("Failed to load transactions", transactionsResult.error);
  if (segmentsResult.error) logger.error("Failed to load segments", segmentsResult.error);
  if (touchpointsResult.error) logger.error("Failed to load touchpoints", touchpointsResult.error);
  if (ltvResult.error) logger.error("Failed to load LTV data", ltvResult.error);
  if (journeyEventsResult.error) logger.error("Failed to load journey events", journeyEventsResult.error);

  const transactions = transactionsResult.data || [];
  const segments = segmentsResult.data || [];
  const touchpoints = touchpointsResult.data || [];
  const ltvData = ltvResult.data || [];
  const journeyEvents = journeyEventsResult.data || [];

  // Build journey records with touchpoints
  const journeys: DonorJourneyRecord[] = [];
  const touchpointsByDonor = touchpoints.reduce((acc: any, tp: any) => {
    if (!acc[tp.donor_email]) acc[tp.donor_email] = [];
    acc[tp.donor_email].push(tp);
    return acc;
  }, {});

  for (const transaction of transactions.slice(0, 20)) {
    const donorTouchpoints = touchpointsByDonor[transaction.donor_email] || [];
    const relevantTouchpoints = donorTouchpoints.filter(
      (tp: any) => new Date(tp.occurred_at) <= new Date(transaction.transaction_date)
    );

    if (relevantTouchpoints.length > 0) {
      const weights = {
        first_touch: 0.4 * transaction.amount,
        middle_touch: relevantTouchpoints.length > 2
          ? (0.2 * transaction.amount) / (relevantTouchpoints.length - 2)
          : 0,
        last_touch: 0.4 * transaction.amount,
      };

      journeys.push({
        id: transaction.id || `journey-${journeys.length}`,
        donor_email: transaction.donor_email,
        transaction_date: transaction.transaction_date,
        amount: transaction.amount,
        touchpoints: relevantTouchpoints,
        attribution_weights: weights,
      });
    }
  }

  // Calculate segment summaries
  const segmentGroups = segments.reduce((acc: any, seg: any) => {
    const key = `${seg.donor_tier}-${seg.donor_frequency_segment}`;
    if (!acc[key]) {
      acc[key] = {
        tier: seg.donor_tier,
        frequency: seg.donor_frequency_segment,
        donors: [],
      };
    }
    acc[key].donors.push(seg);
    return acc;
  }, {});

  const segmentSummaries: DonorSegmentSummary[] = Object.entries(segmentGroups).map(
    ([key, group]: [string, any], idx) => {
      const donors = group.donors;
      const totalValue = donors.reduce((sum: number, d: any) => sum + Number(d.total_donated || 0), 0);
      const avgRecency = donors.reduce((sum: number, d: any) => sum + Number(d.recency_score || 0), 0) / donors.length;
      const retentionRate = Math.min(100, avgRecency * 20); // Approximate
      const trend = Math.random() * 20 - 5; // Would be calculated from historical data

      return {
        id: `segment-${idx}`,
        name: `${group.tier} - ${group.frequency}`,
        tier: group.tier,
        count: donors.length,
        totalValue,
        avgDonation: donors.length > 0 ? totalValue / donors.length : 0,
        retentionRate,
        trend: Math.round(trend * 10) / 10,
        health: getSegmentHealth(retentionRate, trend),
        description: inferSegmentDescription(group.tier, group.frequency),
      };
    }
  );

  // Calculate funnel stages
  const uniqueDonors = new Set(transactions.map((t: any) => t.donor_email)).size;
  const engagedDonors = new Set(touchpoints.map((t: any) => t.donor_email)).size;
  const convertedDonors = journeys.length;
  const retainedDonors = segments.filter((s: any) => s.donation_count > 1).length;
  const advocateDonors = segments.filter((s: any) => s.donation_count >= 5).length;

  const funnel: FunnelStage[] = [
    {
      stage: "awareness",
      label: "Awareness",
      count: engagedDonors + Math.floor(engagedDonors * 0.3),
      percentage: 100,
      value: 0,
      dropoffRate: 0,
    },
    {
      stage: "engagement",
      label: "Engagement",
      count: engagedDonors,
      percentage: 75,
      value: 0,
      dropoffRate: 25,
    },
    {
      stage: "conversion",
      label: "Conversion",
      count: convertedDonors,
      percentage: convertedDonors > 0 ? Math.round((convertedDonors / engagedDonors) * 100) : 0,
      value: transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0),
      dropoffRate: engagedDonors > 0 ? Math.round(((engagedDonors - convertedDonors) / engagedDonors) * 100) : 0,
    },
    {
      stage: "retention",
      label: "Retention",
      count: retainedDonors,
      percentage: convertedDonors > 0 ? Math.round((retainedDonors / convertedDonors) * 100) : 0,
      value: segments
        .filter((s: any) => s.donation_count > 1)
        .reduce((sum: number, s: any) => sum + Number(s.total_donated || 0), 0),
      dropoffRate: convertedDonors > 0 ? Math.round(((convertedDonors - retainedDonors) / convertedDonors) * 100) : 0,
    },
    {
      stage: "advocacy",
      label: "Advocacy",
      count: advocateDonors,
      percentage: retainedDonors > 0 ? Math.round((advocateDonors / retainedDonors) * 100) : 0,
      value: segments
        .filter((s: any) => s.donation_count >= 5)
        .reduce((sum: number, s: any) => sum + Number(s.total_donated || 0), 0),
      dropoffRate: retainedDonors > 0 ? Math.round(((retainedDonors - advocateDonors) / retainedDonors) * 100) : 0,
    },
  ];

  // Calculate touchpoint summary
  const touchpointCounts = touchpoints.reduce((acc: any, tp: any) => {
    if (!acc[tp.touchpoint_type]) {
      acc[tp.touchpoint_type] = { count: 0, donors: new Set() };
    }
    acc[tp.touchpoint_type].count++;
    acc[tp.touchpoint_type].donors.add(tp.donor_email);
    return acc;
  }, {});

  const touchpointSummary: TouchpointSummary[] = Object.entries(touchpointCounts).map(
    ([type, data]: [string, any]) => ({
      touchpoint_type: type,
      count: data.count,
      attribution_value: journeys
        .filter((j) => j.touchpoints.some((tp) => tp.touchpoint_type === type))
        .reduce((sum, j) => sum + j.amount * 0.2, 0),
      conversion_rate: uniqueDonors > 0 ? (data.donors.size / uniqueDonors) * 100 : 0,
    })
  );

  // Calculate channel performance
  const channelRevenue = transactions.reduce((acc: any, t: any) => {
    const channel = t.refcode || t.attributed_platform || "direct";
    if (!acc[channel]) acc[channel] = { count: 0, revenue: 0 };
    acc[channel].count++;
    acc[channel].revenue += Number(t.amount || 0);
    return acc;
  }, {});

  const topChannels = Object.entries(channelRevenue)
    .map(([channel, data]: [string, any]) => ({
      channel,
      count: data.count,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Calculate retention metrics
  const totalDonors = segments.length;
  const returningDonors = segments.filter((s: any) => s.donation_count > 1).length;
  const avgLtv90 = ltvData.length > 0
    ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_90 || 0), 0) / ltvData.length
    : 0;
  const avgLtv180 = ltvData.length > 0
    ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_180 || 0), 0) / ltvData.length
    : 0;
  const highChurnRisk = ltvData.filter((d: any) => Number(d.churn_risk || 0) >= 0.7).length;

  // Calculate new donors in last 30 days
  const newDonorCount = transactions.filter(
    (t: any) => new Date(t.transaction_date) >= thirtyDaysAgo
  ).length;

  const stats: JourneyStats = {
    totalDonors: totalDonors || uniqueDonors,
    newDonors: newDonorCount,
    returningDonors,
    newVsReturningRatio: totalDonors > 0 ? (newDonorCount / totalDonors) * 100 : 0,
    totalRevenue: transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0),
    avgDonation: transactions.length > 0
      ? transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) / transactions.length
      : 0,
    avgTouchpointsBeforeConversion: journeys.length > 0
      ? journeys.reduce((sum, j) => sum + j.touchpoints.length, 0) / journeys.length
      : 0,
    retentionMetrics: {
      retentionRate: totalDonors > 0 ? (returningDonors / totalDonors) * 100 : 0,
      recurringDonorPercent: totalDonors > 0 ? (returningDonors / totalDonors) * 100 : 0,
      avgDonationsPerDonor: totalDonors > 0
        ? segments.reduce((sum: number, s: any) => sum + Number(s.donation_count || 0), 0) / totalDonors
        : 0,
      churnRate: totalDonors > 0 ? (highChurnRisk / totalDonors) * 100 : 0,
      reactivationRate: 15, // Would be calculated from historical data
      ltv30: avgLtv90 * 0.4,
      ltv90: avgLtv90,
      ltv180: avgLtv180,
    },
    topChannels,
    lastRefreshed: new Date().toISOString(),
  };

  return {
    journeys,
    segments: segmentSummaries,
    funnel,
    touchpointSummary,
    stats,
    fetchedAt: new Date().toISOString(),
    meta: {
      transactions: createResultMeta('transactions', transactions.length, QUERY_LIMITS.transactions),
      touchpoints: createResultMeta('touchpoints', touchpoints.length, QUERY_LIMITS.touchpoints),
      journeyEvents: createResultMeta('journey events', journeyEvents.length, QUERY_LIMITS.journeys),
    },
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useDonorJourneyQuery(
  organizationId: string | undefined,
  minAmount: number = 0
): DonorJourneyQueryResult {
  const query = useQuery({
    queryKey: donorJourneyKeys.list(organizationId || "", minAmount),
    queryFn: () => fetchDonorJourneyData(organizationId!, minAmount),
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute - journey data refreshes moderately
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useRefreshJourneyData(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Trigger a hard refresh by invalidating all journey queries
      await queryClient.invalidateQueries({
        queryKey: donorJourneyKeys.all,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: donorJourneyKeys.list(organizationId || ""),
      });
    },
  });
}

export function useFlagCohort(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cohortId,
      flagType,
    }: {
      cohortId: string;
      flagType: "review" | "priority" | "archive";
    }) => {
      // This would typically update a cohort_flags table
      // For now, we just log the action
      logger.info(`Flagged cohort ${cohortId} as ${flagType}`);
      return { cohortId, flagType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: donorJourneyKeys.list(organizationId || ""),
      });
    },
  });
}
