/**
 * Hook for fetching org-scoped relevance scores and explanations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

// ============================================================================
// Types
// ============================================================================

export interface OrgTrendExplanation {
  reasons: string[];
  score_breakdown: Record<string, number>;
  topic_matches?: Array<{ topic: string; weight: number }>;
  entity_match?: { name: string; type: string };
  geo_match?: string;
}

export interface OrgTrendScore {
  id: string;
  organization_id: string;
  trend_key: string;
  trend_event_id?: string | null;
  trend_cluster_id?: string | null;
  relevance_score: number;
  urgency_score: number;
  priority_bucket: 'high' | 'medium' | 'low';
  is_blocked: boolean;
  is_allowlisted: boolean;
  matched_topics: string[];
  matched_entities: string[];
  matched_geographies: string[];
  explanation: OrgTrendExplanation;
  computed_at: string;
}

export interface OrgAlertPreferences {
  id: string;
  organization_id: string;
  min_relevance_score: number;
  min_urgency_score: number;
  max_alerts_per_day: number;
  digest_mode: 'realtime' | 'hourly_digest' | 'daily_digest';
  notify_channels: string[];
  quiet_hours_start?: number;
  quiet_hours_end?: number;
}

interface UseOrgRelevanceOptions {
  minScore?: number;
  priorityBucket?: 'high' | 'medium' | 'low';
  limit?: number;
}

// ============================================================================
// Query Keys
// ============================================================================

const orgRelevanceKeys = {
  all: ['org-relevance'] as const,
  scores: (orgId: string) => [...orgRelevanceKeys.all, 'scores', orgId] as const,
  score: (orgId: string, trendKey: string) => [...orgRelevanceKeys.scores(orgId), trendKey] as const,
  preferences: (orgId: string) => [...orgRelevanceKeys.all, 'preferences', orgId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch org-scoped trend relevance scores
 */
export function useOrgTrendScores(
  organizationId: string | undefined,
  options: UseOrgRelevanceOptions = {}
) {
  const { minScore = 0, priorityBucket, limit = 50 } = options;

  return useQuery({
    queryKey: orgRelevanceKeys.scores(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('org_trend_scores')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_blocked', false)
        .gte('relevance_score', minScore)
        .gt('expires_at', new Date().toISOString())
        .order('relevance_score', { ascending: false })
        .limit(limit);

      if (priorityBucket) {
        query = query.eq('priority_bucket', priorityBucket);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map data with proper typing for JSONB explanation field
      return (data || []).map(row => ({
        ...row,
        priority_bucket: row.priority_bucket as 'high' | 'medium' | 'low',
        explanation: (row.explanation as unknown as OrgTrendExplanation) || { reasons: [], score_breakdown: {} },
      })) as OrgTrendScore[];
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get relevance score for a specific trend
 */
export function useTrendRelevance(
  organizationId: string | undefined,
  trendKey: string | undefined
) {
  return useQuery({
    queryKey: orgRelevanceKeys.score(organizationId || '', trendKey || ''),
    queryFn: async () => {
      if (!organizationId || !trendKey) return null;

      const normalizedKey = trendKey.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

      const { data, error } = await supabase
        .from('org_trend_scores')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('trend_key', normalizedKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        priority_bucket: data.priority_bucket as 'high' | 'medium' | 'low',
        explanation: (data.explanation as unknown as OrgTrendExplanation) || { reasons: [], score_breakdown: {} },
      } as OrgTrendScore;
    },
    enabled: !!organizationId && !!trendKey,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch org alert preferences
 */
export function useOrgAlertPreferences(organizationId: string | undefined) {
  return useQuery({
    queryKey: orgRelevanceKeys.preferences(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('org_alert_preferences')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Return defaults if no preferences set
      if (!data) {
        return {
          id: '',
          organization_id: organizationId,
          min_relevance_score: 40,
          min_urgency_score: 30,
          max_alerts_per_day: 20,
          digest_mode: 'realtime' as const,
          notify_channels: ['email', 'in_app'],
        } as OrgAlertPreferences;
      }

      return {
        ...data,
        digest_mode: data.digest_mode as 'realtime' | 'hourly_digest' | 'daily_digest',
      } as OrgAlertPreferences;
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Update org alert preferences
 */
export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      preferences: Partial<Omit<OrgAlertPreferences, 'id' | 'organization_id'>>;
    }) => {
      const { organizationId, preferences } = params;

      const { data, error } = await supabase
        .from('org_alert_preferences')
        .upsert(
          {
            organization_id: organizationId,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orgRelevanceKeys.preferences(variables.organizationId),
      });
    },
  });
}

/**
 * Get relevance summary stats for an org
 */
export function useOrgRelevanceSummary(organizationId: string | undefined) {
  const { data: scores, isLoading } = useOrgTrendScores(organizationId, { limit: 100 });

  if (isLoading || !scores) {
    return {
      isLoading,
      totalTrends: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      avgRelevance: 0,
      topTopics: [] as string[],
      topEntities: [] as string[],
    };
  }

  const highPriority = scores.filter(s => s.priority_bucket === 'high').length;
  const mediumPriority = scores.filter(s => s.priority_bucket === 'medium').length;
  const lowPriority = scores.filter(s => s.priority_bucket === 'low').length;
  
  const avgRelevance = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.relevance_score, 0) / scores.length)
    : 0;

  // Aggregate top topics and entities
  const topicCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();

  for (const score of scores) {
    for (const topic of score.matched_topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
    for (const entity of score.matched_entities) {
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
    }
  }

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  const topEntities = Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([entity]) => entity);

  return {
    isLoading,
    totalTrends: scores.length,
    highPriority,
    mediumPriority,
    lowPriority,
    avgRelevance,
    topTopics,
    topEntities,
  };
}

/**
 * Hook to get relevance map for unified trends
 * Returns a Map of trend_key -> OrgTrendScore for quick lookup
 */
export function useRelevanceMap(organizationId: string | undefined) {
  const { data: scores, isLoading, error } = useOrgTrendScores(organizationId, { 
    minScore: 10,
    limit: 200 
  });

  const relevanceMap = new Map<string, OrgTrendScore>();
  
  if (scores) {
    for (const score of scores) {
      relevanceMap.set(score.trend_key, score);
    }
  }

  return { relevanceMap, isLoading, error };
}
