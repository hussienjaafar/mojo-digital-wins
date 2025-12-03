import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/fixed-client';

export interface TrendAnomaly {
  id: string;
  topic: string;
  anomaly_type: 'velocity_spike' | 'sentiment_shift' | 'volume_surge' | 'sudden_drop';
  detected_at: string;
  current_value: number;
  expected_value: number;
  z_score: number;
  deviation_percentage: number | null;
  source_type: 'news' | 'social' | 'combined' | null;
  is_acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any> | null;
}

export interface GroupSentiment {
  id: string;
  date: string;
  affected_group: string;
  avg_sentiment: number | null;
  sentiment_trend: 'improving' | 'declining' | 'stable' | null;
  change_percentage: number | null;
  article_count: number;
  social_post_count: number;
}

interface UseAnomalyAlertsOptions {
  limit?: number;
  includeAcknowledged?: boolean;
  severityFilter?: string[];
}

export const useAnomalyAlerts = (options: UseAnomalyAlertsOptions = {}) => {
  const { limit = 20, includeAcknowledged = false, severityFilter } = options;
  
  const [anomalies, setAnomalies] = useState<TrendAnomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnomalies = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = (supabase as any)
        .from('trend_anomalies')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (!includeAcknowledged) {
        query = query.eq('is_acknowledged', false);
      }

      if (severityFilter && severityFilter.length > 0) {
        query = query.in('severity', severityFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setAnomalies(data || []);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch anomalies');
    } finally {
      setIsLoading(false);
    }
  }, [limit, includeAcknowledged, severityFilter]);

  const acknowledgeAnomaly = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('trend_anomalies')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setAnomalies(prev => prev.map(a => 
        a.id === id ? { ...a, is_acknowledged: true } : a
      ));
      
      return true;
    } catch (err) {
      console.error('Error acknowledging anomaly:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchAnomalies();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchAnomalies, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  const stats = {
    total: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'critical').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    byType: {
      velocity_spike: anomalies.filter(a => a.anomaly_type === 'velocity_spike').length,
      sentiment_shift: anomalies.filter(a => a.anomaly_type === 'sentiment_shift').length,
      volume_surge: anomalies.filter(a => a.anomaly_type === 'volume_surge').length,
      sudden_drop: anomalies.filter(a => a.anomaly_type === 'sudden_drop').length,
    }
  };

  return {
    anomalies,
    isLoading,
    error,
    stats,
    refresh: fetchAnomalies,
    acknowledgeAnomaly
  };
};

export const useGroupSentiment = (days: number = 7) => {
  const [sentiment, setSentiment] = useState<GroupSentiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSentiment = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const { data, error: queryError } = await (supabase as any)
        .from('daily_group_sentiment')
        .select('*')
        .gte('date', cutoffDate)
        .order('date', { ascending: false });

      if (queryError) throw queryError;
      setSentiment(data || []);
    } catch (err) {
      console.error('Error fetching group sentiment:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sentiment');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchSentiment();
  }, [fetchSentiment]);

  // Group by affected_group for easier consumption
  const byGroup = sentiment.reduce((acc, item) => {
    if (!acc[item.affected_group]) {
      acc[item.affected_group] = [];
    }
    acc[item.affected_group].push(item);
    return acc;
  }, {} as Record<string, GroupSentiment[]>);

  // Calculate summary stats
  const latestByGroup = Object.entries(byGroup).map(([group, items]) => ({
    group,
    latest: items[0],
    trend: items[0]?.sentiment_trend,
    avgSentiment: items[0]?.avg_sentiment
  }));

  const improvingGroups = latestByGroup.filter(g => g.trend === 'improving');
  const decliningGroups = latestByGroup.filter(g => g.trend === 'declining');

  return {
    sentiment,
    byGroup,
    isLoading,
    error,
    refresh: fetchSentiment,
    stats: {
      totalGroups: Object.keys(byGroup).length,
      improving: improvingGroups.length,
      declining: decliningGroups.length,
      stable: latestByGroup.filter(g => g.trend === 'stable').length
    },
    improvingGroups,
    decliningGroups
  };
};

// Helper functions
export const getAnomalyTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    velocity_spike: 'Velocity Spike',
    sentiment_shift: 'Sentiment Shift',
    volume_surge: 'Volume Surge',
    sudden_drop: 'Sudden Drop'
  };
  return labels[type] || type;
};

export const getAnomalyTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    velocity_spike: 'text-orange-500',
    sentiment_shift: 'text-purple-500',
    volume_surge: 'text-blue-500',
    sudden_drop: 'text-red-500'
  };
  return colors[type] || 'text-muted-foreground';
};

export const getSeverityBadgeClass = (severity: string): string => {
  const classes: Record<string, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-muted text-muted-foreground'
  };
  return classes[severity] || 'bg-muted';
};

export const formatZScore = (zScore: number): string => {
  const abs = Math.abs(zScore);
  if (abs >= 4) return `${zScore.toFixed(1)}σ (Extreme)`;
  if (abs >= 3) return `${zScore.toFixed(1)}σ (Very High)`;
  if (abs >= 2.5) return `${zScore.toFixed(1)}σ (High)`;
  return `${zScore.toFixed(1)}σ`;
};