import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Alert = Database['public']['Tables']['client_entity_alerts']['Row'];

export const useRealtimeAlerts = (organizationId?: string) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('client_entity_alerts')
        .select('*')
        .eq('is_read', false)
        .order('triggered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      if (data) {
        setAlerts(data);
        setCriticalCount(data.filter(a => a.severity === 'critical').length);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const markAsRead = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('client_entity_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      const alert = alerts.find(a => a.id === alertId);
      if (alert?.severity === 'critical') {
        setCriticalCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [alerts]);

  useEffect(() => {
    fetchAlerts();

    // Subscribe to realtime changes
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
          
          // Filter by organization if specified
          if (organizationId && newAlert.organization_id !== organizationId) {
            return;
          }

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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_entity_alerts'
        },
        (payload) => {
          const updatedAlert = payload.new as Alert;
          if (updatedAlert.is_read) {
            setAlerts(prev => prev.filter(a => a.id !== updatedAlert.id));
            if (updatedAlert.severity === 'critical') {
              setCriticalCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Alerts channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          // Attempt reconnection after 5 seconds
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect alerts channel...');
            channel.subscribe();
          }, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, fetchAlerts]);

  return { 
    alerts, 
    criticalCount, 
    isLoading, 
    connectionStatus,
    markAsRead,
    refresh: fetchAlerts 
  };
};
