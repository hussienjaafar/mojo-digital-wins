import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Alert = Database['public']['Tables']['alert_queue']['Row'];

export const useRealtimeAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('alert_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        setAlerts(data);
        setCriticalCount(data.filter(a => a.severity === 'critical').length);
      }
    };

    fetchAlerts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('alerts_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_queue'
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          console.log('🚨 New alert received:', newAlert);
          
          setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
          
          if (newAlert.severity === 'critical') {
            setCriticalCount((prev) => prev + 1);
            toast.error(`Critical Alert: ${newAlert.title}`, {
              description: newAlert.message,
              duration: 10000,
            });
          } else if (newAlert.severity === 'high') {
            toast.warning(`Alert: ${newAlert.title}`, {
              description: newAlert.message,
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
