import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMaintenanceMode } from '@/contexts/MaintenanceContext';

/**
 * Evidence-based trend event from the new trend detection model
 */
export interface TrendEvent {
  id: string;
  event_key: string;
  event_title: string;
  canonical_label?: string; // Best label chosen from clustering
  
  // Temporal
  first_seen_at: string;
  last_seen_at: string;
  peak_at: string | null;
  
  // Baseline metrics
  baseline_7d: number;
  baseline_30d: number;
  current_1h: number;
  current_6h: number;
  current_24h: number;
  
  // Velocity
  velocity: number;
  velocity_1h: number;
  velocity_6h: number;
  acceleration: number;
  
  // NEW: Velocity-based ranking (Twitter-like)
  trend_score: number; // Primary ranking metric
  z_score_velocity: number; // How many std devs above baseline
  
  // Classification
  confidence_score: number;
  confidence_factors: {
    baseline_delta?: number;
    cross_source?: number;
    volume?: number;
    velocity?: number;
    z_score?: number;
    trend_score?: number;
    baseline_delta_pct?: number;
    meets_volume_gate?: boolean;
    cluster_size?: number;
    authority_score?: number;
  } | null;
  is_trending: boolean;
  is_breaking: boolean;
  is_event_phrase?: boolean;
  trend_stage: 'emerging' | 'surging' | 'peaking' | 'declining' | 'stable';
  
  // Corroboration
  source_count: number;
  news_source_count: number;
  social_source_count: number;
  corroboration_score: number;
  
  // Evidence
  evidence_count: number;
  top_headline: string | null;
  sentiment_score: number | null;
  sentiment_label: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  
  // Clustering
  related_phrases?: string[];
  cluster_id?: string | null;
  
  // Computed fields from view
  baseline_delta_pct?: number;
  news_evidence_count?: number;
  social_evidence_count?: number;
  freshness?: 'fresh' | 'recent' | 'aging' | 'stale';
}

/**
 * Get the display label for a trend event (prefer canonical_label)
 */
export const getDisplayLabel = (event: TrendEvent): string => {
  return event.canonical_label || event.event_title;
};

export interface TrendEvidence {
  id: string;
  event_id: string;
  source_type: 'rss' | 'google_news' | 'bluesky' | 'article';
  source_url: string | null;
  source_title: string | null;
  source_domain: string | null;
  published_at: string | null;
  contribution_score: number;
  is_primary: boolean;
  sentiment_label: string | null;
}

interface UseTrendEventsOptions {
  limit?: number;
  breakingOnly?: boolean;
  trendingOnly?: boolean;
  minConfidence?: number;
}

export const useTrendEvents = (options: UseTrendEventsOptions = {}) => {
  const { 
    limit = 30, 
    breakingOnly = false, 
    trendingOnly = true,
    minConfidence = 30
  } = options;
  
  const { isMaintenanceMode } = useMaintenanceMode();
  
  const [events, setEvents] = useState<TrendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (isMaintenanceMode) {
      setEvents([]);
      setIsLoading(false);
      setError('Maintenance mode - trends temporarily unavailable');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to fetch from new trend_events_active view first
      // Order by trend_score (velocity-based) instead of confidence_score
      let query = supabase
        .from('trend_events_active')
        .select('*')
        .gte('confidence_score', minConfidence)
        .order('is_breaking', { ascending: false })
        .order('trend_score', { ascending: false, nullsFirst: false })
        .order('velocity', { ascending: false })
        .limit(limit);
      
      if (breakingOnly) {
        query = query.eq('is_breaking', true);
      }
      
      if (trendingOnly) {
        query = query.eq('is_trending', true);
      }
      
      const { data, error: queryError } = await query;
      
      if (queryError) {
        // Fall back to direct table query if view doesn't exist yet
        console.warn('trend_events_active view error, falling back to table:', queryError.message);
        
        // Fallback: order by trend_score (velocity-based)
        let fallbackQuery = supabase
          .from('trend_events')
          .select('*')
          .gte('confidence_score', minConfidence)
          .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('is_breaking', { ascending: false })
          .order('trend_score', { ascending: false, nullsFirst: false })
          .order('velocity', { ascending: false })
          .limit(limit);
        
        if (breakingOnly) {
          fallbackQuery = fallbackQuery.eq('is_breaking', true);
        }
        
        if (trendingOnly) {
          fallbackQuery = fallbackQuery.eq('is_trending', true);
        }
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) {
          throw fallbackError;
        }
        
        setEvents((fallbackData || []) as unknown as TrendEvent[]);
        return;
      }
      
      setEvents((data || []) as unknown as TrendEvent[]);
    } catch (err: any) {
      console.error('Failed to fetch trend events:', err);
      setError(err.message || 'Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [limit, breakingOnly, trendingOnly, minConfidence, isMaintenanceMode]);

  useEffect(() => {
    fetchEvents();
    
    // Refresh every 2 minutes
    const interval = setInterval(() => {
      if (!isMaintenanceMode) fetchEvents();
    }, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchEvents, isMaintenanceMode]);

  const stats = {
    totalEvents: events.length,
    breakingCount: events.filter(e => e.is_breaking).length,
    trendingCount: events.filter(e => e.is_trending).length,
    highConfidenceCount: events.filter(e => e.confidence_score >= 70).length,
    multiSourceCount: events.filter(e => e.source_count >= 2).length,
  };

  return { events, isLoading, error, stats, refresh: fetchEvents };
};

/**
 * Fetch evidence for a specific trend event
 */
export const useTrendEvidence = (eventId: string | null) => {
  const [evidence, setEvidence] = useState<TrendEvidence[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setEvidence([]);
      return;
    }

    const fetchEvidence = async () => {
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('trend_evidence')
          .select('*')
          .eq('event_id', eventId)
          .order('is_primary', { ascending: false })
          .order('contribution_score', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        setEvidence((data || []) as TrendEvidence[]);
      } catch (err) {
        console.error('Failed to fetch trend evidence:', err);
        setEvidence([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvidence();
  }, [eventId]);

  return { evidence, isLoading };
};

/**
 * Get confidence level label
 */
export const getConfidenceLabel = (score: number): string => {
  if (score >= 80) return 'Very High';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Very Low';
};

/**
 * Get confidence color class
 */
export const getConfidenceColor = (score: number): string => {
  if (score >= 80) return 'text-status-success';
  if (score >= 60) return 'text-status-info';
  if (score >= 40) return 'text-status-warning';
  return 'text-muted-foreground';
};

/**
 * Get trend stage label and color
 */
export const getTrendStageInfo = (stage: TrendEvent['trend_stage']): { label: string; color: string; bgColor: string } => {
  switch (stage) {
    case 'emerging':
      return { label: 'Emerging', color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
    case 'surging':
      return { label: 'Surging', color: 'text-status-warning', bgColor: 'bg-status-warning/10' };
    case 'peaking':
      return { label: 'Peaking', color: 'text-status-error', bgColor: 'bg-status-error/10' };
    case 'declining':
      return { label: 'Declining', color: 'text-muted-foreground', bgColor: 'bg-muted/10' };
    default:
      return { label: 'Stable', color: 'text-muted-foreground', bgColor: 'bg-muted/10' };
  }
};
