import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type BlueskyTrend = Database['public']['Tables']['bluesky_trends']['Row'];

export const useRealtimeTrends = () => {
  const [trends, setTrends] = useState<BlueskyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    const fetchTrends = async () => {
      const { data, error } = await supabase
        .from('bluesky_trends')
        .select('*')
        .eq('is_trending', true)
        .order('velocity', { ascending: false })
        .limit(10);

      if (data && !error) {
        setTrends(data);
      }
      setIsLoading(false);
    };

    fetchTrends();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('bluesky_trends_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bluesky_trends',
          filter: 'is_trending=eq.true'
        },
        (payload) => {
          console.log('📊 Realtime trend update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setTrends((prev) => [payload.new as BlueskyTrend, ...prev].slice(0, 10));
          } else if (payload.eventType === 'UPDATE') {
            setTrends((prev) =>
              prev.map((t) => (t.id === payload.new.id ? payload.new as BlueskyTrend : t))
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
