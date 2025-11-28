import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type EntityTrend = Database['public']['Tables']['entity_trends']['Row'];

export const useRealtimeTrends = () => {
  const [trends, setTrends] = useState<EntityTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial fetch from entity_trends (real-time enabled)
    const fetchTrends = async () => {
      const { data, error } = await supabase
        .from('entity_trends')
        .select('*')
        .or('is_trending.eq.true,mentions_24h.gte.5')
        .order('velocity', { ascending: false, nullsFirst: false })
        .order('mentions_24h', { ascending: false })
        .limit(15);

      if (data && !error) {
        setTrends(data);
      }
      setIsLoading(false);
    };

    fetchTrends();

    // Subscribe to realtime changes on entity_trends (realtime enabled)
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
              prev.map((t) => (t.id === payload.new.id ? payload.new as EntityTrend : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTrends((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { trends, isLoading };
};
