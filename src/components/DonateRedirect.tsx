/**
 * DonateRedirect Component
 * 
 * A landing page component that captures Meta browser cookies (fbp, fbc, fbclid)
 * and stores them in attribution_touchpoints BEFORE redirecting users to ActBlue.
 * 
 * This ensures we have the Meta identifiers needed for accurate CAPI deduplication,
 * since ActBlue's webhook doesn't send fbp/fbc.
 * 
 * Usage:
 * 1. Create landing pages at /donate?refcode=xyz that render this component
 * 2. User lands from Meta ad → cookies captured → redirect to ActBlue
 * 3. When donation occurs, ActBlue webhook looks up touchpoint by email
 * 4. CAPI event includes fbp/fbc for accurate deduplication
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';

interface DonateRedirectProps {
  /** The ActBlue form URL to redirect to */
  actblueFormUrl: string;
  /** Organization ID for attribution tracking */
  organizationId: string;
  /** Optional delay before redirect (ms) - allows page to load for cookie capture */
  redirectDelay?: number;
  /** Optional custom message while redirecting */
  loadingMessage?: string;
  /** Optional callback when capture completes (for testing) */
  onCaptureComplete?: (success: boolean) => void;
}

/**
 * Get cookie value by name
 */
function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

/**
 * Capture Meta identifiers and store as attribution touchpoint
 */
async function captureMetaIdentifiers(
  organizationId: string,
  params: {
    fbclid?: string;
    refcode?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    email?: string;
  }
): Promise<{ success: boolean; touchpointId?: string; error?: string }> {
  try {
    // Capture browser cookies
    const fbp = getCookieValue('_fbp');
    const fbc = getCookieValue('_fbc');
    
    // If we have fbclid but no fbc cookie, construct it
    // fbc format: fb.1.{timestamp}.{fbclid}
    const fbcValue = fbc || (params.fbclid 
      ? `fb.1.${Date.now()}.${params.fbclid}` 
      : undefined);
    
    // Create session identifier for later matching (if no email)
    const sessionId = crypto.randomUUID();
    
    // Log what we're capturing
    logger.info('Capturing Meta identifiers', {
      hasFbp: !!fbp,
      hasFbc: !!fbcValue,
      hasFbclid: !!params.fbclid,
      hasRefcode: !!params.refcode,
    });
    
    // Store in attribution touchpoints
    const { data, error } = await supabase.functions.invoke('capture-meta-touchpoint', {
      body: {
        organization_id: organizationId,
        touchpoint_type: 'landing_page',
        email: params.email || null,
        session_id: sessionId,
        fbp: fbp || null,
        fbc: fbcValue || null,
        fbclid: params.fbclid || null,
        refcode: params.refcode || null,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        landing_url: window.location.href,
        referrer: document.referrer || null,
      },
    });
    
    if (error) {
      logger.error('Failed to capture touchpoint', error);
      return { success: false, error: error.message };
    }
    
    // Store session ID in localStorage for potential matching
    if (sessionId) {
      localStorage.setItem('attribution_session_id', sessionId);
    }
    
    return { success: true, touchpointId: data?.touchpoint_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Capture error', err);
    return { success: false, error: message };
  }
}

/**
 * Build ActBlue redirect URL with passthrough parameters
 */
function buildRedirectUrl(
  baseUrl: string,
  params: URLSearchParams
): string {
  const url = new URL(baseUrl);
  
  // Pass through important tracking parameters to ActBlue
  const passthroughParams = ['refcode', 'refcode2', 'amount', 'recurring'];
  
  passthroughParams.forEach(param => {
    const value = params.get(param);
    if (value) {
      url.searchParams.set(param, value);
    }
  });
  
  // Also pass fbclid if present (some ActBlue forms accept it)
  const fbclid = params.get('fbclid');
  if (fbclid) {
    // Store in refcode2 if not already set, so it's captured in webhook
    if (!url.searchParams.get('refcode2')) {
      url.searchParams.set('refcode2', `fb_${fbclid.substring(0, 20)}`);
    }
  }
  
  return url.toString();
}

export function DonateRedirect({
  actblueFormUrl,
  organizationId,
  redirectDelay = 1500,
  loadingMessage = "Preparing your secure donation page...",
  onCaptureComplete,
}: DonateRedirectProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'capturing' | 'redirecting' | 'error'>('capturing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const performCapture = useCallback(async () => {
    // Extract URL parameters
    const params = {
      fbclid: searchParams.get('fbclid') || undefined,
      refcode: searchParams.get('refcode') || searchParams.get('ref') || undefined,
      utm_source: searchParams.get('utm_source') || undefined,
      utm_medium: searchParams.get('utm_medium') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
      email: searchParams.get('email') || undefined,
    };
    
    // Capture Meta identifiers
    const result = await captureMetaIdentifiers(organizationId, params);
    
    if (result.success) {
      logger.info('Touchpoint captured successfully', { id: result.touchpointId });
    } else {
      logger.warn('Touchpoint capture failed (non-blocking)', { error: result.error });
    }
    
    onCaptureComplete?.(result.success);
    
    // Always redirect, even if capture fails (non-blocking)
    setStatus('redirecting');
    
    // Build redirect URL and go
    const redirectUrl = buildRedirectUrl(actblueFormUrl, searchParams);
    
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, redirectDelay);
  }, [searchParams, organizationId, actblueFormUrl, redirectDelay, onCaptureComplete]);
  
  useEffect(() => {
    performCapture();
  }, [performCapture]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <p className="text-lg text-foreground">{loadingMessage}</p>
        <p className="text-sm text-muted-foreground">
          You'll be redirected to our secure donation form momentarily.
        </p>
        {status === 'error' && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}

export default DonateRedirect;
