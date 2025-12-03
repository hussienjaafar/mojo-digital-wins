import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

type TrendAnomaly = Database['public']['Tables']['trend_anomalies']['Row'];

export const useRealtimeAnomalies = () => {
  const [anomalies, setAnomalies] = useState<TrendAnomaly[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trend_anomalies')
        .select('*')
        .or('is_acknowledged.eq.false,is_acknowledged.is.null')
        .order('detected_at', { ascending: false, nullsFirst: false })
        .limit(30);

      if (error) {
        console.error('Error fetching anomalies:', error);
        return;
      }

      if (data) {
        setAnomalies(data);
        setCriticalCount(data.filter(a => a.severity === 'critical').length);
      }
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acknowledgeAnomaly = useCallback(async (anomalyId: string) => {
    const { error } = await supabase
      .from('trend_anomalies')
      .update({ 
        is_acknowledged: true, 
        acknowledged_at: new Date().toISOString() 
      })
      .eq('id', anomalyId);

    if (!error) {
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
      const anomaly = anomalies.find(a => a.id === anomalyId);
      if (anomaly?.severity === 'critical') {
        setCriticalCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [anomalies]);

  useEffect(() => {
    fetchAnomalies();

    const channel = supabase
      .channel('trend_anomalies_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trend_anomalies'
        },
        (payload) => {
          const newAnomaly = payload.new as TrendAnomaly;
          console.log('⚠️ New anomaly detected:', newAnomaly);
          
          setAnomalies((prev) => [newAnomaly, ...prev].slice(0, 30));
          
          if (newAnomaly.severity === 'critical') {
            setCriticalCount((prev) => prev + 1);
            toast.error(`Critical Anomaly: ${newAnomaly.topic}`, {
              description: `${newAnomaly.anomaly_type} detected with z-score ${newAnomaly.z_score?.toFixed(2)}`,
              duration: 10000,
            });
          } else if (newAnomaly.severity === 'high') {
            toast.warning(`Anomaly: ${newAnomaly.topic}`, {
              description: newAnomaly.anomaly_type,
              duration: 5000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Anomalies channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect anomalies channel...');
            channel.subscribe();
          }, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnomalies]);

  return { 
    anomalies, 
    criticalCount, 
    isLoading, 
    connectionStatus,
    acknowledgeAnomaly,
    refresh: fetchAnomalies 
  };
};
