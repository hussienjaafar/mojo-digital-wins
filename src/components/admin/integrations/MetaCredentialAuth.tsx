import React, { useState, useEffect, useMemo } from 'react';
import { Facebook, Key, Loader2, CheckCircle2, Building2, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  currency: string;
  business_name?: string;
}

interface MetaCredentialAuthProps {
  organizationId: string;
  onSuccess: (credentials: {
    access_token: string;
    ad_account_id: string;
    business_manager_id?: string;
  }) => void;
  disabled?: boolean;
}

export function MetaCredentialAuth({ 
  organizationId, 
  onSuccess,
  disabled = false 
}: MetaCredentialAuthProps) {
  const [authMethod, setAuthMethod] = useState<'oauth' | 'manual'>('oauth');
  const [isConnecting, setIsConnecting] = useState(false);
  const [oauthStep, setOauthStep] = useState<'idle' | 'authenticating' | 'selecting' | 'saving'>('idle');
  
  // OAuth state
  const [accessToken, setAccessToken] = useState('');
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [metaUserInfo, setMetaUserInfo] = useState<{ name: string; id: string } | null>(null);
  
  // Manual entry state
  const [manualToken, setManualToken] = useState('');
  const [manualAdAccountId, setManualAdAccountId] = useState('');
  const [manualBusinessManagerId, setManualBusinessManagerId] = useState('');
  
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

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'META_OAUTH_CALLBACK') return;

      const { code, state, error, errorDescription } = event.data;

      if (error) {
        toast.error(errorDescription || 'OAuth authentication failed');
        setOauthStep('idle');
        setIsConnecting(false);
        return;
      }

      if (code && state) {
        await handleOAuthCallback(code, state);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [organizationId]);

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setOauthStep('authenticating');

      const { data, error } = await supabase.functions.invoke('meta-oauth-callback', {
        body: { code, state, organizationId }
      });

      if (error) throw error;

      if (data.access_token) {
        setAccessToken(data.access_token);
        setMetaUserInfo(data.user);
        setAdAccounts(data.adAccounts || []);
        setOauthStep('selecting');
        
        // If only one account, auto-select it
        if (data.adAccounts?.length === 1) {
          setSelectedAccountId(data.adAccounts[0].id);
        }
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      toast.error(err.message || 'Failed to complete authentication');
      setOauthStep('idle');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartOAuth = async () => {
    setIsConnecting(true);
    setOauthStep('authenticating');

    try {
      const redirectUri = `${window.location.origin}/meta-oauth-callback`;
      
      const { data, error } = await supabase.functions.invoke('meta-oauth-init', {
        body: { 
          organizationId,
          redirectUri,
          mode: 'popup',
          returnUrl: window.location.href
        }
      });

      if (error) throw error;

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        data.authUrl,
        'meta-oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );
    } catch (err: any) {
      console.error('OAuth init error:', err);
      toast.error(err.message || 'Failed to start OAuth flow');
      setOauthStep('idle');
      setIsConnecting(false);
    }
  };

  const handleSelectAccount = () => {
    if (!selectedAccountId || !accessToken) return;

    const account = adAccounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    onSuccess({
      access_token: accessToken,
      ad_account_id: account.account_id,
      business_manager_id: account.business_name || undefined
    });

    toast.success(`Connected to ${account.name}`);
    setOauthStep('idle');
  };

  const handleManualSubmit = () => {
    if (!manualToken || !manualAdAccountId) {
      toast.error('Access token and Ad Account ID are required');
      return;
    }

    onSuccess({
      access_token: manualToken,
      ad_account_id: manualAdAccountId,
      business_manager_id: manualBusinessManagerId || undefined
    });
  };

  const getAccountStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Active</Badge>;
      case 2:
        return <Badge variant="destructive">Disabled</Badge>;
      case 3:
        return <Badge variant="secondary">Unsettled</Badge>;
      case 7:
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">Pending Review</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (disabled) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Meta credentials are locked. Delete and re-add to update.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as 'oauth' | 'manual')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="oauth" className="flex items-center gap-2">
            <Facebook className="h-4 w-4" />
            Connect with Facebook
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-4 pt-4">
          {oauthStep === 'idle' && (
            <div className="text-center space-y-4">
              <div className="p-6 border rounded-lg bg-gradient-to-b from-blue-50 to-transparent dark:from-blue-950/20">
                <Facebook className="h-12 w-12 mx-auto text-blue-600 mb-4" />
                <h3 className="font-semibold mb-2">Connect Meta Ads</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Securely connect via Facebook OAuth to access ad accounts.
                </p>
                <Button
                  onClick={handleStartOAuth}
                  disabled={isConnecting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Facebook className="h-4 w-4 mr-2" />
                  )}
                  Continue with Facebook
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We'll request read access to your ad accounts. You can revoke access anytime.
              </p>
            </div>
          )}

          {oauthStep === 'authenticating' && (
            <div className="text-center p-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">Authenticating with Facebook...</p>
              <p className="text-sm text-muted-foreground mt-2">Complete login in the popup window</p>
            </div>
          )}

          {oauthStep === 'selecting' && (
            <div className="space-y-4">
              {metaUserInfo && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Connected as <strong>{metaUserInfo.name}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label className="mb-2 block">Select Ad Account</Label>
                {adAccounts.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No ad accounts found. Make sure you have access to at least one Meta ad account.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
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
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAccountId === account.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedAccountId(account.id)}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{account.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {account.account_id}
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
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOauthStep('idle');
                    setAccessToken('');
                    setAdAccounts([]);
                    setSelectedAccountId(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSelectAccount}
                  disabled={!selectedAccountId}
                  className="flex-1"
                >
                  Connect Selected Account
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4 pt-4">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Manually enter a long-lived access token from the Meta Developer Portal.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="manual_access_token">
              Access Token <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="manual_access_token"
                type={showManualToken ? "text" : "password"}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="EAABsbCS..."
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowManualToken(!showManualToken)}
              >
                {showManualToken ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual_ad_account_id">
              Ad Account ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="manual_ad_account_id"
              value={manualAdAccountId}
              onChange={(e) => setManualAdAccountId(e.target.value)}
              placeholder="act_123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual_business_manager_id">
              Business Manager ID <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="manual_business_manager_id"
              value={manualBusinessManagerId}
              onChange={(e) => setManualBusinessManagerId(e.target.value)}
              placeholder="123456789"
            />
          </div>

          <Button
            onClick={handleManualSubmit}
            disabled={!manualToken || !manualAdAccountId}
            className="w-full"
          >
            Save Credentials
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}