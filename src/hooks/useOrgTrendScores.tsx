import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Organization-specific trend scoring data
 */
export interface OrgTrendScore {
  id: string;
  trend_event_id: string;
  organization_id: string;
  relevance_score: number;
  urgency_score: number;
  priority_bucket: 'critical' | 'high' | 'medium' | 'low';
  is_allowlisted: boolean;
  is_blocked: boolean;
  matched_topics: string[];
  matched_entities: string[];
  matched_geographies: string[];
  explanation: {
    reasons?: string[];
    score_breakdown?: Record<string, number>;
    topic_matches?: string[];
  } | null;
  computed_at: string;
  expires_at: string;
}

interface UseOrgTrendScoresOptions {
  organizationId?: string;
  trendEventIds?: string[];
}

/**
 * Hook to fetch organization-specific trend relevance scores
 */
export const useOrgTrendScores = (options: UseOrgTrendScoresOptions = {}) => {
  const { organizationId, trendEventIds } = options;
  
  const [scores, setScores] = useState<Map<string, OrgTrendScore>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    if (!trendEventIds || trendEventIds.length === 0) {
      setScores(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('org_trend_scores')
        .select('*')
        .in('trend_event_id', trendEventIds)
        .gte('expires_at', new Date().toISOString());

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // Map by trend_event_id for easy lookup
      const scoreMap = new Map<string, OrgTrendScore>();
      (data || []).forEach((score) => {
        scoreMap.set(score.trend_event_id, score as unknown as OrgTrendScore);
      });

      setScores(scoreMap);
    } catch (err: any) {
      console.error('Failed to fetch org trend scores:', err);
      setError(err.message || 'Failed to load org scores');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, trendEventIds?.join(',')]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { scores, isLoading, error, refresh: fetchScores };
};

/**
 * Get a human-readable "why this matters" explanation
 */
export const getWhyItMattersText = (
  score: OrgTrendScore | undefined,
  orgName?: string
): string | null => {
  if (!score) return null;

  const parts: string[] = [];
  const explanation = score.explanation;

  // Primary reasons from the scoring system
  if (explanation?.reasons && explanation.reasons.length > 0) {
    parts.push(...explanation.reasons);
  }

  // Topic matches
  if (score.matched_topics && score.matched_topics.length > 0) {
    parts.push(`Matches your priority topics: ${score.matched_topics.join(', ')}`);
  }

  // Entity matches
  if (score.matched_entities && score.matched_entities.length > 0) {
    parts.push(`Involves watched entities: ${score.matched_entities.join(', ')}`);
  }

  // Geography matches
  if (score.matched_geographies && score.matched_geographies.length > 0) {
    parts.push(`Affects your target regions: ${score.matched_geographies.join(', ')}`);
  }

  if (parts.length === 0) {
    return null;
  }

  const prefix = orgName ? `This matters to ${orgName} because: ` : '';
  return prefix + parts.slice(0, 2).join('. ') + '.';
};

/**
 * Get matched reasons as tags for display
 */
export const getMatchedReasonTags = (score: OrgTrendScore | undefined): string[] => {
  if (!score) return [];

  const tags: string[] = [];

  // Add topic matches
  if (score.matched_topics) {
    tags.push(...score.matched_topics);
  }

  // Add entity matches
  if (score.matched_entities) {
    tags.push(...score.matched_entities);
  }

  // Add geography matches
  if (score.matched_geographies) {
    tags.push(...score.matched_geographies);
  }

  return tags.slice(0, 5); // Max 5 tags
};

/**
 * Get priority bucket styling
 */
export const getPriorityBucketStyle = (bucket: OrgTrendScore['priority_bucket']): {
  label: string;
  className: string;
} => {
  switch (bucket) {
    case 'critical':
      return {
        label: 'Critical',
        className: 'bg-destructive/10 text-destructive border-destructive/30',
      };
    case 'high':
      return {
        label: 'High Priority',
        className: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30',
      };
    case 'medium':
      return {
        label: 'Medium',
        className: 'bg-[hsl(var(--portal-info))]/10 text-[hsl(var(--portal-info))] border-[hsl(var(--portal-info))]/30',
      };
    case 'low':
    default:
      return {
        label: 'Low',
        className: 'bg-muted text-muted-foreground',
      };
  }
};
