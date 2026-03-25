import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MetaOAuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || error);
      // Also write error to localStorage so parent can pick it up
      localStorage.setItem('meta_oauth_result', JSON.stringify({ error, errorDescription, timestamp: Date.now() }));
      return;
    }

    if (code && state) {
      // Always write to localStorage as cross-window fallback
      localStorage.setItem('meta_oauth_result', JSON.stringify({ code, state, timestamp: Date.now() }));

      // Also try postMessage if opener is available
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'META_OAUTH_CALLBACK', code, state, error: null, errorDescription: null },
            window.location.origin
          );
        } catch (e) {
          console.log('[MetaOAuthCallback] postMessage failed, localStorage fallback active');
        }
      }

      setStatus('success');
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      setStatus('error');
      setErrorMessage('Missing authorization code. Please try again.');
    }
  }, []);

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
              This window will close automatically.
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="font-medium text-destructive">Connection failed</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => window.close()}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
