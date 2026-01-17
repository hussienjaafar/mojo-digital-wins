/**
 * Universal Redirect Page
 *
 * A system-wide redirect endpoint that captures Meta cookies and redirects to ActBlue.
 * Works for any organization via URL parameters.
 *
 * URL Format:
 * /r?org=SLUG&form=ACTBLUE_FORM&refcode=REFCODE&amount=AMOUNT
 *
 * Example:
 * /r?org=smith-campaign&form=smith-for-senate&refcode=meta_jan25&amount=25
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Redirect() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'capturing' | 'redirecting' | 'error'>('capturing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    async function captureAndRedirect() {
      // Get required parameters
      const orgSlug = searchParams.get('org');
      const formName = searchParams.get('form');

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

      try {
        // Call edge function to capture touchpoint (also validates org)
        const { data, error } = await supabase.functions.invoke('capture-meta-touchpoint', {
          body: {
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
          },
        });

        if (error) {
          console.error('Capture error:', error);
          setStatus('error');
          setErrorMessage(`Organization not found: ${orgSlug}`);
          return;
        }

        // Check if org was found
        if (!data?.success) {
          setStatus('error');
          setErrorMessage(data?.error || `Organization not found: ${orgSlug}`);
          return;
        }

        // Set org name from response
        if (data.organization?.name) {
          setOrgName(data.organization.name);
        }

        // Store session ID in localStorage for potential backup matching
        try {
          localStorage.setItem('attribution_session_id', sessionId);
        } catch {
          // Ignore localStorage errors
        }

        setStatus('redirecting');

        // Build ActBlue URL
        const actblueUrl = new URL(`https://secure.actblue.com/donate/${formName}`);

        if (refcode) actblueUrl.searchParams.set('refcode', refcode);
        if (amount) actblueUrl.searchParams.set('amount', amount);
        if (recurring === 'true') actblueUrl.searchParams.set('recurring', 'true');

        // Store fbclid in refcode2 for backup matching (if not already set)
        if (fbclid && !searchParams.get('refcode2')) {
          actblueUrl.searchParams.set('refcode2', `fb_${fbclid.substring(0, 20)}`);
        } else if (searchParams.get('refcode2')) {
          actblueUrl.searchParams.set('refcode2', searchParams.get('refcode2')!);
        }

        // Small delay for user to see the redirect message
        setTimeout(() => {
          window.location.href = actblueUrl.toString();
        }, 500);

      } catch (err) {
        console.error('Redirect error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    }

    captureAndRedirect();
  }, [searchParams]);

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

  // Loading/capturing/redirecting states
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
        <p className="text-lg text-gray-900">
          {status === 'capturing' && 'Preparing your donation...'}
          {status === 'redirecting' && 'Redirecting to secure donation page...'}
        </p>
        {orgName && (
          <p className="text-sm text-gray-500">
            Donation for {orgName}
          </p>
        )}
        <p className="text-sm text-gray-400">
          You will be redirected to ActBlue momentarily.
        </p>
      </div>
    </div>
  );
}
