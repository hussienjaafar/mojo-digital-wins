import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedTrend {
  id: number;
  name: string;
  normalized_name: string;
  source_types: string[];
  sources: string[];
  max_velocity: number;
  avg_velocity: number;
  total_mentions_1h: number;
  total_mentions_24h: number;
  avg_sentiment: number | null;
  last_updated: string;
  source_count: number;
  spike_ratio: number;
  baseline_hourly: number;
  baseline_daily: number;
  unified_score: number;
  is_breakthrough: boolean;
  refreshed_at: string;
}

interface UseUnifiedTrendsOptions {
  limit?: number;
  breakthroughOnly?: boolean;
}

export const useUnifiedTrends = (options: UseUnifiedTrendsOptions = {}) => {
  const { limit = 20, breakthroughOnly = false } = options;
  
  const [trends, setTrends] = useState<UnifiedTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('mv_unified_trends')
        .select('*')
        .order('unified_score', { ascending: false })
        .limit(limit);

      if (breakthroughOnly) {
        query = query.eq('is_breakthrough', true);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error('Error fetching unified trends:', queryError);
        setError(queryError.message);
        return;
      }

      // Cast data to match our interface
      setTrends((data || []) as UnifiedTrend[]);
    } catch (err) {
      console.error('Failed to fetch unified trends:', err);
      setError('Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [limit, breakthroughOnly]);

  useEffect(() => {
    fetchTrends();
    
    // Refresh every 2 minutes for near-realtime updates
    const interval = setInterval(fetchTrends, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchTrends]);

  // Calculate summary statistics
  const stats = {
    totalTrending: trends.length,
    breakthroughs: trends.filter(t => t.is_breakthrough).length,
    multiSourceTrends: trends.filter(t => t.source_count >= 2).length,
    avgSentiment: trends.reduce((acc, t) => acc + (t.avg_sentiment || 0), 0) / trends.length || 0,
  };

  return { 
    trends, 
    isLoading, 
    error,
    stats,
    refresh: fetchTrends 
  };
};

// Helper to get spike ratio color (Twitter-style: higher = more urgent)
export const getSpikeRatioColor = (spikeRatio: number): string => {
  if (spikeRatio >= 5) return 'text-destructive';
  if (spikeRatio >= 3) return 'text-severity-high';
  if (spikeRatio >= 2) return 'text-status-warning';
  return 'text-status-info';
};

// Helper to format spike ratio as a label
export const formatSpikeRatio = (spikeRatio: number): string => {
  if (spikeRatio >= 10) return '🔥 Viral';
  if (spikeRatio >= 5) return '📈 Surging';
  if (spikeRatio >= 3) return '⬆️ Rising';
  if (spikeRatio >= 2) return '↗️ Up';
  return '→ Steady';
};

// Helper to get source type badge color
export const getSourceTypeBadgeClass = (sourceType: string): string => {
  switch (sourceType) {
    case 'news':
      return 'bg-status-info/20 text-status-info border-status-info/30';
    case 'social':
      return 'bg-secondary/20 text-secondary border-secondary/30';
    case 'entity':
      return 'bg-status-warning/20 text-status-warning border-status-warning/30';
    default:
      return 'bg-status-neutral/20 text-status-neutral border-status-neutral/30';
  }
};

// Helper to format velocity with color
export const getVelocityColor = (score: number): string => {
  if (score >= 200) return 'text-destructive';
  if (score >= 100) return 'text-severity-high';
  if (score >= 50) return 'text-status-warning';
  return 'text-status-info';
};

// Helper to format sentiment
export const formatSentiment = (sentiment: number | null): { label: string; color: string } => {
  if (sentiment === null) return { label: 'N/A', color: 'text-muted-foreground' };
  if (sentiment > 0.3) return { label: 'Positive', color: 'text-status-success' };
  if (sentiment < -0.3) return { label: 'Negative', color: 'text-destructive' };
  return { label: 'Neutral', color: 'text-status-warning' };
};
