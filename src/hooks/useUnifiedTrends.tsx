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

      setTrends(data || []);
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

// Helper to get source type badge color
export const getSourceTypeBadgeClass = (sourceType: string): string => {
  switch (sourceType) {
    case 'news':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'social':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'entity':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

// Helper to format velocity with color
export const getVelocityColor = (score: number): string => {
  if (score >= 200) return 'text-red-400';
  if (score >= 100) return 'text-orange-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-blue-400';
};

// Helper to format sentiment
export const formatSentiment = (sentiment: number | null): { label: string; color: string } => {
  if (sentiment === null) return { label: 'N/A', color: 'text-muted-foreground' };
  if (sentiment > 0.3) return { label: 'Positive', color: 'text-green-400' };
  if (sentiment < -0.3) return { label: 'Negative', color: 'text-red-400' };
  return { label: 'Neutral', color: 'text-yellow-400' };
};
