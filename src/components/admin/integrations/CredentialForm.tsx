import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Download, Webhook } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IntegrationPlatform, ActBlueCredentialSection } from '@/types/integrations';
import { MetaCredentialAuth } from './MetaCredentialAuth';

// SECURITY: Form state for new credentials (never persisted to state after save)
export type CredentialFormData = {
  meta?: {
    access_token: string;
    ad_account_id: string;
    business_manager_id: string;
  };
  switchboard?: {
    api_key: string;
    account_id: string;
  };
  actblue?: {
    entity_id: string;
    username: string;
    password: string;
    webhook_username: string;
    webhook_password: string;
    webhook_secret: string;
  };
  google_ads?: {
    developer_token: string;
    client_id: string;
    client_secret: string;
    refresh_token: string;
    customer_id: string;
  };
  // Track which sections are being updated for partial saves
  _actblue_section?: ActBlueCredentialSection;
};

interface CredentialFormProps {
  platform: 'meta' | 'switchboard' | 'actblue' | 'google_ads';
  formData: CredentialFormData;
  onFormDataChange: (data: CredentialFormData) => void;
  onPlatformChange: (platform: 'meta' | 'switchboard' | 'actblue' | 'google_ads') => void;
  organizationId?: string;
  disabled?: boolean;
  isEditing?: boolean; // True when editing existing credentials
  existingCredentialMask?: Record<string, string>; // Hints for existing credentials
}

