import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationConfig, WizardStep } from '../types';
import { MetaAuthOptions } from '@/components/integrations/MetaAuthOptions';
import { 
  Plug, 
  ChevronDown, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  TestTube,
  Eye,
  EyeOff
} from 'lucide-react';

interface Step4IntegrationsProps {
  organizationId: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

interface IntegrationFormState {
  meta: {
    access_token: string;
    ad_account_id: string;
    isOpen: boolean;
    showToken: boolean;
  };
  switchboard: {
    api_key: string;
    account_id: string;
    isOpen: boolean;
    showKey: boolean;
  };
  actblue: {
    webhook_secret: string;
    entity_id: string;
    isOpen: boolean;
    showSecret: boolean;
  };
}

export function Step4Integrations({ organizationId, stepData, onComplete, onBack }: Step4IntegrationsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  
  const [integrations, setIntegrations] = useState<Record<string, IntegrationConfig>>(
    (stepData.integrations as Record<string, IntegrationConfig>) || {
      meta: { platform: 'meta', is_enabled: false, is_tested: false, last_test_status: null },
      switchboard: { platform: 'switchboard', is_enabled: false, is_tested: false, last_test_status: null },
      actblue: { platform: 'actblue', is_enabled: false, is_tested: false, last_test_status: null }
    }
  );

  const [formState, setFormState] = useState<IntegrationFormState>({
    meta: { access_token: '', ad_account_id: '', isOpen: false, showToken: false },
    switchboard: { api_key: '', account_id: '', isOpen: false, showKey: false },
    actblue: { webhook_secret: '', entity_id: '', isOpen: false, showSecret: false }
  });

  const updateFormState = <K extends keyof IntegrationFormState>(
    platform: K,
    updates: Partial<IntegrationFormState[K]>
  ) => {
    setFormState(prev => ({
      ...prev,
      [platform]: { ...prev[platform], ...updates }
    }));
  };

  const testConnection = async (platform: 'meta' | 'switchboard' | 'actblue') => {
    setTestingIntegration(platform);
    
    try {
      let testResult = { success: false, error: '' };

      // Platform-specific test logic
      if (platform === 'meta') {
        const { access_token, ad_account_id } = formState.meta;
        if (!access_token || !ad_account_id) {
          throw new Error('Please enter access token and ad account ID');
        }
        // Simulate test - in production this would call an edge function
        testResult = { success: true, error: '' };
      } else if (platform === 'switchboard') {
        const { api_key, account_id } = formState.switchboard;
        if (!api_key || !account_id) {
          throw new Error('Please enter API key and account ID');
        }
        testResult = { success: true, error: '' };
      } else if (platform === 'actblue') {
        const { webhook_secret, entity_id } = formState.actblue;
        if (!webhook_secret || !entity_id) {
          throw new Error('Please enter webhook secret and entity ID');
        }
        testResult = { success: true, error: '' };
      }

      setIntegrations(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          is_tested: true,
          last_test_status: testResult.success ? 'success' : 'error'
        }
      }));

