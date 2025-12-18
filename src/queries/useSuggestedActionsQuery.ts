import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type ActionStatus = "pending" | "used" | "dismissed";
export type ActionType = "sms" | "email" | "social" | "call" | "other";
export type UrgencyLevel = "high" | "medium" | "low";

export interface SuggestedAction {
  id: string;
  organization_id: string;
  alert_id: string;
  topic: string;
  action_type: string;
  sms_copy: string;
  topic_relevance_score: number;
  urgency_score: number;
  estimated_impact: string;
  value_proposition: string;
  target_audience: string;
  historical_context: string | null;
  character_count: number;
  is_used: boolean;
  is_dismissed: boolean;
  used_at: string | null;
  created_at: string;
  alert?: {
    entity_name: string;
    actionable_score: number;
  } | null;
}

export interface ActionStats {
  total: number;
  pending: number;
  used: number;
  dismissed: number;
  actionablePercent: number;
  avgUrgency: number;
  avgRelevance: number;
  highUrgencyCount: number;
  byType: Record<string, number>;
  lastRefreshed: string;
}

export interface SuggestedActionsData {
  actions: SuggestedAction[];
  stats: ActionStats;
  fetchedAt: string;
}

export interface SuggestedActionsQueryResult {
  data: SuggestedActionsData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const suggestedActionsKeys = {
  all: ["suggestedActions"] as const,
  list: (orgId: string) => [...suggestedActionsKeys.all, "list", orgId] as const,
  detail: (orgId: string, actionId: string) =>
    [...suggestedActionsKeys.all, "detail", orgId, actionId] as const,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getUrgencyLevel(score: number): UrgencyLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchSuggestedActions(organizationId: string): Promise<SuggestedActionsData> {
  // Fetch actions from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from("suggested_actions")
    .select(`
      *,
      alert:client_entity_alerts(entity_name, actionable_score)
    `)
    .eq("organization_id", organizationId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[useSuggestedActionsQuery] Fetch error:", error);
    throw error;
  }

  const actions = (data || []) as unknown as SuggestedAction[];

  // Calculate aggregated stats
  const pendingActions = actions.filter((a) => !a.is_used && !a.is_dismissed);
  const usedActions = actions.filter((a) => a.is_used);
  const dismissedActions = actions.filter((a) => a.is_dismissed);
  const highUrgencyActions = actions.filter((a) => a.urgency_score >= 70);

  // Count by action type
  const byType: Record<string, number> = {};
  actions.forEach((action) => {
    const type = action.action_type || "other";
    byType[type] = (byType[type] || 0) + 1;
  });

  const stats: ActionStats = {
    total: actions.length,
    pending: pendingActions.length,
    used: usedActions.length,
    dismissed: dismissedActions.length,
    actionablePercent:
      actions.length > 0
        ? Math.round(
            (actions.filter((a) => a.topic_relevance_score >= 70).length / actions.length) * 100
          )
        : 0,
    avgUrgency:
      actions.length > 0
        ? Math.round(actions.reduce((sum, a) => sum + (a.urgency_score || 0), 0) / actions.length)
        : 0,
    avgRelevance:
      actions.length > 0
        ? Math.round(
            actions.reduce((sum, a) => sum + (a.topic_relevance_score || 0), 0) / actions.length
          )
        : 0,
    highUrgencyCount: highUrgencyActions.length,
    byType,
    lastRefreshed: new Date().toISOString(),
  };

  return {
    actions,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useSuggestedActionsQuery(
  organizationId: string | undefined
): SuggestedActionsQueryResult {
  const query = useQuery({
    queryKey: suggestedActionsKeys.list(organizationId || ""),
    queryFn: () => fetchSuggestedActions(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds - actions should refresh quickly
    gcTime: 5 * 60 * 1000, // 5 minutes
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

export function useMarkActionUsed(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("suggested_actions")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("id", actionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: suggestedActionsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useMarkAllActionsUsed(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { error } = await (supabase as any)
        .from("suggested_actions")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("is_used", false)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: suggestedActionsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useDismissAction(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("suggested_actions")
        .update({ status: "dismissed" } as any)
        .eq("id", actionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: suggestedActionsKeys.list(organizationId || ""),
      });
    },
  });
}

export function useUndoDismissAction(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("suggested_actions")
        .update({ status: "pending" } as any)
        .eq("id", actionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: suggestedActionsKeys.list(organizationId || ""),
      });
    },
  });
}

// ============================================================================
// Utility Exports
// ============================================================================

export { getUrgencyLevel };
