import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FieldTrackingParams {
  sessionId: string;
}

export function useFieldTracking({ sessionId }: FieldTrackingParams) {
  const fieldStartTimes = useRef<Record<string, number>>({});
  const queue = useRef<any[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (queue.current.length === 0) return;
    const batch = [...queue.current];
    queue.current = [];
    supabase.from('funnel_field_interactions').insert(batch).then(() => {});
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 2000);
  }, [flush]);

  const trackFieldFocus = useCallback((fieldName: string) => {
    fieldStartTimes.current[fieldName] = Date.now();
    queue.current.push({
      session_id: sessionId,
      field_name: fieldName,
      interaction_type: 'focus',
      time_spent_ms: null,
      had_error: false,
    });
    scheduleFlush();
  }, [sessionId, scheduleFlush]);

  const trackFieldBlur = useCallback((fieldName: string, hadError: boolean = false) => {
    const startTime = fieldStartTimes.current[fieldName];
    const timeSpent = startTime ? Date.now() - startTime : null;
    delete fieldStartTimes.current[fieldName];

    queue.current.push({
      session_id: sessionId,
      field_name: fieldName,
      interaction_type: 'blur',
      time_spent_ms: timeSpent,
      had_error: hadError,
    });
    scheduleFlush();
  }, [sessionId, scheduleFlush]);

  return { trackFieldFocus, trackFieldBlur };
}
