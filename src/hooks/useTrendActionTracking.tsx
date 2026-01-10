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
  entityName?: string; // Optional: for intelligence_actions linkage
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
    entityName,
  }: TrackActionParams): Promise<string | null> => {
    try {
      // Primary write: trend_action_outcomes (backwards compatible)
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
      const actionId = data?.id || null;

      // Dual-write: Also write to intelligence_actions for unified learning
      // This enables the feedback loop to work with both old and new tables
      if (actionId) {
        try {
          await supabase
            .from('intelligence_actions')
            .insert([{
              id: actionId, // Use same ID for correlation
              organization_id: organizationId,
              trend_event_id: trendEventId,
              entity_name: entityName || null,
              action_type: actionType,
              action_status: 'sent',
              sent_at: new Date().toISOString(),
              metadata,
            }]);
          // Don't fail if dual-write fails - just log and continue
        } catch (dualWriteError) {
          console.warn('Dual-write to intelligence_actions failed (non-fatal):', dualWriteError);
        }
      }

      return actionId;
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
      // Update trend_action_outcomes (primary)
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
    } catch (err) {
      console.error('Failed to record outcome:', err);
      return false;
    }
  }, []);

  const getActionHistory = useCallback(async (trendEventId: string) => {
    try {
      // Query from trend_action_outcomes table directly
      const { data: historyData, error: historyError } = await supabase
        .from('trend_action_outcomes')
        .select('*')
        .eq('trend_event_id', trendEventId)
        .order('action_taken_at', { ascending: false });

      if (historyError) throw historyError;
      return historyData || [];
    } catch (err) {
      console.error('Failed to get action history:', err);
      return [];
    }
  }, []);

  return {
    trackAction,
    recordOutcome,
    getActionHistory,
  };
}
