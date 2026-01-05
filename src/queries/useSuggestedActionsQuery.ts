import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type ActionStatus = "pending" | "used" | "dismissed";
export type ActionType = "sms" | "email" | "social" | "call" | "other";
export type UrgencyLevel = "high" | "medium" | "low";
export type VariantType = "safe" | "urgency" | "values" | "contrast";
export type ComplianceStatus = "pass" | "review" | "blocked" | "pending";

export interface DecisionScores {
  decision_score: number;
  opportunity_score: number;
  fit_score: number;
  risk_score: number;
  confidence_score: number;
}

export interface ComplianceChecks {
  has_sender_id?: boolean;
  has_stop_language?: boolean;
  within_char_limit?: boolean;
  character_count?: number;
  character_limit?: number;
  sensitive_claims_detected?: string[];
  risk_flags?: string[];
}

export interface GenerationRationale {
  signals?: {
    opportunity?: string[];
    fit?: string[];
    risk?: string[];
    confidence?: string[];
  };
  assumptions?: string[];
  risks?: string[];
}

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
  generation_method?: "ai" | "template" | "template_fallback" | string;
  
  // Decision scoring
  decision_score?: number;
  opportunity_score?: number;
  fit_score?: number;
  risk_score?: number;
  confidence_score?: number;
  
  // Compliance
  compliance_status?: ComplianceStatus;
  compliance_checks?: ComplianceChecks;
  
  // Variants
  variant_type?: VariantType;
  variant_group_id?: string;
  
  // Rationale
  generation_rationale?: GenerationRationale;
  
  // Tier (computed)
  tier?: 'act_now' | 'consider' | 'watch';
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
  byTier: {
    act_now: number;
    consider: number;
    watch: number;
  };
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

