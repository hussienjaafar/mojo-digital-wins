import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMaintenanceMode } from '@/contexts/MaintenanceContext';

/**
 * UnifiedTrend - Maps trend_events data to the legacy UnifiedTrend interface
 * This hook now uses trend_events as the single source of truth (migrated from trend_clusters)
 */
export interface UnifiedTrend {
  name: string;
  normalized_name: string;
  total_mentions_1h: number;
  total_mentions_6h: number;
  total_mentions_24h: number;
  velocity: number;
  avg_sentiment: number | null;
  spike_ratio: number;
  baseline_hourly: number;
  is_breakthrough: boolean;
  source_types: string[];
  source_count: number;
  last_updated: string;
  unified_score: number;
  // Enhanced context
  matchesWatchlist?: boolean;
  watchlistEntity?: string;
  sampleHeadline?: string;
  // Phase 3: Related topics
  related_topics?: string[];
  entity_type?: string;
  is_breaking?: boolean;
  // Phase 4: Enhanced velocity
  trend_stage?: 'emerging' | 'surging' | 'peaking' | 'declining' | 'stable';
  acceleration?: number;
  velocity_1h?: number;
  velocity_6h?: number;
  // Phase 5: Source distribution and summary
  source_distribution?: {
    google_news?: number;
    reddit?: number;
    bluesky?: number;
    rss?: number;
  };
  cluster_summary?: string;
  // Phase 6: Org relevance
  org_relevance_score?: number;
  org_priority_bucket?: 'high' | 'medium' | 'low';
  org_relevance_reasons?: string[];
  org_matched_topics?: string[];
  org_matched_entities?: string[];
  // trend_events source fields
  event_id?: string;
  confidence_score?: number;
  // Phase 3: Rank score for Twitter-like ranking
  rank_score?: number;
  recency_decay?: number;
  evergreen_penalty?: number;
}

interface UseUnifiedTrendsOptions {
  limit?: number;
  breakthroughOnly?: boolean;
  excludeEvergreen?: boolean;
  organizationId?: string;
}

// Common evergreen terms that should be filtered out (only truly generic ones)
const EVERGREEN_PATTERNS = [
  'federal government',
  'united states',
  'america',
  'government',
  'politics',
  'economy',
  'breaking news',
  'news update',
];

