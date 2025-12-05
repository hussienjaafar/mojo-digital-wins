import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMaintenanceMode } from '@/contexts/MaintenanceContext';
import type { Database } from '@/integrations/supabase/types';

type EntityTrend = Database['public']['Tables']['entity_trends']['Row'];

export const useRealtimeTrends = () => {
  const { isMaintenanceMode } = useMaintenanceMode();
  const [trends, setTrends] = useState<EntityTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const fetchTrends = useCallback(async () => {
    // Skip heavy queries during maintenance mode
    if (isMaintenanceMode) {
      setTrends([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('entity_trends')
        .select('*')
        .or('is_trending.eq.true,mentions_24h.gte.5')
        .order('velocity', { ascending: false, nullsFirst: false })
        .order('mentions_24h', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Error fetching trends:', error);
        return;
      }

      if (data) {
        setTrends(data);
      }
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isMaintenanceMode]);

  useEffect(() => {
    // Skip realtime subscription during maintenance
    if (isMaintenanceMode) {
      setTrends([]);
      setIsLoading(false);
      setConnectionStatus('disconnected');
      return;
    }
    
    fetchTrends();

    // Subscribe to realtime changes on entity_trends
    const channel = supabase
      .channel('entity_trends_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entity_trends',
          filter: 'is_trending=eq.true'
        },
        (payload) => {
          console.log('📊 Realtime entity trend update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setTrends((prev) => [payload.new as EntityTrend, ...prev].slice(0, 15));
          } else if (payload.eventType === 'UPDATE') {
            setTrends((prev) =>
              prev.map((t) => (t.id === (payload.new as EntityTrend).id ? payload.new as EntityTrend : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTrends((prev) => prev.filter((t) => t.id !== (payload.old as EntityTrend).id));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Trends channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          // Attempt reconnection after 5 seconds
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect trends channel...');
            channel.subscribe();
          }, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrends, isMaintenanceMode]);

  return { trends, isLoading, connectionStatus, refresh: fetchTrends };
};
