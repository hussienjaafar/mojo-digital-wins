import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PIXEL_ID = "1344961220416600";

export const initMetaPixel = () => {
  // Check if advertising cookies are enabled
  const cookieConsent = localStorage.getItem("cookieConsent");
  if (!cookieConsent) return;

  try {
    const preferences = JSON.parse(cookieConsent);
    if (!preferences.advertising) return;
  } catch (error) {
    console.error("Error parsing cookie preferences:", error);
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
