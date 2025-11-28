import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Alert = Database['public']['Tables']['client_entity_alerts']['Row'];

export const useRealtimeAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('client_entity_alerts')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        setAlerts(data);
        setCriticalCount(data.filter(a => a.severity === 'critical').length);
      }
    };

    fetchAlerts();

    // Subscribe to realtime changes on client_entity_alerts
    const channel = supabase
      .channel('entity_alerts_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_entity_alerts'
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          console.log('🚨 New entity alert received:', newAlert);
          
          setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
          
          if (newAlert.severity === 'critical') {
            setCriticalCount((prev) => prev + 1);
            toast.error(`Critical Alert: ${newAlert.entity_name}`, {
              description: newAlert.alert_type,
              duration: 10000,
            });
          } else if (newAlert.severity === 'high') {
            toast.warning(`Alert: ${newAlert.entity_name}`, {
              description: newAlert.alert_type,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { alerts, criticalCount };
};
