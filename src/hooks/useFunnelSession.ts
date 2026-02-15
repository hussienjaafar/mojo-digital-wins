import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getCookie = (name: string): string | undefined => {
  const match = document.cookie.split('; ').find(row => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
};

const detectDevice = (): string => {
  if (typeof window === 'undefined') return 'desktop';
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
};

export interface FunnelSessionData {
  sessionId: string;
  variant: string;
  segment: string | null;
  setSegment: (s: string) => void;
  selectedChannels: string[];
  setSelectedChannels: (c: string[]) => void;
  deviceType: string;
  utmParams: Record<string, string | null>;
}

export function useFunnelSession(): FunnelSessionData {
  const [searchParams] = useSearchParams();
  const initialized = useRef(false);

  const [sessionId] = useState(() => crypto.randomUUID());
  const [variant] = useState<string>(() => {
    const v = searchParams.get('variant');
    return v === 'A' || v === 'B' ? v : Math.random() < 0.5 ? 'A' : 'B';
  });
  const [segment, setSegment] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [deviceType] = useState(detectDevice);

  const utmParams = {
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fbPixelId = getCookie('_fbp') || null;

    // Fire-and-forget session insert
    supabase.from('funnel_sessions').insert({
      session_id: sessionId,
      variant_label: variant,
      device_type: deviceType,
      fb_pixel_id: fbPixelId,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      utm_content: utmParams.utm_content,
    } as any).then(() => {});

    // Fire-and-forget IP capture
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/functions/v1/get-client-ip`, {
        method: 'GET',
        headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
        keepalive: true,
      })
        .then(r => r.json())
        .then(data => {
          if (data?.ip && data.ip !== 'unknown') {
            supabase.from('funnel_sessions')
              .update({ ip_address: data.ip } as any)
              .eq('session_id', sessionId)
              .then(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  // Update session when segment/channels change
  const updateSegment = useCallback((s: string) => {
    setSegment(s);
    supabase.from('funnel_sessions')
      .update({ segment: s } as any)
      .eq('session_id', sessionId)
      .then(() => {});
  }, [sessionId]);

  const updateChannels = useCallback((c: string[]) => {
    setSelectedChannels(c);
    supabase.from('funnel_sessions')
      .update({ selected_channels: c } as any)
      .eq('session_id', sessionId)
      .then(() => {});
  }, [sessionId]);

  return {
    sessionId,
    variant,
    segment,
    setSegment: updateSegment,
    selectedChannels,
    setSelectedChannels: updateChannels,
    deviceType,
    utmParams,
  };
}
