import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface TrendOutcome {
  id: string;
  organization_id: string;
  trend_event_id: string | null;
  trend_key: string;
  actions_sent: number;
  total_outcomes: number;
  total_donations: number;
  total_donation_amount: number;
  total_clicks: number;
  response_rate: number | null;
  donation_rate: number | null;
  avg_donation: number | null;
  baseline_response_rate: number | null;
  performance_delta: number | null;
  should_boost_relevance: boolean;
  learning_signal: string | null;
  computed_at: string;
  window_start: string | null;
  window_end: string | null;
}

export interface OutcomeStats {
  responseRate: number;
  donationRate: number;
  performanceDelta: number;
  actionsSent: number;
  totalDonations: number;
  totalAmount: number;
  learningSignal: string | null;
  shouldBoost: boolean;
  isHighPerforming: boolean;
  confidenceLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Query Keys
// ============================================================================

export const trendOutcomeKeys = {
  all: ['trend-outcomes'] as const,
  byOrg: (orgId: string) => [...trendOutcomeKeys.all, 'org', orgId] as const,
  byTrend: (orgId: string, trendKey: string) => 
    [...trendOutcomeKeys.all, 'trend', orgId, trendKey] as const,
  byEventId: (orgId: string, eventId: string) => 
    [...trendOutcomeKeys.all, 'event', orgId, eventId] as const,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate confidence level based on sample size
 */
function getConfidenceLevel(actionsSent: number): 'low' | 'medium' | 'high' {
  if (actionsSent >= 100) return 'high';
  if (actionsSent >= 30) return 'medium';
  return 'low';
}

/**
 * Determine if outcome is high-performing based on signals
 */
function isHighPerforming(outcome: TrendOutcome): boolean {
  // Require minimum sample size
  if (outcome.actions_sent < 10) return false;
  
  // Check for positive signals
  const hasPositiveDelta = (outcome.performance_delta ?? 0) > 5;
  const hasGoodResponseRate = (outcome.response_rate ?? 0) > 3;
  const hasBoostFlag = outcome.should_boost_relevance;
  
  return hasPositiveDelta || hasGoodResponseRate || hasBoostFlag;
}

/**
 * Parse outcome into stats object
 */
function parseOutcomeStats(outcome: TrendOutcome | null): OutcomeStats | null {
  if (!outcome) return null;
  
  return {
    responseRate: outcome.response_rate ?? 0,
    donationRate: outcome.donation_rate ?? 0,
    performanceDelta: outcome.performance_delta ?? 0,
    actionsSent: outcome.actions_sent,
    totalDonations: outcome.total_donations,
    totalAmount: outcome.total_donation_amount,
    learningSignal: outcome.learning_signal,
    shouldBoost: outcome.should_boost_relevance,
    isHighPerforming: isHighPerforming(outcome),
    confidenceLevel: getConfidenceLevel(outcome.actions_sent),
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all outcome correlations for an organization
 */
export function useOrgTrendOutcomes(orgId: string | undefined) {
  return useQuery({
    queryKey: trendOutcomeKeys.byOrg(orgId || ''),
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('trend_outcome_correlation')
        .select('*')
        .eq('organization_id', orgId)
        .order('computed_at', { ascending: false });
      
      if (error) {
        console.error('[useTrendOutcomes] Error fetching org outcomes:', error);
        throw error;
      }
      
      return (data || []) as TrendOutcome[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch outcome for a specific trend by trend_key
 */
export function useTrendOutcome(orgId: string | undefined, trendKey: string | undefined) {
  return useQuery({
    queryKey: trendOutcomeKeys.byTrend(orgId || '', trendKey || ''),
    queryFn: async () => {
      if (!orgId || !trendKey) return null;
      
      const { data, error } = await supabase
        .from('trend_outcome_correlation')
        .select('*')
        .eq('organization_id', orgId)
        .eq('trend_key', trendKey)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useTrendOutcome] Error fetching trend outcome:', error);
        throw error;
      }
      
      return data as TrendOutcome | null;
    },
    enabled: !!orgId && !!trendKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: parseOutcomeStats,
  });
}

/**
 * Fetch outcome for a specific trend by event ID
 */
export function useTrendOutcomeByEventId(orgId: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: trendOutcomeKeys.byEventId(orgId || '', eventId || ''),
    queryFn: async () => {
      if (!orgId || !eventId) return null;
      
      const { data, error } = await supabase
        .from('trend_outcome_correlation')
        .select('*')
        .eq('organization_id', orgId)
        .eq('trend_event_id', eventId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useTrendOutcomeByEventId] Error:', error);
        throw error;
      }
      
      return data as TrendOutcome | null;
    },
    enabled: !!orgId && !!eventId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: parseOutcomeStats,
  });
}

/**
 * Create a map of trend_key -> outcome stats for efficient lookup
 */
export function useOrgTrendOutcomesMap(orgId: string | undefined) {
  const query = useOrgTrendOutcomes(orgId);
  
  const outcomesMap = new Map<string, OutcomeStats>();
  const eventIdMap = new Map<string, OutcomeStats>();
  
  if (query.data) {
    for (const outcome of query.data) {
      const stats = parseOutcomeStats(outcome);
      if (stats) {
        outcomesMap.set(outcome.trend_key, stats);
        if (outcome.trend_event_id) {
          eventIdMap.set(outcome.trend_event_id, stats);
        }
      }
    }
  }
  
  return {
    ...query,
    outcomesMap,
    eventIdMap,
    getByTrendKey: (key: string) => outcomesMap.get(key) || null,
    getByEventId: (id: string) => eventIdMap.get(id) || null,
  };
}
