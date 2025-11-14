import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const PIXEL_ID = "1344961220416600";

export const initMetaPixel = () => {
  // Check if advertising cookies are enabled
  const cookieConsent = localStorage.getItem("cookieConsent");
  if (!cookieConsent) return;

  try {
    const preferences = JSON.parse(cookieConsent);
    if (!preferences.advertising) return;
  } catch (error) {
    logger.error('Error parsing cookie preferences', error);
    return;
  }

  // Initialize Meta Pixel if not already initialized
  if (!window.fbq) {
    (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      'script',
      'https://connect.facebook.net/en_US/fbevents.js'
    );

    window.fbq('init', PIXEL_ID);
  }
};

export const trackPageView = () => {
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (window.fbq) {
    window.fbq('track', eventName, params);
  }
};

export const trackCustomEvent = (eventName: string, params?: Record<string, any>) => {
  if (window.fbq) {
    window.fbq('trackCustom', eventName, params);
  }
};

// Server-side conversion tracking
export const trackConversion = async (
  eventName: string,
  customData?: Record<string, any>
) => {
  try {
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session, skip server-side tracking (client-side pixel still tracks)
    if (!session) {
      return;
    }

    const { error } = await supabase.functions.invoke('meta-conversions', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        event_name: eventName,
        event_source_url: window.location.href,
        custom_data: customData,
      },
    });

    if (error) {
      logger.error('Error tracking conversion', error);
    }
  } catch (error) {
    logger.error('Error tracking conversion', error);
  }
};

const MetaPixel = () => {
  const location = useLocation();

  useEffect(() => {
    // Initialize pixel on mount
    initMetaPixel();
  }, []);

  useEffect(() => {
    // Track page view on route change
    trackPageView();
  }, [location.pathname]);

  // Re-initialize when cookie preferences change
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookieConsent') {
        initMetaPixel();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return null;
};

export default MetaPixel;
