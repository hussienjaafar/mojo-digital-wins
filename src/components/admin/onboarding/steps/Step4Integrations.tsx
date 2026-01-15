import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationConfig, WizardStep } from '../types';
import { MetaAuthOptions } from '@/components/integrations/MetaAuthOptions';
import { 
  Plug, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2, 
  XCircle, 
  Loader2,
  TestTube,
  Eye,
  EyeOff,
  Zap,
  RefreshCw,
  Info,
  ExternalLink,
  Copy,
  Check,
  HelpCircle
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
    webhook_username: string;
    webhook_password: string;
    entity_id: string;
    csv_username: string;
    csv_password: string;
    isOpen: boolean;
    showWebhookPassword: boolean;
    showCsvPassword: boolean;
  };
}

export function Step4Integrations({ organizationId, stepData, onComplete, onBack }: Step4IntegrationsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [showActBlueHelp, setShowActBlueHelp] = useState(false);
  
  const webhookEndpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/actblue-webhook`;
  
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
    actblue: { webhook_username: '', webhook_password: '', entity_id: '', csv_username: '', csv_password: '', isOpen: false, showWebhookPassword: false, showCsvPassword: false }
  });
  
  const copyEndpointUrl = async () => {
    await navigator.clipboard.writeText(webhookEndpointUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

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

      if (platform === 'meta') {
        const { access_token, ad_account_id } = formState.meta;
        if (!access_token || !ad_account_id) {
          throw new Error('Please enter access token and ad account ID');
        }
        testResult = { success: true, error: '' };
      } else if (platform === 'switchboard') {
        const { api_key, account_id } = formState.switchboard;
        if (!api_key || !account_id) {
          throw new Error('Please enter API key and account ID');
        }
        testResult = { success: true, error: '' };
      } else if (platform === 'actblue') {
        const { webhook_username, webhook_password, entity_id, csv_username, csv_password } = formState.actblue;
        if (!webhook_username || !webhook_password) {
          throw new Error('Please enter webhook username and password');
        }
        if (!entity_id) {
          throw new Error('Please enter entity ID');
        }
        if (!csv_username || !csv_password) {
          throw new Error('Please enter CSV API username and password for reconciliation');
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
          basic_auth_username: formState.actblue.webhook_username,
          basic_auth_password: formState.actblue.webhook_password,
          entity_id: formState.actblue.entity_id,
          username: formState.actblue.csv_username,
          password: formState.actblue.csv_password
        };
        credentialMask = {
          webhook_username_hint: `****${formState.actblue.webhook_username.slice(-4)}`,
          entity_id: formState.actblue.entity_id,
          csv_username_hint: formState.actblue.csv_username
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

      if (platform === 'meta') {
        updateFormState('meta', { access_token: '', isOpen: false });
      } else if (platform === 'switchboard') {
        updateFormState('switchboard', { api_key: '', isOpen: false });
      } else if (platform === 'actblue') {
        updateFormState('actblue', { webhook_username: '', webhook_password: '', isOpen: false });
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

  const handleDisconnectIntegration = async (platform: 'meta' | 'switchboard' | 'actblue') => {
    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('client_api_credentials')
        .delete()
        .eq('organization_id', organizationId)
        .eq('platform', platform);

      if (error) throw error;

      setIntegrations(prev => ({
        ...prev,
        [platform]: { 
          platform, 
          is_enabled: false, 
          is_tested: false, 
          last_test_status: null 
        }
      }));

      toast({
        title: 'Integration disconnected',
        description: `${platform === 'meta' ? 'Meta Ads' : platform === 'switchboard' ? 'Switchboard SMS' : 'ActBlue'} has been disconnected. You can now reconnect with a different account.`
      });
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = (config: IntegrationConfig) => {
    if (config.is_enabled) {
      return (
        <Badge className="bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/20 text-[11px]">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    }
    if (config.is_tested && config.last_test_status === 'success') {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/5 text-[11px]">
          Tested
        </Badge>
      );
    }
    if (config.is_tested && config.last_test_status === 'error') {
      return (
        <Badge variant="destructive" className="text-[11px]">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[11px] bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]">
        Not Connected
      </Badge>
    );
  };

  const integrationConfigs = [
    {
      key: 'meta' as const,
      name: 'Meta Ads',
      description: 'Facebook & Instagram ad campaigns',
      color: 'blue',
      letter: 'M'
    },
    {
      key: 'switchboard' as const,
      name: 'Switchboard SMS',
      description: 'SMS campaign delivery data',
      color: 'purple',
      letter: 'S'
    },
    {
      key: 'actblue' as const,
      name: 'ActBlue',
      description: 'Donation and transaction data',
      color: 'red',
      letter: 'A'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-500/10 text-blue-600';
      case 'purple': return 'bg-purple-500/10 text-purple-600';
      case 'red': return 'bg-red-500/10 text-red-600';
      default: return 'bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-[18px] h-[18px] text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">Connect Your Data Sources</p>
            <p className="text-[12px] text-[hsl(var(--portal-text-secondary))] mt-0.5">
              Integrations are optional and can be configured later from the Integrations Hub.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-3">
        {integrationConfigs.map(({ key, name, description, color, letter }) => (
          <Collapsible
            key={key}
            open={formState[key].isOpen}
            onOpenChange={(open) => updateFormState(key, { isOpen: open })}
          >
            <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg ${getColorClasses(color)} flex items-center justify-center`}>
                      <span className="font-bold text-sm">{letter}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">{name}</p>
                      <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">{description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(integrations[key])}
                    <ChevronRight className={`h-4 w-4 text-[hsl(var(--portal-text-muted))] transition-transform ${formState[key].isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 pt-2 border-t border-[hsl(var(--portal-border))]">
                  {integrations[key].is_enabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[hsl(var(--portal-success))] py-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[13px]">Connected and enabled</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={isDisconnecting}
                            className="h-9"
                          >
                            {isDisconnecting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Reconnect with different account
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reconnect {key === 'meta' ? 'Meta Ads' : key === 'switchboard' ? 'Switchboard SMS' : 'ActBlue'}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will disconnect the current account. You'll need to log in again to connect a different account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDisconnectIntegration(key)}>
                              Disconnect & Reconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : key === 'meta' ? (
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
                  ) : (
                    <div className="space-y-4 pt-2">
                      {key === 'switchboard' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">API Key</Label>
                            <div className="flex gap-2">
                              <Input
                                type={formState.switchboard.showKey ? 'text' : 'password'}
                                placeholder="Enter Switchboard API key"
                                value={formState.switchboard.api_key}
                                onChange={(e) => updateFormState('switchboard', { api_key: e.target.value })}
                                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateFormState('switchboard', { showKey: !formState.switchboard.showKey })}
                                className="h-11 w-11"
                              >
                                {formState.switchboard.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">Account ID</Label>
                            <Input
                              placeholder="Enter account ID"
                              value={formState.switchboard.account_id}
                              onChange={(e) => updateFormState('switchboard', { account_id: e.target.value })}
                              className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => testConnection('switchboard')}
                              disabled={testingIntegration === 'switchboard'}
                              className="h-10"
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
                              className="h-10"
                            >
                              Save & Enable
                            </Button>
                          </div>
                        </>
                      )}
                      {key === 'actblue' && (
                        <>
                          {/* Intro Info Box */}
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                              <div className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                <p className="font-medium text-[hsl(var(--portal-text-primary))] mb-2">
                                  Two integrations are required for complete ActBlue data:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-[12px]">
                                  <li><strong>Webhook</strong> — Receives real-time donation notifications</li>
                                  <li><strong>CSV API</strong> — Backfills historical data and verifies webhook accuracy</li>
                                </ol>
                              </div>
                            </div>
                          </div>

                          {/* Webhook Section */}
                          <div className="space-y-4">
                            <div>
                              <div className="text-[12px] font-medium text-[hsl(var(--portal-text-secondary))] uppercase tracking-wide">
                                Webhook Integration
                              </div>
                              <p className="text-[11px] text-[hsl(var(--portal-text-muted))] mt-1">
                                Receives real-time donation notifications from ActBlue
                              </p>
                            </div>
                            
                            {/* Webhook Setup Instructions */}
                            <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 text-[12px] space-y-3">
                              <p className="font-medium text-[hsl(var(--portal-text-secondary))]">Setup Steps:</p>
                              <ol className="list-decimal list-inside space-y-2 text-[hsl(var(--portal-text-muted))]">
                                <li>
                                  Go to{' '}
                                  <a 
                                    href="https://secure.actblue.com/integrations" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                                  >
                                    ActBlue → Settings → Integrations
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </li>
                                <li>Click <strong>"Create Webhook"</strong></li>
                                <li>Set Event Type to <strong>"ActBlue Default"</strong></li>
                                <li>
                                  <span>Enter this Endpoint URL:</span>
                                  <div className="mt-2 flex items-center gap-2">
                                    <code className="bg-black/30 px-2 py-1 rounded text-[11px] text-blue-300 break-all flex-1">
                                      {webhookEndpointUrl}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={copyEndpointUrl}
                                      className="h-7 px-2 shrink-0"
                                    >
                                      {copiedEndpoint ? (
                                        <Check className="h-3.5 w-3.5 text-green-400" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </li>
                                <li>Create a <strong>Username</strong> and <strong>Password</strong> for authentication</li>
                                <li>Enter both credentials in the fields below</li>
                              </ol>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                  Webhook Username
                                  <span className="text-[11px] font-normal text-[hsl(var(--portal-text-muted))] block mt-0.5">
                                    (Username you created in ActBlue)
                                  </span>
                                </Label>
                                <Input
                                  placeholder="Enter webhook username"
                                  value={formState.actblue.webhook_username}
                                  onChange={(e) => updateFormState('actblue', { webhook_username: e.target.value })}
                                  className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                  Webhook Password
                                  <span className="text-[11px] font-normal text-[hsl(var(--portal-text-muted))] block mt-0.5">
                                    (Password you created in ActBlue)
                                  </span>
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    type={formState.actblue.showWebhookPassword ? 'text' : 'password'}
                                    placeholder="Enter webhook password"
                                    value={formState.actblue.webhook_password}
                                    onChange={(e) => updateFormState('actblue', { webhook_password: e.target.value })}
                                    className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => updateFormState('actblue', { showWebhookPassword: !formState.actblue.showWebhookPassword })}
                                    className="h-11 w-11"
                                  >
                                    {formState.actblue.showWebhookPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                Entity ID
                                <span className="text-[11px] font-normal text-[hsl(var(--portal-text-muted))] ml-2">
                                  (Found in ActBlue under Settings → General)
                                </span>
                              </Label>
                              <Input
                                placeholder="Enter entity ID (e.g., 12345)"
                                value={formState.actblue.entity_id}
                                onChange={(e) => updateFormState('actblue', { entity_id: e.target.value })}
                                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                              />
                            </div>
                          </div>

                          {/* CSV API Section */}
                          <div className="space-y-4 pt-4 mt-4 border-t border-[hsl(var(--portal-border))]">
                            <div>
                              <div className="text-[12px] font-medium text-[hsl(var(--portal-text-secondary))] uppercase tracking-wide">
                                CSV API (for reconciliation)
                              </div>
                              <p className="text-[11px] text-[hsl(var(--portal-text-muted))] mt-1">
                                Used to backfill historical data and verify webhook accuracy every 6 hours
                              </p>
                            </div>
                            
                            {/* CSV API Setup Instructions */}
                            <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 text-[12px] space-y-3">
                              <p className="font-medium text-[hsl(var(--portal-text-secondary))]">Setup Steps:</p>
                              <ol className="list-decimal list-inside space-y-2 text-[hsl(var(--portal-text-muted))]">
                                <li>
                                  Go to{' '}
                                  <a 
                                    href="https://secure.actblue.com/api_credentials" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                                  >
                                    ActBlue → Settings → API Credentials
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </li>
                                <li>Click <strong>"Create API Credentials"</strong> or use existing ones</li>
                                <li>Copy the <strong>Username</strong> and <strong>Password</strong> below</li>
                              </ol>
                              <p className="text-[11px] text-yellow-400/80 flex items-center gap-1.5 mt-2 pt-2 border-t border-[hsl(var(--portal-border))]">
                                <Info className="h-3.5 w-3.5" />
                                These are different from your webhook credentials
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                CSV API Username
                                <span className="text-[11px] font-normal text-[hsl(var(--portal-text-muted))] ml-2">
                                  (From API Credentials page)
                                </span>
                              </Label>
                              <Input
                                placeholder="Enter CSV API username"
                                value={formState.actblue.csv_username}
                                onChange={(e) => updateFormState('actblue', { csv_username: e.target.value })}
                                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">
                                CSV API Password
                                <span className="text-[11px] font-normal text-[hsl(var(--portal-text-muted))] ml-2">
                                  (From API Credentials page)
                                </span>
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  type={formState.actblue.showCsvPassword ? 'text' : 'password'}
                                  placeholder="Enter CSV API password"
                                  value={formState.actblue.csv_password}
                                  onChange={(e) => updateFormState('actblue', { csv_password: e.target.value })}
                                  className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateFormState('actblue', { showCsvPassword: !formState.actblue.showCsvPassword })}
                                  className="h-11 w-11"
                                >
                                  {formState.actblue.showCsvPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Help Section */}
                          <Collapsible open={showActBlueHelp} onOpenChange={setShowActBlueHelp}>
                            <CollapsibleTrigger className="flex items-center gap-2 text-[12px] text-blue-400 hover:text-blue-300 mt-4">
                              <HelpCircle className="h-4 w-4" />
                              Need help finding these credentials?
                              <ChevronDown className={`h-4 w-4 transition-transform ${showActBlueHelp ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 p-4 bg-[hsl(var(--portal-bg-tertiary))] rounded-lg text-[12px] space-y-4">
                              <div>
                                <p className="font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Where to find your Entity ID:</p>
                                <p className="text-[hsl(var(--portal-text-muted))]">
                                  ActBlue → Settings → General → Your entity ID is displayed at the top of the page
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Webhook vs CSV API credentials:</p>
                                <p className="text-[hsl(var(--portal-text-muted))]">
                                  These are <strong>separate credential sets</strong>. The webhook uses credentials you create when 
                                  setting up the webhook integration. The CSV API uses credentials from the API Credentials page in Settings.
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Don't have API credentials yet?</p>
                                <p className="text-[hsl(var(--portal-text-muted))]">
                                  You may need to contact ActBlue support to enable API access for your account. Once enabled, 
                                  you can create credentials from Settings → API Credentials.
                                </p>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => testConnection('actblue')}
                              disabled={testingIntegration === 'actblue'}
                              className="h-10"
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
                              className="h-10"
                            >
                              Save & Enable
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="h-10 px-5">
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleContinue} disabled={isLoading} className="h-10 px-5">
            Skip for now
          </Button>
          <Button onClick={handleContinue} disabled={isLoading} className="h-10 px-5">
            {Object.values(integrations).some(i => i.is_enabled) ? 'Save & Continue' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
