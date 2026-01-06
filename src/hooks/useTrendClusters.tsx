import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * @deprecated This hook uses the legacy trend_clusters table which is no longer updated.
 * Use useTrendEvents from '@/hooks/useTrendEvents' instead for the new trend detection model.
 * 
 * Migration guide:
 * - Replace useTrendClusters() with useTrendEvents()
 * - TrendCluster.cluster_title -> TrendEvent.event_title
 * - TrendCluster.velocity_score -> TrendEvent.velocity
 * - TrendCluster.mentions_last_24h -> TrendEvent.current_24h
 */

export interface TrendCluster {
  id: string;
  cluster_title: string;
  cluster_summary: string | null;
  dominant_sentiment: string | null;
  sentiment_score: number | null;
  total_mentions: number;
  mentions_last_hour: number;
  mentions_last_6h: number;
  mentions_last_24h: number;
  velocity_score: number;
  momentum: string;
  source_distribution: {
    google_news?: number;
    reddit?: number;
    bluesky?: number;
    rss?: number;
  };
  cross_source_score: number;
  is_trending: boolean;
  first_seen_at: string;
  last_activity_at: string;
  trending_since: string | null;
}

interface UseTrendClustersOptions {
  limit?: number;
  trendingOnly?: boolean;
  minCrossSources?: number;
}

export function useTrendClusters(options: UseTrendClustersOptions = {}) {
  const { limit = 20, trendingOnly = false, minCrossSources = 1 } = options;
  
  const [clusters, setClusters] = useState<TrendCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    try {
      let query = supabase
        .from('trend_clusters')
        .select('*')
        .gte('cross_source_score', minCrossSources)
        .order('velocity_score', { ascending: false })
        .limit(limit);
      
      if (trendingOnly) {
        query = query.eq('is_trending', true);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setClusters((data || []) as TrendCluster[]);
      setError(null);
    } catch (err) {
      console.error('Error fetching trend clusters:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trends');
    } finally {
      setIsLoading(false);
    }
  }, [limit, trendingOnly, minCrossSources]);

  useEffect(() => {
    fetchClusters();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchClusters, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchClusters]);

  const stats = {
    total: clusters.length,
    trending: clusters.filter(c => c.is_trending).length,
    multiSource: clusters.filter(c => c.cross_source_score >= 3).length,
    avgVelocity: clusters.length > 0 
      ? clusters.reduce((sum, c) => sum + c.velocity_score, 0) / clusters.length 
      : 0
  };

  return { clusters, isLoading, error, stats, refresh: fetchClusters };
}

// Helper functions
export function getMomentumIcon(momentum: string): string {
  switch (momentum) {
    case 'up': return '↑';
    case 'down': return '↓';
    default: return '→';
  }
}

export function getMomentumColor(momentum: string): string {
  switch (momentum) {
    case 'up': return 'text-green-500';
    case 'down': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

export function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive': return 'text-green-500';
    case 'negative': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

export function getSourceIcon(source: string): string {
  switch (source) {
    case 'google_news': return '📰';
    case 'reddit': return '🔗';
    case 'bluesky': return '🦋';
    case 'rss': return '📡';
    default: return '📄';
  }
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
