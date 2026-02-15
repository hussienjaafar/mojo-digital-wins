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
  const capturedEarly = useRef(false);

  const captureEmail = useCallback(
    (email: string, organization?: string) => {
      if (capturedEarly.current) return;
      const trimmed = email.trim();
      if (!EMAIL_REGEX.test(trimmed)) return;

      capturedEarly.current = true;

      // Fire-and-forget upsert
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

  return { captureEmail, hasCaptured: capturedEarly };
}
