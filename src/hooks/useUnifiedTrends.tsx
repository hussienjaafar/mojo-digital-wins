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
}

interface UseUnifiedTrendsOptions {
  limit?: number;
  breakthroughOnly?: boolean;
}

export const useUnifiedTrends = (options: UseUnifiedTrendsOptions = {}) => {
  const { limit = 10, breakthroughOnly = false } = options;
  
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
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchTrends, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrends]);

  const stats = {
    totalTrending: trends.length,
    breakthroughs: trends.filter(t => t.is_breakthrough).length,
    multiSourceTrends: trends.filter(t => t.source_count >= 2).length,
    avgSentiment: trends.reduce((acc, t) => acc + (t.avg_sentiment || 0), 0) / trends.length || 0,
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
