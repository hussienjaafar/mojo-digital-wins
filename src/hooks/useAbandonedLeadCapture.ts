import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AbandonedLeadParams {
  sessionId: string;
  variant: string;
  segment: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

export function useAbandonedLeadCapture({
  sessionId,
  variant,
  segment,
  utmSource,
  utmCampaign,
}: AbandonedLeadParams) {
  const lastCapturedEmail = useRef<string>('');

  const captureEmail = useCallback(
    (email: string, organization?: string) => {
      const trimmed = email.trim();
      if (!EMAIL_REGEX.test(trimmed)) return;

      // Skip if same email already captured (avoid unnecessary writes)
      if (trimmed === lastCapturedEmail.current) return;
      lastCapturedEmail.current = trimmed;

      // Fire-and-forget upsert — allows re-capture on correction
      supabase
        .from('funnel_leads')
        .upsert(
          {
            session_id: sessionId,
            email: trimmed,
            organization: organization?.trim() || null,
            variant_label: variant,
            segment,
            utm_source: utmSource,
            utm_campaign: utmCampaign,
            status: 'incomplete',
          } as any,
          { onConflict: 'session_id' }
        )
        .then(() => {});
    },
    [sessionId, variant, segment, utmSource, utmCampaign]
  );

  return { captureEmail };
}
