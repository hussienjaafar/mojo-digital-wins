import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent, trackCustomEvent } from '@/components/MetaPixel';

interface AnalyticsEntry {
  session_id: string;
  step_key: string;
  step_number: number;
  action: string;
  variant_label: string;
  segment: string | null;
  metadata: Record<string, any> | null;
  duration_ms: number | null;
  exit_type: string | null;
}

interface FunnelAnalyticsParams {
  sessionId: string;
  variant: string;
  segment: string | null;
}

export function useFunnelAnalytics({ sessionId, variant, segment }: FunnelAnalyticsParams) {
  const queue = useRef<AnalyticsEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepEntryTime = useRef<number | null>(null);
  const currentStepKey = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (queue.current.length === 0) return;
    const batch = [...queue.current];
    queue.current = [];

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/funnel_analytics`;
      const body = JSON.stringify(batch);
      const sent = navigator.sendBeacon?.(
        url + `?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        new Blob([body], { type: 'application/json' })
      );
      if (!sent) {
        supabase.from('funnel_analytics').insert(batch as any[]).then(() => {});
      }
    } else {
      supabase.from('funnel_analytics').insert(batch as any[]).then(() => {});
    }
  }, []);

  // Flush every 2 seconds
  useEffect(() => {
    timerRef.current = setInterval(flush, 2000);
    const handleVisChange = () => {
      if (document.visibilityState === 'hidden') {
        // Log abandonment for current step
        if (currentStepKey.current && stepEntryTime.current) {
          const duration = Date.now() - stepEntryTime.current;
          logStep(currentStepKey.current, 0, 'exit', { exit_reason: 'visibility_hidden' }, duration, 'abandoned');
        }
        flush();
      }
    };
    const handlePageHide = () => {
      if (currentStepKey.current && stepEntryTime.current) {
        const duration = Date.now() - stepEntryTime.current;
        logStep(currentStepKey.current, 0, 'exit', { exit_reason: 'pagehide' }, duration, 'abandoned');
      }
      flush();
    };
    document.addEventListener('visibilitychange', handleVisChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisChange);
      window.removeEventListener('pagehide', handlePageHide);
      flush();
    };
  }, [flush]);

  const logStep = useCallback(
    (stepKey: string, stepNumber: number, action: string, metadata?: Record<string, any>, durationMs?: number, exitType?: string) => {
      const entry: AnalyticsEntry = {
        session_id: sessionId,
        step_key: stepKey,
        step_number: stepNumber,
        action,
        variant_label: variant,
        segment,
        metadata: metadata || null,
        duration_ms: durationMs ?? null,
        exit_type: exitType ?? null,
      };

      const enqueue = () => queue.current.push(entry);
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(enqueue, { timeout: 500 });
      } else {
        setTimeout(enqueue, 0);
      }
    },
    [sessionId, variant, segment]
  );

  const trackStepView = useCallback(
    (stepKey: string, stepNumber: number) => {
      // Log exit for previous step with duration
      if (currentStepKey.current && stepEntryTime.current) {
        const duration = Date.now() - stepEntryTime.current;
        logStep(currentStepKey.current, stepNumber - 1, 'exit', undefined, duration, 'completed');
      }

      // Start timing new step
      stepEntryTime.current = Date.now();
      currentStepKey.current = stepKey;

      logStep(stepKey, stepNumber, 'view');
      trackCustomEvent('FunnelStepView', { step_key: stepKey, step_number: stepNumber, variant });
    },
    [logStep, variant]
  );

  const trackStepBack = useCallback(
    (stepKey: string, stepNumber: number) => {
      if (currentStepKey.current && stepEntryTime.current) {
        const duration = Date.now() - stepEntryTime.current;
        logStep(currentStepKey.current, stepNumber + 1, 'exit', undefined, duration, 'back');
      }
      stepEntryTime.current = Date.now();
      currentStepKey.current = stepKey;
    },
    [logStep]
  );

  const trackSegmentSelected = useCallback(
    (selectedSegment: string) => {
      logStep('segment_select', 1, 'segment_selected', { segment: selectedSegment });
      trackCustomEvent('SegmentSelected', { segment: selectedSegment, variant });
    },
    [logStep, variant]
  );

  const trackQualificationStarted = useCallback(() => {
    logStep('qualification', 4, 'started');
    trackCustomEvent('QualificationStarted', { variant });
  }, [logStep, variant]);

  const trackLeadSubmitted = useCallback(
    (budgetRange: string) => {
      logStep('qualification', 4, 'submitted', { budget_range: budgetRange });
      trackEvent('Lead', { variant, budget_range: budgetRange });
    },
    [logStep, variant]
  );

  const trackLeadQualified = useCallback(
    (budgetRange: string) => {
      trackCustomEvent('Lead_Qualified', { variant, budget_range: budgetRange });
    },
    [variant]
  );

  const trackConversion = useCallback(
    (stepKey: string, stepNumber: number) => {
      logStep(stepKey, stepNumber, 'conversion');
      // Increment conversion counter via fire-and-forget
      supabase
        .from('funnel_variant_performance')
        .select('id, conversions, alpha')
        .eq('step_key', stepKey)
        .eq('variant_label', variant)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('funnel_variant_performance')
              .update({
                conversions: data.conversions + 1,
                alpha: Number(data.alpha) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id)
              .then(() => {});
          }
        });
    },
    [logStep, variant]
  );

  const trackImpression = useCallback(
    (stepKey: string) => {
      // Increment impression counter via fire-and-forget
      supabase
        .from('funnel_variant_performance')
        .select('id, impressions, beta')
        .eq('step_key', stepKey)
        .eq('variant_label', variant)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('funnel_variant_performance')
              .update({
                impressions: data.impressions + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id)
              .then(() => {});
          }
        });
    },
    [variant]
  );

  return {
    logStep,
    trackStepView,
    trackStepBack,
    trackSegmentSelected,
    trackQualificationStarted,
    trackLeadSubmitted,
    trackLeadQualified,
    trackConversion,
    trackImpression,
  };
}
