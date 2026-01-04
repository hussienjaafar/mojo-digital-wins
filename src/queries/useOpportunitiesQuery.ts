import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type OpportunityStatus = "pending" | "live" | "completed" | "dismissed";
export type OpportunityType = "trending" | "event" | "advocacy" | "partnership" | "other";
export type PriorityLevel = "high" | "medium" | "low";

export interface Opportunity {
  id: string;
  organization_id: string;
  entity_name: string;
  entity_type: string;
  opportunity_score: number;
  velocity: number;
  current_mentions: number;
  estimated_value: number | null;
  similar_past_events: number;
  historical_success_rate: number | null;
  detected_at: string;
  is_active: boolean;
  status: OpportunityStatus;
  opportunity_type: OpportunityType;
  assigned_to?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  expires_at?: string | null;
  // Personalization fields
  org_relevance_score?: number | null;
  org_relevance_reasons?: string[] | null;
}

export interface OpportunityStats {
  total: number;
  active: number;
  highPriority: number;
  highPriorityPercent: number;
  avgScore: number;
  avgEstimatedValue: number;
  readyToLaunch: number;
  byStatus: Record<OpportunityStatus, number>;
  byType: Record<OpportunityType, number>;
  lastRefreshed: string;
}

export interface OpportunitiesData {
  opportunities: Opportunity[];
  stats: OpportunityStats;
  fetchedAt: string;
}

export interface OpportunitiesQueryResult {
  data: OpportunitiesData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const opportunitiesKeys = {
  all: ["opportunities"] as const,
  list: (orgId: string) => [...opportunitiesKeys.all, "list", orgId] as const,
  detail: (orgId: string, oppId: string) =>
    [...opportunitiesKeys.all, "detail", orgId, oppId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function inferStatus(opp: any): OpportunityStatus {
  if (opp.status) return opp.status;
  if (!opp.is_active) return "dismissed";
  return "pending";
}

function inferType(opp: any): OpportunityType {
  if (opp.opportunity_type) return opp.opportunity_type;
  // Infer from entity_type if not set
  const entityType = (opp.entity_type || "").toLowerCase();
  if (entityType.includes("trend")) return "trending";
  if (entityType.includes("event")) return "event";
  if (entityType.includes("advocacy") || entityType.includes("issue")) return "advocacy";
  if (entityType.includes("partner")) return "partnership";
  return "other";
}

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchOpportunities(organizationId: string): Promise<OpportunitiesData> {
  // Fetch opportunities from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from("fundraising_opportunities")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("opportunity_score", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[useOpportunitiesQuery] Fetch error:", error);
    throw error;
  }

  // Transform and enrich data
  const opportunities: Opportunity[] = ((data || []) as unknown as any[]).map((opp) => ({
    ...opp,
    status: inferStatus(opp),
    opportunity_type: inferType(opp),
    opportunity_score: opp.opportunity_score || 0,
    velocity: opp.velocity || 0,
    current_mentions: opp.current_mentions || 0,
    similar_past_events: opp.similar_past_events || 0,
    assigned_to: opp.assigned_to ?? null,
    notes: opp.notes ?? null,
  }));

  // Calculate aggregated stats
  const activeOpps = opportunities.filter((o) => o.is_active);
  const highPriorityOpps = opportunities.filter((o) => o.opportunity_score >= 80);
  const readyToLaunchOpps = opportunities.filter(
    (o) => o.is_active && o.opportunity_score >= 70 && o.velocity > 0
  );

  // Count by status
  const byStatus: Record<OpportunityStatus, number> = {
    pending: 0,
    live: 0,
    completed: 0,
    dismissed: 0,
  };
  opportunities.forEach((opp) => {
    byStatus[opp.status]++;
  });

  // Count by type
  const byType: Record<OpportunityType, number> = {
    trending: 0,
    event: 0,
    advocacy: 0,
    partnership: 0,
    other: 0,
  };
  opportunities.forEach((opp) => {
    byType[opp.opportunity_type]++;
  });

  const stats: OpportunityStats = {
    total: opportunities.length,
    active: activeOpps.length,
    highPriority: highPriorityOpps.length,
    highPriorityPercent:
      opportunities.length > 0
        ? Math.round((highPriorityOpps.length / opportunities.length) * 100)
        : 0,
    avgScore:
      opportunities.length > 0
        ? Math.round(
            opportunities.reduce((sum, o) => sum + o.opportunity_score, 0) / opportunities.length
          )
        : 0,
    avgEstimatedValue:
      activeOpps.filter((o) => o.estimated_value).length > 0
        ? Math.round(
            activeOpps
              .filter((o) => o.estimated_value)
              .reduce((sum, o) => sum + (o.estimated_value || 0), 0) /
              activeOpps.filter((o) => o.estimated_value).length
          )
        : 0,
    readyToLaunch: readyToLaunchOpps.length,
    byStatus,
    byType,
    lastRefreshed: new Date().toISOString(),
  };

  return {
    opportunities,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useOpportunitiesQuery(
  organizationId: string | undefined
): OpportunitiesQueryResult {
  const query = useQuery({
    queryKey: opportunitiesKeys.list(organizationId || ""),
    queryFn: () => fetchOpportunities(organizationId!),
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute - opportunities don't change as frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Auto-refresh every minute
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

export function useMarkOpportunityComplete(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { error } = await supabase
        .from("fundraising_opportunities")
        .update({ status: "completed", is_active: false })
        .eq("id", opportunityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKeys.list(organizationId || ""),
      });
    },
  });
}

export function useDismissOpportunity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { error } = await supabase
        .from("fundraising_opportunities")
        .update({ is_active: false, status: "dismissed" })
        .eq("id", opportunityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKeys.list(organizationId || ""),
      });
    },
  });
}

export function useAssignOpportunity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      assignedTo,
    }: {
      opportunityId: string;
      assignedTo: string;
    }) => {
      const { error } = await supabase
        .from("fundraising_opportunities")
        .update({ assigned_to: assignedTo, status: "live" } as any)
        .eq("id", opportunityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKeys.list(organizationId || ""),
      });
    },
  });
}

export function useUpdateOpportunityNotes(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      notes,
    }: {
      opportunityId: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from("fundraising_opportunities")
        .update({ notes } as any)
        .eq("id", opportunityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKeys.list(organizationId || ""),
      });
    },
  });
}

export function useReactivateOpportunity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { error } = await supabase
        .from("fundraising_opportunities")
        .update({ is_active: true, status: "pending" })
        .eq("id", opportunityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: opportunitiesKeys.list(organizationId || ""),
      });
    },
  });
}
