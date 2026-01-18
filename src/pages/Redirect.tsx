/**
 * Universal Redirect Page
 *
 * A system-wide redirect endpoint that captures Meta cookies and redirects to ActBlue.
 * Works for any organization via URL parameters or path segments.
 *
 * URL Formats:
 * - Path-based (preferred): /r/ORG_SLUG/ACTBLUE_FORM?refcode=REFCODE
 * - Query-based (legacy): /r?org=SLUG&form=ACTBLUE_FORM&refcode=REFCODE
 *
 * Examples:
 * - /r/smith-campaign/smith-for-senate?refcode=meta_jan25
 * - /r?org=smith-campaign&form=smith-for-senate&refcode=meta_jan25
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Redirect() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ org?: string; form?: string }>();
  const [status, setStatus] = useState<'redirecting' | 'error'>('redirecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function captureAndRedirect() {
      // Support both path-based and query-based parameters
      const orgSlug = params.org || searchParams.get('org');
      const formName = params.form || searchParams.get('form');

      if (!orgSlug) {
        setStatus('error');
        setErrorMessage('Missing required parameter: org');
        return;
      }

      if (!formName) {
        setStatus('error');
        setErrorMessage('Missing required parameter: form');
        return;
      }

      // Optional parameters
      const refcode = searchParams.get('refcode') || searchParams.get('rc');
      const amount = searchParams.get('amount') || searchParams.get('a');
      const recurring = searchParams.get('recurring');
      const fbclid = searchParams.get('fbclid');

      // Read Meta cookies from browser
      const getCookie = (name: string): string | null => {
        if (typeof document === 'undefined') return null;
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      };

      const fbp = getCookie('_fbp');
      let fbc = getCookie('_fbc');

      // Construct fbc from fbclid if cookie not present
      if (!fbc && fbclid) {
        fbc = `fb.1.${Date.now()}.${fbclid}`;
      }

      // Generate session ID for potential matching
      const sessionId = crypto.randomUUID();

      // Store session ID in localStorage for potential backup matching
      try {
        localStorage.setItem('attribution_session_id', sessionId);
      } catch {
        // Ignore localStorage errors
      }

      // Build ActBlue URL immediately
      const actblueUrl = new URL(`https://secure.actblue.com/donate/${formName}`);
      if (refcode) actblueUrl.searchParams.set('refcode', refcode);
      if (amount) actblueUrl.searchParams.set('amount', amount);
      if (recurring === 'true') actblueUrl.searchParams.set('recurring', 'true');

      // Store fbclid in refcode2 for backup matching
      if (fbclid && !searchParams.get('refcode2')) {
        actblueUrl.searchParams.set('refcode2', `fb_${fbclid.substring(0, 20)}`);
      } else if (searchParams.get('refcode2')) {
        actblueUrl.searchParams.set('refcode2', searchParams.get('refcode2')!);
      }

      // Fire-and-forget: Send touchpoint data without waiting
      const captureData = {
        organization_slug: orgSlug,
        touchpoint_type: fbp || fbc || fbclid ? 'meta_ad' : 'direct',
        session_id: sessionId,
        fbp: fbp || null,
        fbc: fbc || null,
        fbclid: fbclid || null,
        refcode: refcode || null,
        utm_source: searchParams.get('utm_source') || null,
        utm_medium: searchParams.get('utm_medium') || null,
        utm_campaign: searchParams.get('utm_campaign') || null,
        landing_url: window.location.href,
        referrer: document.referrer || null,
      };

      // Use sendBeacon for fire-and-forget (survives page navigation)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const beaconUrl = `${supabaseUrl}/functions/v1/capture-meta-touchpoint`;
        const blob = new Blob([JSON.stringify(captureData)], { type: 'application/json' });
        
        // Try sendBeacon first (most reliable for navigation)
        const beaconSent = navigator.sendBeacon(beaconUrl, blob);
        
        // Fallback to fetch with keepalive if sendBeacon fails
        if (!beaconSent) {
          fetch(beaconUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            body: JSON.stringify(captureData),
            keepalive: true, // Ensures request completes after page unloads
          }).catch(() => {
            // Silently fail - don't block redirect
          });
        }
      }

      // Redirect immediately - don't wait for capture
      window.location.href = actblueUrl.toString();
    }

    captureAndRedirect();
  }, [searchParams, params]);

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-semibold text-gray-900">Unable to Process</h1>
          <p className="text-gray-600">{errorMessage}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    );
  }

  // Redirecting state (shown briefly)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
        <p className="text-lg text-gray-900">Redirecting to secure donation page...</p>
        <p className="text-sm text-gray-400">
          You will be redirected to ActBlue momentarily.
        </p>
      </div>
    </div>
  );
}
