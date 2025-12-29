import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { format, parseISO, addDays } from 'date-fns';

type MetricsUpdate = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
};

export function useRealtimeMetrics(organizationId: string, startDate: string, endDate: string) {
  const [metaMetrics, setMetaMetrics] = useState<any[]>([]);
  const [smsMetrics, setSmsMetrics] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [roiAnalytics, setRoiAnalytics] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Use inclusive date range: [startDate, endDate+1day) to include full end date
        const endDateInclusive = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

        const [metaRes, smsRes, txRes, roiRes] = await Promise.all([
          supabase
            .from('meta_ad_metrics')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('date', startDate)
            .lte('date', endDate) // Meta uses date field (already just yyyy-MM-dd)
            .order('date', { ascending: false }),

          (supabase as any)
            .from('sms_campaigns')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('send_date', startDate)
            .lt('send_date', endDateInclusive) // Inclusive of end date
            .order('send_date', { ascending: false }),

          // Using secure view for defense-in-depth PII protection
          (supabase as any)
            .from('actblue_transactions_secure')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('transaction_date', startDate)
            .lt('transaction_date', endDateInclusive) // Inclusive of end date
            .order('transaction_date', { ascending: false }),

          supabase
            .from('roi_analytics')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('date', startDate)
            .lte('date', endDate) // ROI uses date field (already just yyyy-MM-dd)
            .order('date', { ascending: false }),
        ]);

        if (metaRes.data) setMetaMetrics(metaRes.data);
        if (smsRes.data) setSmsMetrics(smsRes.data);
        if (txRes.data) setTransactions(txRes.data);
        if (roiRes.data) setRoiAnalytics(roiRes.data);
        setLastUpdate(new Date());
      } catch (error) {
        logger.error('Failed to fetch initial metrics data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [organizationId, startDate, endDate]);

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('metrics-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meta_ad_metrics',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: MetricsUpdate) => {
          logger.info('Meta metrics update received');
          handleMetaUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sms_campaigns',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: MetricsUpdate) => {
          logger.info('SMS campaigns update received');
          handleSmsUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'actblue_transactions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: MetricsUpdate) => {
          logger.info('Transaction update received');
          handleTransactionUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'roi_analytics',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: MetricsUpdate) => {
          logger.info('ROI analytics update received');
          handleRoiUpdate(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          logger.info('Real-time subscriptions active');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          logger.warn('Real-time connection closed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const handleMetaUpdate = (payload: MetricsUpdate) => {
    setMetaMetrics((prev) => {
      if (payload.eventType === 'INSERT') {
        return [payload.new, ...prev];
      } else if (payload.eventType === 'UPDATE') {
        return prev.map((item) => (item.id === payload.new.id ? payload.new : item));
      } else if (payload.eventType === 'DELETE') {
        return prev.filter((item) => item.id !== payload.old.id);
      }
      return prev;
    });
    setLastUpdate(new Date());
  };

  const handleSmsUpdate = (payload: MetricsUpdate) => {
    setSmsMetrics((prev) => {
      if (payload.eventType === 'INSERT') {
        return [payload.new, ...prev];
      } else if (payload.eventType === 'UPDATE') {
        return prev.map((item) => (item.id === payload.new.id ? payload.new : item));
      } else if (payload.eventType === 'DELETE') {
        return prev.filter((item) => item.id !== payload.old.id);
      }
      return prev;
    });
    setLastUpdate(new Date());
  };

  const handleTransactionUpdate = (payload: MetricsUpdate) => {
    setTransactions((prev) => {
      if (payload.eventType === 'INSERT') {
        return [payload.new, ...prev];
      } else if (payload.eventType === 'UPDATE') {
        return prev.map((item) => (item.id === payload.new.id ? payload.new : item));
      } else if (payload.eventType === 'DELETE') {
        return prev.filter((item) => item.id !== payload.old.id);
      }
      return prev;
    });
    setLastUpdate(new Date());
  };

  const handleRoiUpdate = (payload: MetricsUpdate) => {
    setRoiAnalytics((prev) => {
      if (payload.eventType === 'INSERT') {
        return [payload.new, ...prev];
      } else if (payload.eventType === 'UPDATE') {
        return prev.map((item) => (item.id === payload.new.id ? payload.new : item));
      } else if (payload.eventType === 'DELETE') {
        return prev.filter((item) => item.id !== payload.old.id);
      }
      return prev;
    });
    setLastUpdate(new Date());
  };

  return {
    metaMetrics,
    smsMetrics,
    transactions,
    roiAnalytics,
    isConnected,
    lastUpdate,
    isLoading,
  };
}