export const useUnifiedTrends = (options: UseUnifiedTrendsOptions = {}) => {
  const { limit = 30, breakthroughOnly = false, excludeEvergreen = true, organizationId } = options;
  const { isMaintenanceMode } = useMaintenanceMode();
  
  const [trends, setTrends] = useState<UnifiedTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    // Skip heavy queries during maintenance mode
    if (isMaintenanceMode) {
      setTrends([]);
      setIsLoading(false);
      setError('Maintenance mode - trends temporarily unavailable');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Build parallel queries - now using trend_events as single source of truth
      // PHASE 3: Order by rank_score (Twitter-like ranking) instead of just confidence
      let trendEventsQuery = supabase
        .from('trend_events')
        .select('*')
        .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .gte('confidence_score', 20)
        .order('rank_score', { ascending: false, nullsFirst: false })
        .order('is_breaking', { ascending: false })
        .order('confidence_score', { ascending: false })
        .limit(limit + 50);
      
      const watchlistPromise = supabase.from('entity_watchlist').select('entity_name');
      const evergreenPromise = supabase.from('evergreen_topics').select('topic');

      // Fetch org relevance scores if organizationId provided
      const orgScoresPromise = organizationId 
        ? supabase.from('org_trend_scores')
            .select('trend_key, relevance_score, priority_bucket, matched_topics, matched_entities, explanation')
            .eq('organization_id', organizationId)
            .eq('is_blocked', false)
            .gte('relevance_score', 10)
            .gt('expires_at', new Date().toISOString())
        : Promise.resolve({ data: null, error: null });

      const [eventsResult, watchlistResult, evergreenResult, orgScoresResult] = await Promise.all([
        trendEventsQuery,
        watchlistPromise,
        evergreenPromise,
        orgScoresPromise,
      ]);

      if (eventsResult.error) {
        console.error('Error fetching trend events:', eventsResult.error);
        setError(eventsResult.error.message);
        return;
      }

      const watchlistEntities = (watchlistResult.data || []).map((w: any) => w.entity_name?.toLowerCase() || '');
      const dbEvergreen = (evergreenResult.data || []).map((e: any) => e.topic?.toLowerCase() || '');
      const allEvergreenPatterns = [...new Set([...EVERGREEN_PATTERNS, ...dbEvergreen])];

      // Build org relevance lookup map
      const orgRelevanceMap = new Map<string, any>();
      if (orgScoresResult?.data) {
        for (const score of orgScoresResult.data) {
          orgRelevanceMap.set(score.trend_key, score);
        }
      }

      // Transform trend_events to UnifiedTrend format
      let enrichedTrends = (eventsResult.data || [])
        .filter((event: any) => {
          if (!excludeEvergreen) return true;
          
          const eventNameLower = event.event_title?.toLowerCase() || '';
          const totalMentions = event.current_24h || 0;
          const sourceCount = event.source_count || 0;
          
          // Allow high-volume cross-source topics even if they match evergreen patterns
          if (totalMentions >= 20 && sourceCount >= 2) {
            return true;
          }
          
          const isEvergreen = allEvergreenPatterns.some(pattern => 
            eventNameLower === pattern || 
            (eventNameLower.includes(pattern) && eventNameLower.length < pattern.length + 5)
          );
          
          return !isEvergreen;
        })
        .map((event: any) => {
          const eventNameLower = event.event_title?.toLowerCase() || '';
          
          // Map trend_events fields to UnifiedTrend interface
          const current1h = event.current_1h || 0;
          const current6h = event.current_6h || 0;
          const current24h = event.current_24h || 0;
          const baseline7d = event.baseline_7d || 0;
          const baselineHourly = baseline7d > 0 ? baseline7d / (7 * 24) : (current24h > 0 ? current24h / 24 : 0);
          const spikeRatio = baselineHourly > 0 ? Math.min(5, Math.max(1, current1h / baselineHourly)) : 1;
          
          // PHASE 3: Calculate unified score using rank_score as primary factor
          // rank_score already incorporates: z-score velocity, corroboration, recency, evergreen suppression
          const rankScore = event.rank_score || 0;
          const unifiedScore = rankScore * 10 + 
            (event.is_breaking ? 200 : 0) +
            (event.source_count >= 3 ? 50 : event.source_count >= 2 ? 25 : 0);
          
          // Determine source types
          const sourceTypes: string[] = [];
          if ((event.news_source_count || 0) > 0) sourceTypes.push('news');
          if ((event.social_source_count || 0) > 0) sourceTypes.push('social');
          
          // Check watchlist match
          const matchedEntity = watchlistEntities.find((entity: string) => 
            entity && (eventNameLower.includes(entity) || entity.includes(eventNameLower))
          );

          // Look up org relevance from map
          const normalizedKey = eventNameLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
          const orgRelevance = orgRelevanceMap.get(normalizedKey);

          return {
            name: event.event_title,
            normalized_name: eventNameLower,
            total_mentions_1h: current1h,
            total_mentions_6h: current6h,
            total_mentions_24h: current24h,
            velocity: event.velocity || 0,
            avg_sentiment: event.sentiment_score || null,
            spike_ratio: spikeRatio,
            baseline_hourly: baselineHourly,
            is_breakthrough: event.is_breaking || (event.confidence_score >= 70 && event.source_count >= 2),
            source_types: sourceTypes,
            source_count: event.source_count || 0,
            last_updated: event.last_seen_at,
            unified_score: unifiedScore,
            matchesWatchlist: !!matchedEntity,
            watchlistEntity: matchedEntity || null,
            sampleHeadline: event.top_headline || null,
            related_topics: [],
            entity_type: 'category',
            is_breaking: event.is_breaking || false,
            trend_stage: event.trend_stage as UnifiedTrend['trend_stage'] || 'stable',
            acceleration: event.acceleration || 0,
            velocity_1h: event.velocity_1h || 0,
            velocity_6h: event.velocity_6h || 0,
            source_distribution: {
              google_news: 0,
              reddit: 0,
              bluesky: event.social_source_count || 0,
              rss: event.news_source_count || 0,
            },
            cluster_summary: '',
            org_relevance_score: orgRelevance?.relevance_score,
            org_priority_bucket: orgRelevance?.priority_bucket,
            org_relevance_reasons: orgRelevance?.explanation?.reasons || [],
            org_matched_topics: orgRelevance?.matched_topics || [],
            org_matched_entities: orgRelevance?.matched_entities || [],
            event_id: event.id,
            confidence_score: event.confidence_score || 0,
            // Phase 3: Include rank score metrics
            rank_score: rankScore,
            recency_decay: event.recency_decay || 1.0,
            evergreen_penalty: event.evergreen_penalty || 1.0,
          } as UnifiedTrend;
        })
        // PHASE 3: Sort by rank_score first (Twitter-like), then by org relevance if available
        .sort((a, b) => {
          // Prioritize org relevance if both have scores
          if (a.org_relevance_score && b.org_relevance_score) {
            return b.org_relevance_score - a.org_relevance_score;
          }
          // Otherwise sort by rank_score (primary) then unified_score (secondary)
          const rankDiff = (b.rank_score || 0) - (a.rank_score || 0);
          if (Math.abs(rankDiff) > 0.1) return rankDiff;
          return b.unified_score - a.unified_score;
        });

      // Filter for breakthrough only if requested
      if (breakthroughOnly) {
        enrichedTrends = enrichedTrends.filter(t => t.is_breakthrough);
      }

      // Limit after filtering and scoring
      enrichedTrends = enrichedTrends.slice(0, limit);

      setTrends(enrichedTrends);
    } catch (err) {
      console.error('Failed to fetch unified trends:', err);
      setError('Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [limit, breakthroughOnly, excludeEvergreen, isMaintenanceMode, organizationId]);

  useEffect(() => {
    fetchTrends();
    
    // Refresh every 2 minutes (skip during maintenance)
    const interval = setInterval(() => {
      if (!isMaintenanceMode) fetchTrends();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrends, isMaintenanceMode]);

  const stats = {
    totalTrending: trends.length,
    breakthroughs: trends.filter(t => t.is_breakthrough).length,
    multiSourceTrends: trends.filter(t => t.source_count >= 2).length,
    avgSentiment: trends.reduce((acc, t) => acc + (t.avg_sentiment || 0), 0) / trends.length || 0,
    watchlistMatches: trends.filter(t => t.matchesWatchlist).length,
  };

  return { trends, isLoading, error, stats, refresh: fetchTrends };
};

// Helper to get spike ratio color
export const getSpikeRatioColor = (spikeRatio: number): string => {
  if (spikeRatio >= 4) return 'text-destructive';
  if (spikeRatio >= 3) return 'text-orange-500';
  if (spikeRatio >= 2) return 'text-yellow-500';
  return 'text-muted-foreground';
};

// Helper to format spike ratio as a label
export const formatSpikeRatio = (spikeRatio: number): string => {
  if (spikeRatio >= 4) return 'Surging';
  if (spikeRatio >= 3) return 'Rising fast';
  if (spikeRatio >= 2) return 'Trending';
  return '';
};
