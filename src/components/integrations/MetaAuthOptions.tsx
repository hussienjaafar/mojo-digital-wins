import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, Building2, Key, LogIn, AlertCircle, Eye, EyeOff, Search } from 'lucide-react';
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

interface MetaAuthOptionsProps {
  organizationId: string;
  onComplete: (adAccount: MetaAdAccount) => void;
  onCancel: () => void;
}

type AuthStep = 'choose' | 'oauth-waiting' | 'selecting' | 'manual' | 'saving';

export function MetaAuthOptions({ organizationId, onComplete, onCancel }: MetaAuthOptionsProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<AuthStep>('choose');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'manual'>('oauth');
  const [isLoading, setIsLoading] = useState(false);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [metaUser, setMetaUser] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [error, setError] = useState<string>('');
  
  // Manual input state
  const [manualToken, setManualToken] = useState('');
  const [manualAdAccountId, setManualAdAccountId] = useState('');
  
  // Search state
  const [accountSearch, setAccountSearch] = useState('');
  
  // Filter accounts based on search
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return adAccounts;
    const search = accountSearch.toLowerCase();
    return adAccounts.filter(account => 
      account.name.toLowerCase().includes(search) ||
      account.account_id.toLowerCase().includes(search) ||
      (account.business_name?.toLowerCase().includes(search) ?? false)
    );
  }, [adAccounts, accountSearch]);
  const [showManualToken, setShowManualToken] = useState(false);

  // Handle OAuth callback via message from popup OR redirect
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'META_OAUTH_CALLBACK') {
        const { code, state, error: oauthError, errorDescription } = event.data;
        
        if (oauthError) {
          setError(errorDescription || oauthError);
          setStep('choose');
          return;
        }

        if (code && state) {
          await processOAuthCallback(code, state);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check for redirect callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('meta_code');
    const state = urlParams.get('meta_state');
    
    if (code && state) {
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('meta_code');
      newUrl.searchParams.delete('meta_state');
      window.history.replaceState({}, '', newUrl.toString());
      
      processOAuthCallback(code, state);
    }
  }, []);

  const processOAuthCallback = async (code: string, state: string) => {
    setIsLoading(true);
    setStep('selecting');
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-oauth-callback', {
        body: {
          code,
          state,
          redirectUri: `${window.location.origin}/meta-oauth-callback`,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setMetaUser(data.metaUser);
      setAdAccounts(data.adAccounts || []);
      setAccessToken(data.accessToken);
      setExpiresIn(data.expiresIn);

      // Auto-select if only one account
      if (data.adAccounts?.length === 1) {
        setSelectedAccountIds([data.adAccounts[0].id]);
      }

      toast({
        title: 'Connected to Meta',
        description: `Logged in as ${data.metaUser.name}. Select ad account(s).`,
      });
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Failed to complete OAuth');
      setStep('choose');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOAuth = async (useRedirect: boolean = false) => {
    setIsLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-oauth-init', {
        body: {
          organizationId,
          redirectUri: `${window.location.origin}/meta-oauth-callback`,
          useRedirect,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      if (useRedirect) {
        // Full page redirect
        window.location.href = data.authUrl;
      } else {
        // Popup mode
        setStep('oauth-waiting');
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'meta-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // Poll for popup close
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            if (step === 'oauth-waiting') {
              setStep('choose');
              setIsLoading(false);
            }
          }
        }, 500);
      }
    } catch (err: any) {
      console.error('OAuth init error:', err);
      setError(err.message || 'Failed to start OAuth');
      setStep('choose');
    } finally {
      if (!useRedirect) {
        setIsLoading(false);
      }
    }
  };

  const handleManualSubmit = async () => {
    if (!manualToken || !manualAdAccountId) {
      setError('Please enter both access token and ad account ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Validate the token by fetching ad account info
      const response = await fetch(
        `https://graph.facebook.com/v19.0/act_${manualAdAccountId}?fields=id,name,account_id,account_status,currency,business_name&access_token=${manualToken}`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Invalid token or ad account');
      }

      // Save the connection
      const adAccount: MetaAdAccount = {
        id: data.id,
        name: data.name,
        account_id: data.account_id,
        account_status: data.account_status,
        currency: data.currency,
        business_name: data.business_name,
      };

      await saveConnection([adAccount], manualToken, 0);
    } catch (err: any) {
      console.error('Manual validation error:', err);
      setError(err.message || 'Failed to validate credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const saveConnection = async (accounts: MetaAdAccount[], token: string, expiry: number) => {
    setStep('saving');
    setIsLoading(true);

    try {
      // For now, save the first selected account (can be extended for multi-account)
      const primaryAccount = accounts[0];

      const { data, error: fnError } = await supabase.functions.invoke('meta-save-connection', {
        body: {
          organizationId,
          accessToken: token,
          expiresIn: expiry,
          selectedAdAccount: primaryAccount,
          metaUserId: metaUser?.id,
          metaUserName: metaUser?.name,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Meta Ads Connected!',
        description: `Successfully connected to ${primaryAccount.name}`,
      });

      onComplete(primaryAccount);
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

  const handleSaveConnection = async () => {
    if (selectedAccountIds.length === 0) {
      toast({ title: 'Please select at least one ad account', variant: 'destructive' });
      return;
    }

    const selectedAccounts = adAccounts.filter(a => selectedAccountIds.includes(a.id));
    await saveConnection(selectedAccounts, accessToken, expiresIn);
  };

  const getAccountStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 2:
        return <Badge variant="secondary">Disabled</Badge>;
      case 3:
        return <Badge variant="destructive">Unsettled</Badge>;
      default:
        return <Badge variant="outline">Status {status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Step: Choose method */}
      {step === 'choose' && (
        <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as 'oauth' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Login with Facebook
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Manual Token
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="oauth" className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Connect securely using your Facebook account. You'll be able to select which ad accounts to connect.</p>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-600">
                  <strong>Tip:</strong> If the popup is blocked, click "Use full page login" instead.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => handleStartOAuth(false)} 
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
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Log in with Facebook
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleStartOAuth(true)} 
                disabled={isLoading}
              >
                Use full page login
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground">
              <p>Enter your Meta access token and ad account ID manually. Get these from Meta Business Suite.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    type={showManualToken ? 'text' : 'password'}
                    placeholder="EAAxxxxxxx..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowManualToken(!showManualToken)}
                  >
                    {showManualToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ad Account ID</Label>
                <Input
                  placeholder="123456789"
                  value={manualAdAccountId}
                  onChange={(e) => setManualAdAccountId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Without the "act_" prefix
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleManualSubmit} 
                disabled={isLoading || !manualToken || !manualAdAccountId}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Validating...
                  </>
                ) : (
                  'Validate & Connect'
                )}
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Step: Waiting for OAuth popup */}
      {step === 'oauth-waiting' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <div className="text-center">
            <p className="font-medium">Waiting for Facebook login...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Complete the login in the popup window
            </p>
          </div>
          <Button variant="outline" onClick={() => { setStep('choose'); setIsLoading(false); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Step: Select ad accounts */}
      {step === 'selecting' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p>Loading ad accounts...</p>
            </div>
          ) : adAccounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No ad accounts found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Make sure you have access to at least one ad account in Meta Business Suite.
              </p>
              <Button variant="outline" onClick={() => setStep('choose')} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-600">
                  Logged in as <strong>{metaUser?.name}</strong>
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Select Ad Account(s)</Label>
                {adAccounts.length > 3 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search accounts..."
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedAccountIds.includes(account.id)
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => handleAccountToggle(account.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={() => handleAccountToggle(account.id)}
                        className="rounded border-input"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{account.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  {filteredAccounts.length === 0 && accountSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No accounts match "{accountSearch}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveConnection} 
                  disabled={selectedAccountIds.length === 0 || isLoading}
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
                      Connect {selectedAccountIds.length > 1 ? `${selectedAccountIds.length} Accounts` : 'Account'}
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

      {/* Step: Saving */}
      {step === 'saving' && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Saving connection...</p>
        </div>
      )}
    </div>
  );
}
