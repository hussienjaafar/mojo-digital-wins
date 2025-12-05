import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMaintenanceMode } from '@/contexts/MaintenanceContext';

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

// Common evergreen terms that should be filtered out (only truly generic ones)
// Allow specific orgs like FBI, DOJ, Pentagon when they have high volume
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

// Calculate weighted unified score with source authority and volume-gated spike bonuses
const calculateUnifiedScore = (trend: any): number => {
  const googleCount = trend.google_news_count || 0;
  const redditCount = trend.reddit_count || 0;
  const blueskyCount = trend.bluesky_count || 0;
  const rssCount = trend.rss_count || 0;
  const totalMentions = trend.mentions_last_24h || 0;
  const velocity = Math.min(trend.velocity_score || 0, 500);
  
  // Source authority weighting - news sources weighted higher
  const weightedVolume = (googleCount * 15) + (rssCount * 12) + (redditCount * 10) + (blueskyCount * 8);
  
  // Count unique sources
  const sourceCount = [googleCount > 0, redditCount > 0, blueskyCount > 0, rssCount > 0].filter(Boolean).length;
  
  // Strong cross-source bonus (the key quality signal)
  const crossSourceBonus = sourceCount >= 4 ? 300 : sourceCount >= 3 ? 200 : sourceCount >= 2 ? 100 : 0;
  
  // Calculate spike ratio
  const mentions1h = trend.mentions_last_hour || 0;
  const mentions6h = trend.mentions_last_6h || 0;
  const baselineHourly = mentions6h > 0 ? mentions6h / 6 : (totalMentions > 0 ? totalMentions / 24 : 0);
  const spikeRatio = baselineHourly > 0 ? Math.min(5, Math.max(1, mentions1h / baselineHourly)) : 1;
  
  // Volume-gated spike bonus - only applies if meaningful volume
  let spikeBonus = 0;
  if (totalMentions >= 10 && spikeRatio >= 2) {
    spikeBonus = spikeRatio * 25;
  } else if (totalMentions >= 5 && spikeRatio >= 2) {
    spikeBonus = spikeRatio * 10;
  }
  
  // Velocity contribution (capped)
  const velocityContribution = velocity * 0.3;
  
  return weightedVolume + crossSourceBonus + spikeBonus + velocityContribution;
};

// Determine if trend is a breakthrough (requires volume + cross-source)
const isBreakthrough = (trend: any): boolean => {
  const totalMentions = trend.mentions_last_24h || 0;
  const velocity = trend.velocity_score || 0;
  const mentions1h = trend.mentions_last_hour || 0;
  const mentions6h = trend.mentions_last_6h || 0;
  const baselineHourly = mentions6h > 0 ? mentions6h / 6 : (totalMentions > 0 ? totalMentions / 24 : 0);
  const spikeRatio = baselineHourly > 0 ? Math.min(5, Math.max(1, mentions1h / baselineHourly)) : 1;
  
  const googleCount = trend.google_news_count || 0;
  const redditCount = trend.reddit_count || 0;
  const blueskyCount = trend.bluesky_count || 0;
  const rssCount = trend.rss_count || 0;
  const sourceCount = [googleCount > 0, redditCount > 0, blueskyCount > 0, rssCount > 0].filter(Boolean).length;
  
  // Requires: meaningful volume + real velocity + spike + cross-platform
  return velocity >= 100 && spikeRatio >= 2.0 && totalMentions >= 8 && sourceCount >= 2;
};

