import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { 
  QUERY_LIMITS, 
  getDaysAgo, 
  createResultMeta, 
  isRecoverableError,
  type QueryResultMeta 
} from "@/lib/query-utils";
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
    // Recent transactions - direct table query (bypasses RLS views)
    sb
      .from("actblue_transactions")
      .select("id, donor_email, amount, net_amount, transaction_date, transaction_type, is_recurring, refcode, source_campaign")
      .eq("organization_id", organizationId)
      .gte("amount", minAmount)
      .gte("transaction_date", ninetyDaysAgoISO)
      .neq("transaction_type", "refund")
      .order("transaction_date", { ascending: false })
      .limit(QUERY_LIMITS.transactions),

    // Donor demographics - direct table query with correct column names
    sb
      .from("donor_demographics")
      .select("id, donor_email, total_donated, donation_count, first_donation_date, last_donation_date, is_recurring, organization_id")
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

  // Log errors gracefully - don't throw for recoverable errors
  const logError = (name: string, error: any) => {
    if (error) {
      if (isRecoverableError(error)) {
        logger.warn(`No ${name} data available (table may be empty or not populated yet)`);
      } else {
        logger.error(`Failed to load ${name}`, error);
      }
    }
  };

  logError('transactions', transactionsResult.error);
  logError('segments', segmentsResult.error);
  logError('touchpoints', touchpointsResult.error);
  logError('LTV predictions', ltvResult.error);
  logError('journey events', journeyEventsResult.error);

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

  // Calculate segment summaries from donor_demographics
  // Derive values from actual columns: total_donated, donation_count, first_donation_date, last_donation_date
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  
  const segmentGroups = segments.reduce((acc: any, donor: any) => {
    const amount = Number(donor.total_donated || 0);
    const donationCount = Number(donor.donation_count || 1);
    
    // Determine tier based on total_donated
    let tier = 'minnow';
    if (amount >= 1000) tier = 'whale';
    else if (amount >= 250) tier = 'dolphin';
    else if (amount >= 50) tier = 'fish';
    
    // Determine frequency
    let frequency = 'one_time';
    if (donationCount >= 5) frequency = 'frequent';
    else if (donationCount >= 2) frequency = 'repeat';
    
    const key = `${tier}-${frequency}`;
    if (!acc[key]) {
      acc[key] = { tier, frequency, donors: [] };
    }
    acc[key].donors.push(donor);
    return acc;
  }, {});

  const segmentSummaries: DonorSegmentSummary[] = Object.entries(segmentGroups).map(
    ([key, group]: [string, any], idx) => {
      const donors = group.donors;
      const totalValue = donors.reduce((sum: number, d: any) => sum + Number(d.total_donated || 0), 0);
      // Calculate recency from last_donation_date
      const avgRecency = donors.reduce((sum: number, d: any) => {
        if (!d.last_donation_date) return sum + 30;
        const recencyDays = Math.floor((now - new Date(d.last_donation_date).getTime()) / (1000 * 60 * 60 * 24));
        return sum + recencyDays;
      }, 0) / donors.length;
      const returningDonors = donors.filter((d: any) => Number(d.donation_count || 1) > 1).length;
      const retentionRate = donors.length > 0 ? (returningDonors / donors.length) * 100 : 0;
      const trend = 0; // Would be calculated from historical data

      return {
        id: `segment-${idx}`,
        name: `${group.tier.charAt(0).toUpperCase() + group.tier.slice(1)} - ${group.frequency.replace('_', ' ')}`,
        tier: group.tier,
        count: donors.length,
        totalValue,
        avgDonation: donors.length > 0 ? totalValue / donors.reduce((sum: number, d: any) => sum + Number(d.donation_count || 1), 0) : 0,
        retentionRate,
        trend: Math.round(trend * 10) / 10,
        health: getSegmentHealth(retentionRate, trend),
        description: inferSegmentDescription(group.tier, group.frequency),
      };
    }
  );

  // Calculate funnel stages from REAL journey events data
  // PHASE 4 FIX: Include ALL awareness/engagement event types for complete funnel
  const awarenessEventTypes = [
    'ad_view', 'ad_click', 'meta_ad_click', 'meta_ad_impression',
    'email_open', 'landing_page_view', 'sms_sent', 'sms_delivered',
    'organic_search', 'social_click', 'direct_visit'
  ];
  
  const engagementEventTypes = [
    'ad_click', 'meta_ad_click', 'sms_click', 'email_click',
    'landing_page_view', 'sms_reply'
  ];
  
  const awarenessEvents = journeyEvents.filter((e: any) => 
    awarenessEventTypes.includes(e.event_type)
  );
  const engagementEvents = journeyEvents.filter((e: any) => 
    engagementEventTypes.includes(e.event_type)
  );
  const conversionEvents = journeyEvents.filter((e: any) => 
    e.event_type === 'first_donation'
  );
  const retentionEvents = journeyEvents.filter((e: any) => 
    ['repeat_donation', 'recurring_donation'].includes(e.event_type)
  );
  const advocacyEvents = journeyEvents.filter((e: any) => 
    e.event_type === 'recurring_signup'
  );

  // Get unique donors at each stage
  const awarenessCount = new Set(awarenessEvents.map((e: any) => e.donor_key)).size || touchpoints.length;
  const engagementCount = new Set(engagementEvents.map((e: any) => e.donor_key)).size || 
    new Set(touchpoints.map((t: any) => t.donor_email)).size;
  const conversionCount = new Set(conversionEvents.map((e: any) => e.donor_key)).size;
  const retentionCount = new Set(retentionEvents.map((e: any) => e.donor_key)).size;
  const advocacyCount = new Set(advocacyEvents.map((e: any) => e.donor_key)).size;

  // Calculate revenue at each stage
  const conversionValue = conversionEvents.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const retentionValue = retentionEvents.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const advocacyValue = advocacyEvents.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  // Calculate baseline for funnel - use awareness count as the top
  const funnelBaseline = awarenessCount || segments.length || 100;

  const funnel: FunnelStage[] = [
    {
      stage: "awareness",
      label: "Awareness",
      count: awarenessCount || segments.length,
      percentage: 100,
      value: 0,
      dropoffRate: 0,
    },
    {
      stage: "engagement",
      label: "Engagement",
      count: engagementCount || Math.round(funnelBaseline * 0.7),
      percentage: funnelBaseline > 0 ? Math.round((engagementCount / funnelBaseline) * 100) : 70,
      value: 0,
      dropoffRate: funnelBaseline > 0 ? Math.round(((funnelBaseline - engagementCount) / funnelBaseline) * 100) : 30,
    },
    {
      stage: "conversion",
      label: "Conversion",
      count: conversionCount || journeys.length,
      percentage: engagementCount > 0 ? Math.round(((conversionCount || journeys.length) / engagementCount) * 100) : 0,
      value: conversionValue || transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0),
      dropoffRate: engagementCount > 0 ? Math.round(((engagementCount - (conversionCount || journeys.length)) / engagementCount) * 100) : 0,
    },
    {
      stage: "retention",
      label: "Retention",
      count: retentionCount || segments.filter((s: any) => Number(s.donation_count || 1) > 1).length,
      percentage: conversionCount > 0 ? Math.round((retentionCount / conversionCount) * 100) : 0,
      value: retentionValue,
      dropoffRate: conversionCount > 0 ? Math.round(((conversionCount - retentionCount) / conversionCount) * 100) : 0,
    },
    {
      stage: "advocacy",
      label: "Advocacy",
      count: advocacyCount || segments.filter((s: any) => Number(s.donation_count || 1) >= 5).length,
      percentage: retentionCount > 0 ? Math.round((advocacyCount / retentionCount) * 100) : 0,
      value: advocacyValue,
      dropoffRate: retentionCount > 0 ? Math.round(((retentionCount - advocacyCount) / retentionCount) * 100) : 0,
    },
  ];

  // Calculate touchpoint summary
  const uniqueDonorEmails = new Set(transactions.map((t: any) => t.donor_email)).size;
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
      conversion_rate: uniqueDonorEmails > 0 ? (data.donors.size / uniqueDonorEmails) * 100 : 0,
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
    totalDonors: totalDonors || uniqueDonorEmails,
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
