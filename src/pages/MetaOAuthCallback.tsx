import { useEffect } from 'react';

export default function MetaOAuthCallback() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Send message to parent window
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'META_OAUTH_CALLBACK',
          code,
          state,
          error,
          errorDescription,
        },
        window.location.origin
      );
      
      // Close popup after sending message
      window.close();
    } else {
      // If not in popup, redirect to admin with params
      // This handles the case where user navigates directly
      window.location.href = '/admin';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Completing Meta connection...</p>
        <p className="text-sm text-muted-foreground">This window will close automatically.</p>
      </div>
    </div>
  );
}