// Secure input component with show/hide toggle
function SecureInput({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder,
  required = false,
  disabled = false,
  existingHint,
}: { 
  id: string; 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  existingHint?: string; // e.g., "****2026" showing last 4 chars
}) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center justify-between">
        <span>
          {label} {required && <span className="text-destructive">*</span>}
        </span>
        {existingHint && (
          <span className="text-xs text-muted-foreground font-normal">
            Current: {existingHint}
          </span>
        )}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showValue ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={existingHint ? `Leave empty to keep existing` : placeholder}
          autoComplete="off"
          className="pr-10"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3"
          onClick={() => setShowValue(!showValue)}
          disabled={disabled}
        >
          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CredentialForm({ 
  platform, 
  formData, 
  onFormDataChange, 
  onPlatformChange,
  organizationId,
  disabled = false,
  isEditing = false,
  existingCredentialMask = {},
}: CredentialFormProps) {
  const [actblueSection, setActblueSection] = useState<ActBlueCredentialSection>('csv');

  const handleMetaOAuthSuccess = (credentials: {
    access_token: string;
    ad_account_id: string;
    business_manager_id?: string;
  }) => {
    onFormDataChange({
      ...formData,
      meta: {
        access_token: credentials.access_token,
        ad_account_id: credentials.ad_account_id,
        business_manager_id: credentials.business_manager_id || '',
      }
    });
  };

  const updateMeta = (field: keyof NonNullable<CredentialFormData['meta']>, value: string) => {
    onFormDataChange({
      ...formData,
      meta: { ...formData.meta!, [field]: value }
    });
  };

  const updateSwitchboard = (field: keyof NonNullable<CredentialFormData['switchboard']>, value: string) => {
    onFormDataChange({
      ...formData,
      switchboard: { ...formData.switchboard!, [field]: value }
    });
  };

  const updateActblue = (field: keyof NonNullable<CredentialFormData['actblue']>, value: string) => {
    onFormDataChange({
      ...formData,
      actblue: { ...formData.actblue!, [field]: value },
      _actblue_section: actblueSection, // Track which section is being edited
    });
  };

  const updateGoogleAds = (field: keyof NonNullable<CredentialFormData['google_ads']>, value: string) => {
    onFormDataChange({
      ...formData,
      google_ads: { ...formData.google_ads!, [field]: value }
    });
  };

  // Handle ActBlue section change
  const handleActblueSectionChange = (section: ActBlueCredentialSection) => {
    setActblueSection(section);
    onFormDataChange({
      ...formData,
      _actblue_section: section,
    });
  };

  return (
    <Tabs value={platform} onValueChange={(v) => onPlatformChange(v as any)}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="meta" disabled={disabled}>Meta</TabsTrigger>
        <TabsTrigger value="switchboard" disabled={disabled}>Switchboard</TabsTrigger>
        <TabsTrigger value="actblue" disabled={disabled}>ActBlue</TabsTrigger>
        <TabsTrigger value="google_ads" disabled={disabled}>Google Ads</TabsTrigger>
      </TabsList>

      <TabsContent value="meta" className="space-y-4 pt-4">
        {organizationId && !disabled ? (
          <MetaCredentialAuth
            organizationId={organizationId}
            onSuccess={handleMetaOAuthSuccess}
            disabled={disabled}
          />
        ) : (
          <>
            {formData.meta?.access_token ? (
              <Alert>
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Meta credentials configured
                    {formData.meta?.ad_account_id && (
                      <span className="text-muted-foreground ml-1">
                        ({formData.meta.ad_account_id})
                      </span>
                    )}
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <SecureInput
                  id="meta_access_token"
                  label="Access Token"
                  value={formData.meta?.access_token || ''}
                  onChange={(v) => updateMeta('access_token', v)}
                  required
                  disabled={disabled}
                  existingHint={existingCredentialMask.access_token}
                />
                <div className="space-y-2">
                  <Label htmlFor="ad_account_id">Ad Account ID</Label>
                  <Input
                    id="ad_account_id"
                    value={formData.meta?.ad_account_id || ''}
                    onChange={(e) => updateMeta('ad_account_id', e.target.value)}
                    placeholder="act_123456789"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_manager_id">Business Manager ID</Label>
                  <Input
                    id="business_manager_id"
                    value={formData.meta?.business_manager_id || ''}
                    onChange={(e) => updateMeta('business_manager_id', e.target.value)}
                    placeholder="Optional"
                    disabled={disabled}
                  />
                </div>
              </>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="switchboard" className="space-y-4 pt-4">
        <SecureInput
          id="switchboard_api_key"
          label="API Key"
          value={formData.switchboard?.api_key || ''}
          onChange={(v) => updateSwitchboard('api_key', v)}
          required
          disabled={disabled}
          existingHint={existingCredentialMask.api_key}
        />
        <div className="space-y-2">
          <Label htmlFor="switchboard_account_id">Account ID</Label>
          <Input
            id="switchboard_account_id"
            value={formData.switchboard?.account_id || ''}
            onChange={(e) => updateSwitchboard('account_id', e.target.value)}
            disabled={disabled}
          />
        </div>
      </TabsContent>

      <TabsContent value="actblue" className="space-y-4 pt-4">
        {/* Nested tabs for CSV API vs Webhook */}
        <Tabs value={actblueSection} onValueChange={(v) => handleActblueSectionChange(v as ActBlueCredentialSection)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="csv" disabled={disabled} className="gap-2">
              <Download className="h-4 w-4" />
              CSV API
            </TabsTrigger>
            <TabsTrigger value="webhook" disabled={disabled} className="gap-2">
              <Webhook className="h-4 w-4" />
              Webhook
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-4">
            {isEditing && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Only fill in fields you want to update. Leave empty to keep existing values.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="actblue_entity_id">Entity ID</Label>
              <Input
                id="actblue_entity_id"
                value={formData.actblue?.entity_id || ''}
                onChange={(e) => updateActblue('entity_id', e.target.value)}
                placeholder={existingCredentialMask.entity_id || "Your ActBlue entity ID"}
                disabled={disabled}
              />
              {existingCredentialMask.entity_id && (
                <p className="text-xs text-muted-foreground">Current: {existingCredentialMask.entity_id}</p>
              )}
            </div>
            <SecureInput
              id="actblue_username"
              label="API Username"
              value={formData.actblue?.username || ''}
              onChange={(v) => updateActblue('username', v)}
              disabled={disabled}
              existingHint={existingCredentialMask.username}
            />
            <SecureInput
              id="actblue_password"
              label="API Password"
              value={formData.actblue?.password || ''}
              onChange={(v) => updateActblue('password', v)}
              disabled={disabled}
              existingHint={existingCredentialMask.password}
            />
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4">
            {isEditing && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Only fill in fields you want to update. Leave empty to keep existing values.
                </AlertDescription>
              </Alert>
            )}
            
            <SecureInput
              id="actblue_webhook_username"
              label="Webhook Username"
              value={formData.actblue?.webhook_username || ''}
              onChange={(v) => updateActblue('webhook_username', v)}
              disabled={disabled}
              existingHint={existingCredentialMask.webhook_username}
            />
            <SecureInput
              id="actblue_webhook_password"
              label="Webhook Password"
              value={formData.actblue?.webhook_password || ''}
              onChange={(v) => updateActblue('webhook_password', v)}
              disabled={disabled}
              existingHint={existingCredentialMask.webhook_password}
            />
            <SecureInput
              id="actblue_webhook_secret"
              label="Webhook Secret (HMAC)"
              value={formData.actblue?.webhook_secret || ''}
              onChange={(v) => updateActblue('webhook_secret', v)}
              placeholder="For signature validation"
              disabled={disabled}
              existingHint={existingCredentialMask.webhook_secret}
            />
            
            <Alert className="bg-muted/50">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                The webhook secret is used to validate incoming webhooks via HMAC signature.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="google_ads" className="space-y-4 pt-4">
        <SecureInput
          id="google_developer_token"
          label="Developer Token"
          value={formData.google_ads?.developer_token || ''}
          onChange={(v) => updateGoogleAds('developer_token', v)}
          required
          disabled={disabled}
          existingHint={existingCredentialMask.developer_token}
        />
        <div className="space-y-2">
          <Label htmlFor="google_client_id">Client ID</Label>
          <Input
            id="google_client_id"
            value={formData.google_ads?.client_id || ''}
            onChange={(e) => updateGoogleAds('client_id', e.target.value)}
            disabled={disabled}
          />
        </div>
        <SecureInput
          id="google_client_secret"
          label="Client Secret"
          value={formData.google_ads?.client_secret || ''}
          onChange={(v) => updateGoogleAds('client_secret', v)}
          disabled={disabled}
          existingHint={existingCredentialMask.client_secret}
        />
        <SecureInput
          id="google_refresh_token"
          label="Refresh Token"
          value={formData.google_ads?.refresh_token || ''}
          onChange={(v) => updateGoogleAds('refresh_token', v)}
          disabled={disabled}
          existingHint={existingCredentialMask.refresh_token}
        />
        <div className="space-y-2">
          <Label htmlFor="google_customer_id">Customer ID</Label>
          <Input
            id="google_customer_id"
            value={formData.google_ads?.customer_id || ''}
            onChange={(e) => updateGoogleAds('customer_id', e.target.value)}
            placeholder="123-456-7890"
            disabled={disabled}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