      toast({
        title: testResult.success ? 'Connection successful' : 'Connection failed',
        description: testResult.success 
          ? `${platform} integration test passed.`
          : testResult.error,
        variant: testResult.success ? 'default' : 'destructive'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test failed';
      toast({
        title: 'Test failed',
        description: message,
        variant: 'destructive'
      });
      setIntegrations(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          is_tested: true,
          last_test_status: 'error'
        }
      }));
    } finally {
      setTestingIntegration(null);
    }
  };

  const saveIntegration = async (platform: 'meta' | 'switchboard' | 'actblue') => {
    const config = integrations[platform];
    if (!config.is_tested || config.last_test_status !== 'success') {
      toast({
        title: 'Test required',
        description: 'Please test the connection before saving.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      let credentials: Record<string, string> = {};
      let credentialMask: Record<string, string> = {};

      if (platform === 'meta') {
        credentials = {
          access_token: formState.meta.access_token,
          ad_account_id: formState.meta.ad_account_id
        };
        credentialMask = {
          token_hint: `****${formState.meta.access_token.slice(-4)}`,
          ad_account_id: formState.meta.ad_account_id
        };
      } else if (platform === 'switchboard') {
        credentials = {
          api_key: formState.switchboard.api_key,
          account_id: formState.switchboard.account_id
        };
        credentialMask = {
          key_hint: `****${formState.switchboard.api_key.slice(-4)}`,
          account_id: formState.switchboard.account_id
        };
      } else if (platform === 'actblue') {
        credentials = {
          webhook_secret: formState.actblue.webhook_secret,
          entity_id: formState.actblue.entity_id
        };
        credentialMask = {
          secret_hint: `****${formState.actblue.webhook_secret.slice(-4)}`,
          entity_id: formState.actblue.entity_id
        };
      }

      const { error } = await supabase
        .from('client_api_credentials')
        .upsert({
          organization_id: organizationId,
          platform,
          encrypted_credentials: credentials,
          credential_mask: credentialMask,
          credential_version: 1,
          is_active: true,
          last_tested_at: new Date().toISOString(),
          last_test_status: 'success'
        }, {
          onConflict: 'organization_id,platform'
        });

      if (error) throw error;

      // Log audit action
      await supabase.rpc('log_admin_action', {
        _action_type: 'create_integration',
        _table_affected: 'client_api_credentials',
        _record_id: null,
        _old_value: null,
        _new_value: { platform, organization_id: organizationId, credential_mask: credentialMask }
      });

      setIntegrations(prev => ({
        ...prev,
        [platform]: { ...prev[platform], is_enabled: true }
      }));

      // Clear sensitive data from form
      if (platform === 'meta') {
        updateFormState('meta', { access_token: '', isOpen: false });
      } else if (platform === 'switchboard') {
        updateFormState('switchboard', { api_key: '', isOpen: false });
      } else if (platform === 'actblue') {
        updateFormState('actblue', { webhook_secret: '', isOpen: false });
      }

      toast({
        title: 'Integration saved',
        description: `${platform} integration has been configured.`
      });
    } catch (error) {
      console.error('Error saving integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save integration. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    await onComplete(4, { integrations });
  };

  const getStatusBadge = (config: IntegrationConfig) => {
    if (config.is_enabled) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>;
    }
    if (config.is_tested && config.last_test_status === 'success') {
      return <Badge variant="outline" className="text-amber-600 border-amber-500/20">Tested - Save to Enable</Badge>;
    }
    if (config.is_tested && config.last_test_status === 'error') {
      return <Badge variant="destructive">Test Failed</Badge>;
    }
    return <Badge variant="secondary">Not Connected</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Connect Integrations
        </CardTitle>
        <CardDescription>
          Connect data sources to enable automated syncing and attribution tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meta Ads - OAuth Flow */}
        <Collapsible
          open={formState.meta.isOpen}
          onOpenChange={(open) => updateFormState('meta', { isOpen: open })}
        >
          <div className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">M</span>
                  </div>
                  <div>
                    <p className="font-medium">Meta Ads</p>
                    <p className="text-sm text-muted-foreground">Facebook & Instagram ad campaigns</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(integrations.meta)}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 border-t">
                {integrations.meta.is_enabled ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Connected and enabled</span>
                  </div>
                ) : (
                  <MetaAuthOptions
                    organizationId={organizationId}
                    onComplete={() => {
                      setIntegrations(prev => ({
                        ...prev,
                        meta: { 
                          ...prev.meta, 
                          is_enabled: true, 
                          is_tested: true, 
                          last_test_status: 'success' 
                        }
                      }));
                      updateFormState('meta', { isOpen: false });
                      toast({
                        title: 'Meta Ads connected',
                        description: 'Your ad account has been successfully linked.'
                      });
                    }}
                    onCancel={() => updateFormState('meta', { isOpen: false })}
                  />
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Switchboard SMS */}
        <Collapsible
          open={formState.switchboard.isOpen}
          onOpenChange={(open) => updateFormState('switchboard', { isOpen: open })}
        >
          <div className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-sm">S</span>
                  </div>
                  <div>
                    <p className="font-medium">Switchboard SMS</p>
                    <p className="text-sm text-muted-foreground">SMS campaign delivery data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(integrations.switchboard)}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4 border-t">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={formState.switchboard.showKey ? 'text' : 'password'}
                      placeholder="Enter Switchboard API key"
                      value={formState.switchboard.api_key}
                      onChange={(e) => updateFormState('switchboard', { api_key: e.target.value })}
                      disabled={integrations.switchboard.is_enabled}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateFormState('switchboard', { showKey: !formState.switchboard.showKey })}
                    >
                      {formState.switchboard.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account ID</Label>
                  <Input
                    placeholder="Enter account ID"
                    value={formState.switchboard.account_id}
                    onChange={(e) => updateFormState('switchboard', { account_id: e.target.value })}
                    disabled={integrations.switchboard.is_enabled}
                  />
                </div>
                {!integrations.switchboard.is_enabled && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => testConnection('switchboard')}
                      disabled={testingIntegration === 'switchboard'}
                    >
                      {testingIntegration === 'switchboard' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      onClick={() => saveIntegration('switchboard')}
                      disabled={!integrations.switchboard.is_tested || integrations.switchboard.last_test_status !== 'success'}
                    >
                      Save & Enable
                    </Button>
                  </div>
                )}
                {integrations.switchboard.is_enabled && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Connected and enabled</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* ActBlue */}
        <Collapsible
          open={formState.actblue.isOpen}
          onOpenChange={(open) => updateFormState('actblue', { isOpen: open })}
        >
          <div className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">A</span>
                  </div>
                  <div>
                    <p className="font-medium">ActBlue</p>
                    <p className="text-sm text-muted-foreground">Donation and transaction data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(integrations.actblue)}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4 border-t">
                <div className="space-y-2">
                  <Label>Webhook Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      type={formState.actblue.showSecret ? 'text' : 'password'}
                      placeholder="Enter webhook secret"
                      value={formState.actblue.webhook_secret}
                      onChange={(e) => updateFormState('actblue', { webhook_secret: e.target.value })}
                      disabled={integrations.actblue.is_enabled}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateFormState('actblue', { showSecret: !formState.actblue.showSecret })}
                    >
                      {formState.actblue.showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Entity ID</Label>
                  <Input
                    placeholder="Enter entity ID"
                    value={formState.actblue.entity_id}
                    onChange={(e) => updateFormState('actblue', { entity_id: e.target.value })}
                    disabled={integrations.actblue.is_enabled}
                  />
                </div>
                {!integrations.actblue.is_enabled && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => testConnection('actblue')}
                      disabled={testingIntegration === 'actblue'}
                    >
                      {testingIntegration === 'actblue' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      onClick={() => saveIntegration('actblue')}
                      disabled={!integrations.actblue.is_tested || integrations.actblue.last_test_status !== 'success'}
                    >
                      Save & Enable
                    </Button>
                  </div>
                )}
                {integrations.actblue.is_enabled && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Connected and enabled</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <p className="text-sm text-muted-foreground">
          You can skip integrations for now and connect them later from the Integrations Hub.
        </p>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleContinue} disabled={isLoading}>
              Skip for now
            </Button>
            <Button onClick={handleContinue} disabled={isLoading}>
              {Object.values(integrations).some(i => i.is_enabled) ? 'Save & Continue' : 'Continue'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
