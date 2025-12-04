import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  // Phase 5: Source distribution and summary (merged from PoliticalTrendsFeed)
  source_distribution?: {
    google_news?: number;
    reddit?: number;
    bluesky?: number;
    rss?: number;
  };
  cluster_summary?: string;
}

interface UseUnifiedTrendsOptions {
  limit?: number;
  breakthroughOnly?: boolean;
  excludeEvergreen?: boolean;
}

// Common evergreen terms that should be filtered out
const EVERGREEN_PATTERNS = [
  'white house',
  'congress',
  'president',
  'senate',
  'house of representatives',
  'supreme court',
  'federal government',
  'washington',
  'united states',
  'america',
  'government',
  'politics',
  'economy',
];

export const useUnifiedTrends = (options: UseUnifiedTrendsOptions = {}) => {
  const { limit = 10, breakthroughOnly = false, excludeEvergreen = true } = options;
  
  const [trends, setTrends] = useState<UnifiedTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch trends, watchlist, trend clusters (for related_topics), and evergreen topics in parallel
      let query = supabase
        .from('mv_unified_trends')
        .select('*')
        .order('unified_score', { ascending: false })
        .limit(limit + 20); // Fetch extra to account for filtering

      if (breakthroughOnly) {
        query = query.eq('is_breakthrough', true);
      }

      const [trendsResult, watchlistResult, headlinesResult, evergreenResult, clustersResult] = await Promise.all([
        query,
        supabase.from('entity_watchlist').select('entity_name'),
        // Get sample headlines for context
        supabase.from('articles')
          .select('title, tags')
          .gte('published_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('published_date', { ascending: false })
          .limit(100),
        // Get evergreen topics from database
        supabase.from('evergreen_topics').select('topic'),
      // Get related topics, velocity data, and source distribution from trend_clusters
        supabase.from('trend_clusters')
          .select('cluster_title, cluster_summary, related_topics, entity_type, is_breaking, trend_stage, acceleration, velocity_1h, velocity_6h, source_distribution')
          .eq('is_trending', true)
      ]);

      if (trendsResult.error) {
        console.error('Error fetching unified trends:', trendsResult.error);
        setError(trendsResult.error.message);
        return;
      }

      const watchlistEntities = (watchlistResult.data || []).map((w: any) => w.entity_name?.toLowerCase() || '');
      const headlines = headlinesResult.data || [];
      
      // Build map of cluster data for related topics, velocity, and source distribution
      const clusterMap = new Map<string, { 
        related_topics: string[], 
        entity_type: string, 
        is_breaking: boolean,
        trend_stage: string,
        acceleration: number,
        velocity_1h: number,
        velocity_6h: number,
        source_distribution: any,
        cluster_summary: string
      }>();
      for (const cluster of (clustersResult.data || [])) {
        const key = cluster.cluster_title?.toLowerCase() || '';
        clusterMap.set(key, {
          related_topics: cluster.related_topics || [],
          entity_type: cluster.entity_type || 'category',
          is_breaking: cluster.is_breaking || false,
          trend_stage: cluster.trend_stage || 'stable',
          acceleration: cluster.acceleration || 0,
          velocity_1h: cluster.velocity_1h || 0,
          velocity_6h: cluster.velocity_6h || 0,
          source_distribution: cluster.source_distribution || {},
          cluster_summary: cluster.cluster_summary || ''
        });
      }
      
      // Combine database evergreen with hardcoded patterns
      const dbEvergreen = (evergreenResult.data || []).map((e: any) => e.topic?.toLowerCase() || '');
      const allEvergreenPatterns = [...new Set([...EVERGREEN_PATTERNS, ...dbEvergreen])];

      // Filter and enrich trends
      let enrichedTrends = (trendsResult.data || [])
        .filter((trend: any) => {
          // Skip filtering if excludeEvergreen is false
          if (!excludeEvergreen) return true;
          
          const trendNameLower = trend.name?.toLowerCase() || '';
          const normalizedLower = trend.normalized_name?.toLowerCase() || '';
          
          // Check if this is an evergreen topic
          const isEvergreen = allEvergreenPatterns.some(pattern => 
            trendNameLower === pattern || 
            normalizedLower === pattern ||
            trendNameLower.includes(pattern) && trendNameLower.length < pattern.length + 5
          );
          
          return !isEvergreen;
        })
        .map((trend: any) => {
          const trendNameLower = trend.name?.toLowerCase() || '';
          const normalizedLower = trend.normalized_name?.toLowerCase() || '';
          
          // Check watchlist match
          const matchedEntity = watchlistEntities.find((entity: string) => 
            entity && (trendNameLower.includes(entity) || entity.includes(trendNameLower) || normalizedLower.includes(entity))
          );
          
          // Find a sample headline mentioning this topic
          const matchingHeadline = headlines.find((article: any) => 
            article.title?.toLowerCase().includes(trendNameLower) ||
            (article.tags && article.tags.some((tag: string) => tag?.toLowerCase().includes(trendNameLower)))
          );
          
          // Get related topics from cluster data
          const clusterData = clusterMap.get(trendNameLower) || clusterMap.get(normalizedLower);

          return {
            ...trend,
            matchesWatchlist: !!matchedEntity,
            watchlistEntity: matchedEntity || null,
            sampleHeadline: matchingHeadline?.title || null,
            related_topics: clusterData?.related_topics || [],
            entity_type: clusterData?.entity_type || 'category',
            is_breaking: clusterData?.is_breaking || false,
            trend_stage: clusterData?.trend_stage as UnifiedTrend['trend_stage'] || 'stable',
            acceleration: clusterData?.acceleration || 0,
            velocity_1h: clusterData?.velocity_1h || 0,
            velocity_6h: clusterData?.velocity_6h || 0,
            source_distribution: clusterData?.source_distribution || {},
            cluster_summary: clusterData?.cluster_summary || '',
          } as UnifiedTrend;
        });

      // Limit after filtering
      enrichedTrends = enrichedTrends.slice(0, limit);

      setTrends(enrichedTrends);
    } catch (err) {
      console.error('Failed to fetch unified trends:', err);
      setError('Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [limit, breakthroughOnly, excludeEvergreen]);

  useEffect(() => {
    fetchTrends();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchTrends, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrends]);

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