export const useUnifiedTrends = (options: UseUnifiedTrendsOptions = {}) => {
  const { limit = 30, breakthroughOnly = false, excludeEvergreen = true } = options;
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
      // Fetch from trend_clusters directly for better source-weighted scoring
      // Remove broken is_trending filter - rely on volume + source weighting instead
      const [clustersResult, watchlistResult, headlinesResult, evergreenResult] = await Promise.all([
        supabase.from('trend_clusters')
          .select('*')
          .gte('mentions_last_24h', 3) // Lower threshold to get more topics
          .order('mentions_last_24h', { ascending: false }) // Order by volume
          .limit(limit + 50), // Fetch extra for filtering
        supabase.from('entity_watchlist').select('entity_name'),
        supabase.from('articles')
          .select('title, tags')
          .gte('published_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('published_date', { ascending: false })
          .limit(100),
        supabase.from('evergreen_topics').select('topic'),
      ]);

      if (clustersResult.error) {
        console.error('Error fetching trend clusters:', clustersResult.error);
        setError(clustersResult.error.message);
        return;
      }

      const watchlistEntities = (watchlistResult.data || []).map((w: any) => w.entity_name?.toLowerCase() || '');
      const headlines = headlinesResult.data || [];
      const dbEvergreen = (evergreenResult.data || []).map((e: any) => e.topic?.toLowerCase() || '');
      const allEvergreenPatterns = [...new Set([...EVERGREEN_PATTERNS, ...dbEvergreen])];

      // Transform and score trends
      let enrichedTrends = (clustersResult.data || [])
        .filter((trend: any) => {
          if (!excludeEvergreen) return true;
          
          const trendNameLower = trend.cluster_title?.toLowerCase() || '';
          const totalMentions = trend.mentions_last_24h || 0;
          const sourceCount = [
            (trend.google_news_count || 0) > 0,
            (trend.reddit_count || 0) > 0,
            (trend.bluesky_count || 0) > 0,
            (trend.rss_count || 0) > 0
          ].filter(Boolean).length;
          
          // Allow high-volume cross-source topics even if they match evergreen patterns
          if (totalMentions >= 20 && sourceCount >= 2) {
            return true;
          }
          
          const isEvergreen = allEvergreenPatterns.some(pattern => 
            trendNameLower === pattern || 
            (trendNameLower.includes(pattern) && trendNameLower.length < pattern.length + 5)
          );
          
          return !isEvergreen;
        })
        .map((trend: any) => {
          const trendNameLower = trend.cluster_title?.toLowerCase() || '';
          
          // Calculate metrics
          const unifiedScore = calculateUnifiedScore(trend);
          const breakthrough = isBreakthrough(trend);
          
          // Calculate spike ratio for display
          const mentions1h = trend.mentions_last_hour || 0;
          const mentions6h = trend.mentions_last_6h || 0;
          const totalMentions = trend.mentions_last_24h || 0;
          const baselineHourly = mentions6h > 0 ? mentions6h / 6 : (totalMentions > 0 ? totalMentions / 24 : 0);
          const spikeRatio = baselineHourly > 0 ? Math.min(5, Math.max(1, mentions1h / baselineHourly)) : 1;
          
          // Determine source types
          const sourceTypes: string[] = [];
          if ((trend.google_news_count || 0) > 0 || (trend.rss_count || 0) > 0) sourceTypes.push('news');
          if ((trend.bluesky_count || 0) > 0 || (trend.reddit_count || 0) > 0) sourceTypes.push('social');
          
          const sourceCount = [
            (trend.google_news_count || 0) > 0,
            (trend.reddit_count || 0) > 0,
            (trend.bluesky_count || 0) > 0,
            (trend.rss_count || 0) > 0
          ].filter(Boolean).length;
          
          // Check watchlist match
          const matchedEntity = watchlistEntities.find((entity: string) => 
            entity && (trendNameLower.includes(entity) || entity.includes(trendNameLower))
          );
          
          // Find sample headline
          const matchingHeadline = headlines.find((article: any) => 
            article.title?.toLowerCase().includes(trendNameLower) ||
            (article.tags && article.tags.some((tag: string) => tag?.toLowerCase().includes(trendNameLower)))
          );

          return {
            name: trend.cluster_title,
            normalized_name: trend.cluster_title?.toLowerCase() || '',
            total_mentions_1h: mentions1h,
            total_mentions_6h: mentions6h,
            total_mentions_24h: totalMentions,
            velocity: trend.velocity_score || 0,
            avg_sentiment: trend.sentiment_score || null,
            spike_ratio: spikeRatio,
            baseline_hourly: baselineHourly,
            is_breakthrough: breakthrough,
            source_types: sourceTypes,
            source_count: sourceCount,
            last_updated: trend.updated_at,
            unified_score: unifiedScore,
            matchesWatchlist: !!matchedEntity,
            watchlistEntity: matchedEntity || null,
            sampleHeadline: matchingHeadline?.title || null,
            related_topics: trend.related_topics || [],
            entity_type: trend.entity_type || 'category',
            is_breaking: trend.is_breaking || false,
            trend_stage: trend.trend_stage as UnifiedTrend['trend_stage'] || 'stable',
            acceleration: trend.acceleration || 0,
            velocity_1h: trend.velocity_1h || 0,
            velocity_6h: trend.velocity_6h || 0,
            source_distribution: {
              google_news: trend.google_news_count || 0,
              reddit: trend.reddit_count || 0,
              bluesky: trend.bluesky_count || 0,
              rss: trend.rss_count || 0,
            },
            cluster_summary: trend.cluster_summary || '',
          } as UnifiedTrend;
        })
        // Sort by unified score (quality-weighted)
        .sort((a, b) => b.unified_score - a.unified_score);

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
  }, [limit, breakthroughOnly, excludeEvergreen, isMaintenanceMode]);

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
