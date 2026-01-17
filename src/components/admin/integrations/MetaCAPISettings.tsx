/**
 * Meta CAPI Settings Component
 *
 * Admin UI for configuring per-org Meta Conversions API settings.
 * Used for Phase 1 manual onboarding of first 2 clients.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  EyeOff,
  TestTube,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MetaCAPISettingsProps {
  organizationId: string;
  organizationName?: string;
  onSave?: () => void;
}

interface CAPIConfig {
  id: string;
  pixel_id: string;
  privacy_mode: 'conservative' | 'balanced' | 'aggressive';
  actblue_owns_donation_complete: boolean;
  donation_event_name: string;
  test_event_code: string | null;
  is_enabled: boolean;
  last_send_at: string | null;
  last_send_status: 'success' | 'failed' | null;
  last_error: string | null;
  total_events_sent: number;
  total_events_failed: number;
}

export function MetaCAPISettings({ organizationId, organizationName, onSave }: MetaCAPISettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [accessToken, setAccessToken] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [privacyMode, setPrivacyMode] = useState<'conservative' | 'balanced' | 'aggressive'>('conservative');
  const [actBlueOwnsDonation, setActBlueOwnsDonation] = useState(false);
  const [donationEventName, setDonationEventName] = useState('Purchase');
  const [testEventCode, setTestEventCode] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ['capi-config', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_capi_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as CAPIConfig | null;
    },
  });

  // Check if credentials exist
  const { data: credsExist } = useQuery({
    queryKey: ['capi-creds-exist', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_api_credentials')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('platform', 'meta_capi')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Populate form with existing config
  useEffect(() => {
    if (config) {
      setPixelId(config.pixel_id || '');
      setPrivacyMode(config.privacy_mode || 'conservative');
      setActBlueOwnsDonation(config.actblue_owns_donation_complete || false);
      setDonationEventName(config.donation_event_name || 'Purchase');
      setTestEventCode(config.test_event_code || '');
    }
    if (credsExist) {
      setHasExistingToken(true);
    }
  }, [config, credsExist]);

  // Test connection
  const handleTest = async () => {
    if (!accessToken && !hasExistingToken) {
      toast({ title: 'Missing token', description: 'Please enter an access token', variant: 'destructive' });
      return;
    }
    if (!pixelId) {
      toast({ title: 'Missing Pixel ID', description: 'Please enter a Pixel ID', variant: 'destructive' });
      return;
    }

    setIsTesting(true);
    try {
      // Simple test: try to get pixel info (doesn't send events)
      const token = accessToken || 'existing';
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${pixelId}?fields=name&access_token=${token}`
      );

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Connection successful',
          description: `Connected to pixel: ${data.name || pixelId}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error?.message || 'Connection failed');
      }
    } catch (e) {
      toast({
        title: 'Connection failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save configuration
  const handleSave = async () => {
    if (!accessToken && !hasExistingToken) {
      toast({ title: 'Missing token', description: 'Please enter an access token', variant: 'destructive' });
      return;
    }
    if (!pixelId) {
      toast({ title: 'Missing Pixel ID', description: 'Please enter a Pixel ID', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // Save credentials if new token provided
      if (accessToken) {
        const { error: credError } = await supabase
          .from('client_api_credentials')
          .upsert({
            organization_id: organizationId,
            platform: 'meta_capi',
            encrypted_credentials: {
              access_token: accessToken,
              token_type: 'user',
              created_via: 'manual',
              created_at: new Date().toISOString(),
            },
            is_active: true,
            last_tested_at: new Date().toISOString(),
            last_test_status: 'success',
          }, { onConflict: 'organization_id,platform' });

        if (credError) throw credError;
      }

      // Save config
      const { error: configError } = await supabase
        .from('meta_capi_config')
        .upsert({
          organization_id: organizationId,
          pixel_id: pixelId,
          privacy_mode: privacyMode,
          actblue_owns_donation_complete: actBlueOwnsDonation,
          donation_event_name: donationEventName,
          test_event_code: testEventCode || null,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });

      if (configError) throw configError;

      // Audit log
      await supabase.rpc('log_admin_action', {
        _action_type: 'configure_capi',
        _table_affected: 'meta_capi_config',
        _record_id: null,
        _old_value: null,
        _new_value: {
          organization_id: organizationId,
          pixel_id: pixelId,
          privacy_mode: privacyMode,
          actblue_owns_donation: actBlueOwnsDonation,
        },
      });

      toast({ title: 'Settings saved', description: 'Meta CAPI is now enabled for this organization.' });
      queryClient.invalidateQueries({ queryKey: ['capi-config', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['capi-creds-exist', organizationId] });
      setHasExistingToken(true);
      setAccessToken(''); // Clear token from memory
      onSave?.();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Disable CAPI
  const handleDisable = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from('meta_capi_config')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId);

      toast({ title: 'CAPI disabled', description: 'Conversion events will no longer be sent to Meta.' });
      queryClient.invalidateQueries({ queryKey: ['capi-config', organizationId] });
    } catch (e) {
      toast({
        title: 'Failed to disable',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Meta Conversions API</h3>
          {organizationName && (
            <p className="text-sm text-muted-foreground">{organizationName}</p>
          )}
        </div>
        {config?.is_enabled ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="secondary">
            Not Configured
          </Badge>
        )}
      </div>

      {/* Health stats if enabled */}
      {config?.is_enabled && (
        <div className="grid grid-cols-4 gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="text-center">
            <div className="text-2xl font-bold">{config.total_events_sent || 0}</div>
            <div className="text-xs text-muted-foreground">Events Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{config.total_events_failed || 0}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {config.last_send_status === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
              ) : config.last_send_status === 'failed' ? (
                <XCircle className="h-6 w-6 text-red-500 mx-auto" />
              ) : (
                '-'
              )}
            </div>
            <div className="text-xs text-muted-foreground">Last Status</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">
              {config.last_send_at
                ? formatDistanceToNow(new Date(config.last_send_at), { addSuffix: true })
                : 'Never'}
            </div>
            <div className="text-xs text-muted-foreground">Last Send</div>
          </div>
          {config.last_error && (
            <div className="col-span-4 mt-2 p-2 rounded bg-red-500/10 text-red-600 text-xs">
              <strong>Last Error:</strong> {config.last_error.substring(0, 200)}
            </div>
          )}
        </div>
      )}

      {/* Access Token */}
      <div className="space-y-2">
        <Label>Access Token</Label>
        <div className="flex gap-2">
          <Input
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={hasExistingToken ? 'Token configured (enter new to replace)' : 'Paste Meta access token'}
            className="font-mono text-sm"
          />
          <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Get from Meta Events Manager &rarr; Settings &rarr; Generate Access Token
          <a
            href="https://business.facebook.com/events_manager2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* Pixel ID */}
      <div className="space-y-2">
        <Label>Pixel ID</Label>
        <Input
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value)}
          placeholder="e.g., 1234567890123456"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">Found in Events Manager &rarr; Data Sources</p>
      </div>

      {/* Test Event Code (for validation) */}
      <div className="space-y-2">
        <Label>Test Event Code (optional)</Label>
        <Input
          value={testEventCode}
          onChange={(e) => setTestEventCode(e.target.value)}
          placeholder="e.g., TEST12345"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          From Events Manager &rarr; Test Events tab. Remove after validation.
        </p>
      </div>

      {/* Donation Event Name */}
      <div className="space-y-2">
        <Label>Donation Event Name</Label>
        <Input
          value={donationEventName}
          onChange={(e) => setDonationEventName(e.target.value)}
          placeholder="Purchase"
        />
        <p className="text-xs text-muted-foreground">
          Usually &quot;Purchase&quot; for standard Meta optimization. Can use &quot;Donate&quot; for custom events.
        </p>
      </div>

      {/* Privacy Mode */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Privacy Mode
        </Label>
        <RadioGroup value={privacyMode} onValueChange={(v) => setPrivacyMode(v as any)}>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-muted/50">
            <RadioGroupItem value="conservative" id="conservative" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="conservative" className="font-medium cursor-pointer">Conservative (Recommended)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Email OR Phone + Zip + Country + External ID + fbp/fbc
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-muted/50">
            <RadioGroupItem value="balanced" id="balanced" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="balanced" className="font-medium cursor-pointer">Balanced</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                + First Name + Last Name + City + State
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-muted/50">
            <RadioGroupItem value="aggressive" id="aggressive" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="aggressive" className="font-medium cursor-pointer">Aggressive</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                + Client IP + User Agent (best match rate)
              </p>
            </div>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Never sends: employer, occupation, street address
        </p>
      </div>

      {/* ActBlue Ownership */}
      <div className="flex items-start space-x-3 rounded-lg border p-4 bg-amber-500/5 border-amber-500/20">
        <Checkbox
          id="actblue-owns"
          checked={actBlueOwnsDonation}
          onCheckedChange={(v) => setActBlueOwnsDonation(!!v)}
        />
        <div className="flex-1">
          <Label htmlFor="actblue-owns" className="font-medium flex items-center gap-2 cursor-pointer">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            ActBlue sends donation events to Meta
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Enable if ActBlue&apos;s CAPI integration is configured. We&apos;ll skip donation events to avoid double-counting.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-2 pt-4 border-t">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={isTesting || (!accessToken && !hasExistingToken)}>
            {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
            Test Connection
          </Button>
          {config?.is_enabled && (
            <Button variant="ghost" onClick={handleDisable} disabled={isSaving} className="text-red-500 hover:text-red-600">
              Disable
            </Button>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving || !pixelId}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {config?.is_enabled ? 'Update Settings' : 'Enable CAPI'}
        </Button>
      </div>
    </div>
  );
}
