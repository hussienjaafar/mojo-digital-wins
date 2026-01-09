import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MetaOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // If there's an error from Meta
    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || error);
      return;
    }

    // If we have code and state, handle the callback
    if (code && state) {
      // Check if opened as popup
      if (window.opener) {
        // Send message to parent window
        window.opener.postMessage(
          {
            type: 'META_OAUTH_CALLBACK',
            code,
            state,
            error: null,
            errorDescription: null,
          },
          window.location.origin
        );
        
        setStatus('success');
        
        // Close popup after short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Full page redirect mode - decode state to get return URL
        try {
          const stateData = JSON.parse(atob(state));
          const returnUrl = stateData.returnUrl || '/admin?tab=onboarding-wizard';
          
          // Append meta callback params to return URL
          const url = new URL(returnUrl, window.location.origin);
          url.searchParams.set('meta_code', code);
          url.searchParams.set('meta_state', state);
          
          setStatus('success');
          
          // Redirect back to wizard
          setTimeout(() => {
            navigate(url.pathname + url.search, { replace: true });
          }, 1000);
        } catch (e) {
          // Fallback - redirect to wizard with params
          setStatus('success');
          navigate(`/admin?tab=onboarding-wizard&meta_code=${code}&meta_state=${state}`, { replace: true });
        }
      }
    } else {
      // No code/state - something went wrong
      setStatus('error');
      setErrorMessage('Missing authorization code. Please try again.');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Completing Meta connection...</p>
            <p className="text-sm text-muted-foreground">Please wait while we verify your account.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-medium text-green-600">Connected successfully!</p>
            <p className="text-sm text-muted-foreground">
              {window.opener ? 'This window will close automatically.' : 'Redirecting you back...'}
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="font-medium text-destructive">Connection failed</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex justify-center gap-2 pt-2">
              {window.opener ? (
                <Button variant="outline" onClick={() => window.close()}>
                  Close
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate('/admin?tab=onboarding-wizard')}>
                  Return to Setup
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
