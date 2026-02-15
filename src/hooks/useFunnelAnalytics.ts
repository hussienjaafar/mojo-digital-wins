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
}

interface FunnelAnalyticsParams {
  sessionId: string;
  variant: string;
  segment: string | null;
}

export function useFunnelAnalytics({ sessionId, variant, segment }: FunnelAnalyticsParams) {
  const queue = useRef<AnalyticsEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(() => {
    if (queue.current.length === 0) return;
    const batch = [...queue.current];
    queue.current = [];

    // Try sendBeacon if page is hiding, otherwise standard insert
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
      if (document.visibilityState === 'hidden') flush();
    };
    const handlePageHide = () => flush();
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
    (stepKey: string, stepNumber: number, action: string, metadata?: Record<string, any>) => {
      const entry: AnalyticsEntry = {
        session_id: sessionId,
        step_key: stepKey,
        step_number: stepNumber,
        action,
        variant_label: variant,
        segment,
        metadata: metadata || null,
      };

      // Use requestIdleCallback to avoid blocking INP
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
      logStep(stepKey, stepNumber, 'view');
      trackCustomEvent('FunnelStepView', { step_key: stepKey, step_number: stepNumber, variant });
    },
    [logStep, variant]
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

  return {
    logStep,
    trackStepView,
    trackSegmentSelected,
    trackQualificationStarted,
    trackLeadSubmitted,
    trackLeadQualified,
  };
}