export function getUrgencyLevel(score: number): UrgencyLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function computeTier(action: any): 'act_now' | 'consider' | 'watch' {
  const decisionScore = action.decision_score ?? action.urgency_score ?? 0;
  const riskScore = action.risk_score ?? 85;
  const confidenceScore = action.confidence_score ?? 50;
  
  if (decisionScore >= 65 && riskScore >= 50 && confidenceScore >= 40) {
    return 'act_now';
  } else if (decisionScore >= 40 && riskScore >= 30) {
    return 'consider';
  }
  return 'watch';
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

  // Map database columns to expected interface
  const actions: SuggestedAction[] = (data || []).map((a: any) => {
    const mapped: SuggestedAction = {
      id: a.id,
      organization_id: a.organization_id,
      alert_id: a.alert_id,
      topic: a.entity_name || a.topic || "Unknown",
      action_type: a.action_type || "other",
      sms_copy: a.suggested_copy || "",
      topic_relevance_score: a.topic_relevance || a.org_relevance_score || 0,
      urgency_score: a.urgency_score || a.opportunity_score || 0,
      estimated_impact: a.estimated_impact || `${a.urgency_score || 0}% urgency`,
      value_proposition: a.value_prop || "Timely engagement opportunity",
      target_audience: a.audience_segment || "Active supporters",
      historical_context: a.historical_performance ? JSON.stringify(a.historical_performance) : null,
      character_count: a.character_count || (a.suggested_copy?.length || 0),
      is_used: a.is_used === true || a.status === "used",
      is_dismissed: a.is_dismissed === true || a.status === "dismissed",
      used_at: a.used_at,
      created_at: a.created_at,
      alert: a.alert,
      generation_method: a.generation_method || "template",
      
      // Decision scoring
      decision_score: a.decision_score,
      opportunity_score: a.opportunity_score,
      fit_score: a.fit_score,
      risk_score: a.risk_score,
      confidence_score: a.confidence_score,
      
      // Compliance
      compliance_status: a.compliance_status || 'pending',
      compliance_checks: a.compliance_checks,
      
      // Variants
      variant_type: a.variant_type,
      variant_group_id: a.variant_group_id,
      
      // Rationale
      generation_rationale: a.generation_rationale,
    };
    
    // Compute tier
    mapped.tier = computeTier(a);
    
    return mapped;
  });

  // Calculate aggregated stats
  const pendingActions = actions.filter((a) => !a.is_used && !a.is_dismissed);
  const usedActions = actions.filter((a) => a.is_used);
  const dismissedActions = actions.filter((a) => a.is_dismissed);
  const highUrgencyActions = actions.filter((a) => (a.decision_score ?? a.urgency_score ?? 0) >= 70);

  // Count by action type
  const byType: Record<string, number> = {};
  actions.forEach((action) => {
    const type = action.action_type || "other";
    byType[type] = (byType[type] || 0) + 1;
  });

  // Count by tier
  const byTier = {
    act_now: pendingActions.filter(a => a.tier === 'act_now').length,
    consider: pendingActions.filter(a => a.tier === 'consider').length,
    watch: pendingActions.filter(a => a.tier === 'watch').length,
  };

  const stats: ActionStats = {
    total: actions.length,
    pending: pendingActions.length,
    used: usedActions.length,
    dismissed: dismissedActions.length,
    actionablePercent:
      actions.length > 0
        ? Math.round(
            (actions.filter((a) => (a.decision_score ?? a.topic_relevance_score) >= 60).length / actions.length) * 100
          )
        : 0,
    avgUrgency:
      actions.length > 0
        ? Math.round(actions.reduce((sum, a) => sum + (a.decision_score ?? a.urgency_score ?? 0), 0) / actions.length)
        : 0,
    avgRelevance:
      actions.length > 0
        ? Math.round(
            actions.reduce((sum, a) => sum + (a.fit_score ?? a.topic_relevance_score ?? 0), 0) / actions.length
          )
        : 0,
    highUrgencyCount: highUrgencyActions.length,
    byType,
    byTier,
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
        .eq("is_dismissed", false);

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
    mutationFn: async ({ 
      actionId, 
      reasonCode, 
      reasonDetail 
    }: { 
      actionId: string; 
      reasonCode?: string; 
      reasonDetail?: string;
    }) => {
      // Update the action as dismissed
      const { error } = await supabase
        .from("suggested_actions")
        .update({ is_dismissed: true })
        .eq("id", actionId);

      if (error) throw error;
      
      // Record feedback event if reason provided
      if (reasonCode) {
        await supabase.from("org_feedback_events").insert({
          organization_id: organizationId,
          event_type: 'action_dismissed',
          object_type: 'suggested_action',
          object_id: actionId,
          reason_code: reasonCode,
          reason_detail: reasonDetail,
        } as any);
      }
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
        .update({ is_dismissed: false })
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

// Record that user copied and possibly edited the message
export function useRecordCopyAction(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      actionId, 
      editedCopy,
      wasSent = false,
    }: { 
      actionId: string; 
      editedCopy?: string;
      wasSent?: boolean;
    }) => {
      const updates: any = { 
        is_used: true, 
        used_at: new Date().toISOString() 
      };
      
      if (editedCopy) {
        updates.edited_copy = editedCopy;
        updates.was_edited = true;
      }
      
      if (wasSent) {
        updates.was_sent = true;
      }

      const { error } = await supabase
        .from("suggested_actions")
        .update(updates)
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

// Record thumbs up/down feedback
export function useRecordFeedback(organizationId: string | undefined) {
  return useMutation({
    mutationFn: async ({ 
      actionId, 
      isPositive,
      reasonCode,
      reasonDetail,
    }: { 
      actionId: string; 
      isPositive: boolean;
      reasonCode?: string;
      reasonDetail?: string;
    }) => {
      const { error } = await supabase.from("org_feedback_events").insert({
        organization_id: organizationId,
        event_type: isPositive ? 'action_thumbs_up' : 'action_thumbs_down',
        object_type: 'suggested_action',
        object_id: actionId,
        reason_code: reasonCode,
        reason_detail: reasonDetail,
      } as any);

      if (error) throw error;
    },
  });
}
