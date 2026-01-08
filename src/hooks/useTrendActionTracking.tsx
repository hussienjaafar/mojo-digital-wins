import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ActionType = 'sms' | 'email' | 'alert' | 'watchlist' | 'dismiss' | 'share' | 'generate_campaign' | 'launch_campaign';
export type OutcomeType = 'donation' | 'click' | 'signup' | 'conversion' | 'engagement' | 'none';

interface TrackActionParams {
  trendEventId: string;
  organizationId: string;
  actionType: ActionType;
  metadata?: Json;
}

interface RecordOutcomeParams {
  actionId: string;
  outcomeType: OutcomeType;
  outcomeValue?: number;
}

export function useTrendActionTracking() {

  const trackAction = useCallback(async ({
    trendEventId,
    organizationId,
    actionType,
    metadata = {},
  }: TrackActionParams): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('trend_action_outcomes')
        .insert([{
          trend_event_id: trendEventId,
          organization_id: organizationId,
          action_type: actionType,
          metadata,
        }])
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Failed to track action:', error);
      return null;
    }
  }, []);

  const recordOutcome = useCallback(async ({
    actionId,
    outcomeType,
    outcomeValue = 0,
  }: RecordOutcomeParams): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('trend_action_outcomes')
        .update({
          outcome_type: outcomeType,
          outcome_value: outcomeValue,
          outcome_recorded_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to record outcome:', error);
      return false;
    }
  }, []);

  const getActionHistory = useCallback(async (trendEventId: string) => {
    try {
      const { data, error } = await supabase
        .from('trend_action_outcomes')
        .select('*')
        .eq('trend_event_id', trendEventId)
        .order('action_taken_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get action history:', error);
      return [];
    }
  }, []);

  return {
    trackAction,
    recordOutcome,
    getActionHistory,
  };
}
