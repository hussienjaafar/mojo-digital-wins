import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Building2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  business_name?: string;
}

interface MetaOAuthFlowProps {
  organizationId: string;
  onComplete: (adAccount: MetaAdAccount) => void;
  onCancel: () => void;
}

export function MetaOAuthFlow({ organizationId, onComplete, onCancel }: MetaOAuthFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'init' | 'selecting' | 'saving'>('init');
  const [isLoading, setIsLoading] = useState(false);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [metaUser, setMetaUser] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [error, setError] = useState<string>('');

  // Handle OAuth callback from URL
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const errorParam = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      if (code && state) {
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
        
        setIsLoading(true);
        setStep('selecting');

        try {
          const { data, error: fnError } = await supabase.functions.invoke('meta-oauth-callback', {
            body: {
              code,
              state,
              redirectUri: `${window.location.origin}/admin`,
            },
          });

          if (fnError) throw fnError;
          if (data.error) throw new Error(data.error);

          setMetaUser(data.metaUser);
          setAdAccounts(data.adAccounts || []);
          setAccessToken(data.accessToken);
          setExpiresIn(data.expiresIn);

          if (data.adAccounts?.length === 1) {
            setSelectedAccountId(data.adAccounts[0].id);
          }

          toast({
            title: 'Connected to Meta',
            description: `Logged in as ${data.metaUser.name}. Select an ad account.`,
          });
        } catch (err: any) {
          console.error('OAuth callback error:', err);
          setError(err.message || 'Failed to complete OAuth');
          setStep('init');
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleCallback();
  }, [toast]);

  const handleStartOAuth = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-oauth-init', {
        body: {
          organizationId,
          redirectUri: `${window.location.origin}/admin`,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Redirect to Meta OAuth
      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error('OAuth init error:', err);
      setError(err.message || 'Failed to start OAuth');
      setIsLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!selectedAccountId) {
      toast({ title: 'Please select an ad account', variant: 'destructive' });
      return;
    }

    const selectedAccount = adAccounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) return;

    setStep('saving');
    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-save-connection', {
        body: {
          organizationId,
          accessToken,
          expiresIn,
          selectedAdAccount: selectedAccount,
          metaUserId: metaUser?.id,
          metaUserName: metaUser?.name,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Meta Connected!',
        description: `Successfully connected to ${selectedAccount.name}`,
      });

      onComplete(selectedAccount);
    } catch (err: any) {
      console.error('Save connection error:', err);
      setError(err.message || 'Failed to save connection');
      toast({
        title: 'Connection Failed',
        description: err.message || 'Could not save Meta connection',
        variant: 'destructive',
      });
      setStep('selecting');
    } finally {
      setIsLoading(false);
    }
  };

  const getAccountStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 2:
        return <Badge variant="secondary">Disabled</Badge>;
      case 3:
        return <Badge variant="destructive">Unsettled</Badge>;
      case 7:
        return <Badge variant="outline">Pending Risk Review</Badge>;
      case 8:
        return <Badge variant="outline">Pending Settlement</Badge>;
      case 9:
        return <Badge variant="outline">In Grace Period</Badge>;
      case 100:
        return <Badge variant="outline">Pending Closure</Badge>;
      case 101:
        return <Badge variant="destructive">Closed</Badge>;
      case 201:
        return <Badge variant="destructive">Any Closed</Badge>;
      case 202:
        return <Badge variant="outline">Any Active</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <CardTitle className="text-lg">Connect Meta Ads</CardTitle>
            <CardDescription>
              {step === 'init' && 'Log in with your Meta account to connect ad accounts'}
              {step === 'selecting' && `Logged in as ${metaUser?.name}. Select an ad account.`}
              {step === 'saving' && 'Saving connection...'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <XCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {step === 'init' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the button below to log in with your Meta account. You'll be able to select which ad account to connect.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={handleStartOAuth} 
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Log in with Meta
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'selecting' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p>Loading ad accounts...</p>
              </div>
            ) : adAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No ad accounts found for this Meta account.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure you have access to at least one ad account in Meta Business Suite.
                </p>
              </div>
            ) : (
              <>
                <RadioGroup value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <div className="space-y-2">
                    {adAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedAccountId === account.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedAccountId(account.id)}
                      >
                        <RadioGroupItem value={account.id} id={account.id} />
                        <div className="flex-1">
                          <Label htmlFor={account.id} className="cursor-pointer font-medium">
                            {account.name}
                          </Label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              ID: {account.account_id}
                            </span>
                            {account.business_name && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {account.business_name}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {account.currency}
                            </span>
                          </div>
                        </div>
                        {getAccountStatusBadge(account.account_status)}
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleSaveConnection} 
                    disabled={!selectedAccountId || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Connect Selected Account
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'saving' && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p>Saving connection...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}