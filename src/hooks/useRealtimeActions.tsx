import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type SuggestedAction = Database['public']['Tables']['suggested_actions']['Row'];

export const useRealtimeActions = (organizationId?: string) => {
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const isUrgent = (action: SuggestedAction) => (action.urgency_score ?? 0) >= 70;

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('suggested_actions')
        .select('*')
        .or('status.eq.pending,status.is.null')
        .order('created_at', { ascending: false })
        .limit(20);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching actions:', error);
        return;
      }

      if (data) {
        setActions(data);
        setUrgentCount(data.filter(a => isUrgent(a)).length);
      }
    } catch (err) {
      console.error('Failed to fetch actions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const markAsActioned = useCallback(async (actionId: string) => {
    const { error } = await supabase
      .from('suggested_actions')
      .update({ 
        status: 'completed',
        used_at: new Date().toISOString()
      })
      .eq('id', actionId);

    if (!error) {
      setActions(prev => prev.filter(a => a.id !== actionId));
      const action = actions.find(a => a.id === actionId);
      if (action && isUrgent(action)) {
        setUrgentCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [actions]);

  useEffect(() => {
    fetchActions();

    const channel = supabase
      .channel('suggested_actions_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suggested_actions'
        },
        (payload) => {
          const newAction = payload.new as SuggestedAction;
          
          if (organizationId && newAction.organization_id !== organizationId) {
            return;
          }

          console.log('💡 New suggested action:', newAction);
          
          setActions((prev) => [newAction, ...prev].slice(0, 20));
          
          const score = newAction.urgency_score ?? 0;
          if (score >= 85) {
            setUrgentCount((prev) => prev + 1);
            toast.error(`Action Required: ${newAction.entity_name}`, {
              description: newAction.value_prop?.substring(0, 100),
              duration: 10000,
            });
          } else if (score >= 70) {
            setUrgentCount((prev) => prev + 1);
            toast.warning(`Opportunity: ${newAction.entity_name}`, {
              description: newAction.value_prop?.substring(0, 100),
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
          table: 'suggested_actions'
        },
        (payload) => {
          const updatedAction = payload.new as SuggestedAction;
          if (updatedAction.status === 'completed' || updatedAction.status === 'dismissed') {
            setActions(prev => prev.filter(a => a.id !== updatedAction.id));
            if (isUrgent(updatedAction)) {
              setUrgentCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Actions channel status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect actions channel...');
            channel.subscribe();
          }, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, fetchActions]);

  return { 
    actions, 
    urgentCount, 
    isLoading, 
    connectionStatus,
    markAsActioned,
    refresh: fetchActions 
  };
};
