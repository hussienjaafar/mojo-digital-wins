import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Play, Loader2, Trash2, Activity, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CredentialForm, CredentialFormData } from './CredentialForm';
import { IntegrationHealthPanel } from './IntegrationHealthPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
}

interface CredentialSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCredentialId?: string | null;
  preselectedOrgId?: string | null;
  onSuccess?: () => void;
}

export function CredentialSlideOver({
  open,
  onOpenChange,
  editingCredentialId,
  preselectedOrgId,
  onSuccess,
}: CredentialSlideOverProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [platform, setPlatform] = useState<'meta' | 'switchboard' | 'actblue' | 'google_ads'>('meta');
  const [formData, setFormData] = useState<CredentialFormData>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [existingCredential, setExistingCredential] = useState<any>(null);

  // Fetch organizations on mount
  useEffect(() => {
    if (open) {
      fetchOrganizations();
    }
  }, [open]);

  // Set preselected org when provided
  useEffect(() => {
    if (preselectedOrgId && open) {
      setSelectedOrg(preselectedOrgId);
    }
  }, [preselectedOrgId, open]);

  // Load existing credential when editing
  useEffect(() => {
    if (editingCredentialId && open) {
      loadCredential(editingCredentialId);
    }
  }, [editingCredentialId, open]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      toast.error('Failed to load organizations');
    }
  };

  const loadCredential = async (id: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_api_credentials')
        .select(`
          id, 
          organization_id, 
          platform, 
          is_active,
          credential_mask,
          last_tested_at,
          last_test_status,
          last_test_error,
          last_sync_at,
          last_sync_status,
          last_sync_error
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setExistingCredential(data);
        setSelectedOrg(data.organization_id);
        setPlatform(data.platform as any);
        // SECURITY: Don't populate form with existing credentials
        // User must re-enter all credentials when editing
        setFormData({});
      }
    } catch (err) {
      console.error('Failed to load credential:', err);
      toast.error('Failed to load credential details');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedOrg('');
    setPlatform('meta');
    setFormData({});
    setExistingCredential(null);
  };

  const validateForm = (): boolean => {
    if (!selectedOrg) {
      toast.error('Please select an organization');
      return false;
    }

    const platformData = formData[platform];
    
    // When editing existing credentials, allow partial updates (at least one field filled)
    if (existingCredential) {
      if (!platformData) {
        toast.error('Please fill in at least one credential field to update');
        return false;
      }
      
      // Check if at least one field has a value
      const hasAnyValue = Object.values(platformData).some(
        v => v && typeof v === 'string' && v.trim() !== ''
      );
      
      if (!hasAnyValue) {
        toast.error('Please fill in at least one credential field to update');
        return false;
      }
      
      return true;
    }
    
    // For new credentials, require full validation
    if (!platformData) {
      toast.error('Please fill in the credentials');
      return false;
    }

    // Platform-specific validation for new credentials
    if (platform === 'meta' && !formData.meta?.access_token) {
      toast.error('Meta access token is required');
      return false;
    }

    if (platform === 'switchboard' && !formData.switchboard?.api_key) {
      toast.error('Switchboard API key is required');
      return false;
    }

    if (platform === 'actblue') {
      // For new ActBlue credentials, require at least CSV or webhook to be complete
      const csvComplete = formData.actblue?.entity_id && 
                          formData.actblue?.username && 
                          formData.actblue?.password;
      const webhookComplete = formData.actblue?.webhook_username && 
                              formData.actblue?.webhook_password;
      
      if (!csvComplete && !webhookComplete) {
        toast.error('Please complete either CSV API credentials or Webhook credentials');
        return false;
      }
    }

    if (platform === 'google_ads' && !formData.google_ads?.developer_token) {
      toast.error('Google Ads developer token is required');
      return false;
    }

    return true;
  };

  const handleTest = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    try {
      const endpoints: Record<string, string> = {
        meta: 'admin-sync-meta',
        switchboard: 'sync-switchboard-sms',
        actblue: 'sync-actblue-csv',
        google_ads: 'sync-google-ads',
      };

      const { data, error } = await supabase.functions.invoke(endpoints[platform], {
        body: {
          organization_id: selectedOrg,
          test_only: true,
          credentials: formData[platform],
        },
      });

      if (error) throw error;

      toast.success(`${platform} credentials are valid. You can now save them.`);
    } catch (err: any) {
      toast.error(err.message || `Unable to verify ${platform} credentials`);
    } finally {
      setIsTesting(false);
    }
  };

  // Map ActBlue form fields to database field names
  const mapActBlueCredentials = (formCreds: Record<string, string>): Record<string, string> => {
    const mapped: Record<string, string> = {};
    
    // CSV API credentials (keep same names)
    if (formCreds.entity_id?.trim()) mapped.entity_id = formCreds.entity_id.trim();
    if (formCreds.username?.trim()) mapped.username = formCreds.username.trim();
    if (formCreds.password?.trim()) mapped.password = formCreds.password.trim();
    
    // Webhook credentials (map to expected database names)
    if (formCreds.webhook_username?.trim()) mapped.basic_auth_username = formCreds.webhook_username.trim();
    if (formCreds.webhook_password?.trim()) mapped.basic_auth_password = formCreds.webhook_password.trim();
    if (formCreds.webhook_secret?.trim()) mapped.webhook_secret = formCreds.webhook_secret.trim();
    
    return mapped;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // For partial updates, merge with existing credentials
      let credentialsToSave: any = formData[platform];
      
      if (existingCredential) {
        // Fetch existing encrypted credentials to merge
        const { data: existingData, error: fetchError } = await supabase
          .from('client_api_credentials')
          .select('encrypted_credentials')
          .eq('id', existingCredential.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Merge: only overwrite fields that have non-empty values in the form
        const existingCreds = (existingData?.encrypted_credentials as Record<string, string>) || {};
        let newCreds = (formData[platform] as Record<string, string>) || {};
        
        // Map ActBlue form fields to database field names
        if (platform === 'actblue') {
          newCreds = mapActBlueCredentials(newCreds);
        } else {
          // Filter out empty values for other platforms
          newCreds = Object.fromEntries(
            Object.entries(newCreds).filter(([_, value]) => 
              value && typeof value === 'string' && value.trim() !== ''
            )
          );
        }
        
        credentialsToSave = {
          ...existingCreds,
          ...newCreds,
        };
      } else {
        // New credential - apply mapping for ActBlue
        if (platform === 'actblue') {
          credentialsToSave = mapActBlueCredentials(credentialsToSave || {});
        }
      }
      
      const { error } = await supabase
        .from('client_api_credentials')
        .upsert([{
          organization_id: selectedOrg,
          platform: platform,
          encrypted_credentials: credentialsToSave,
          is_active: true,
        }], {
          onConflict: 'organization_id,platform'
        });

      if (error) throw error;

      toast.success(existingCredential ? 'Credentials updated securely' : 'Credentials saved securely');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCredential) return;

    try {
      const { error } = await supabase
        .from('client_api_credentials')
        .delete()
        .eq('id', existingCredential.id);

      if (error) throw error;

      toast.success('Credentials deleted');
      setShowDeleteDialog(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete credentials');
    }
  };

  const selectedOrgName = organizations.find(o => o.id === selectedOrg)?.name;

  const [activeTab, setActiveTab] = useState<'credentials' | 'diagnostics'>('credentials');

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--portal-success))]" />
              {existingCredential ? 'Update' : 'Add'} Integration
            </SheetTitle>
            <SheetDescription>
              {existingCredential 
                ? 'View integration health and update credentials as needed.' 
                : 'Credentials are encrypted before storage and never displayed after saving.'}
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : existingCredential ? (
            <div className="py-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'credentials' | 'diagnostics')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="diagnostics" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Diagnostics
                  </TabsTrigger>
                  <TabsTrigger value="credentials" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Update Credentials
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="diagnostics" className="mt-4">
                  <IntegrationHealthPanel
                    organizationId={selectedOrg}
                    platform={platform}
                    onUpdateCredentials={() => setActiveTab('credentials')}
                  />
                </TabsContent>
                
                <TabsContent value="credentials" className="mt-4 space-y-6">
                  {/* Organization (read-only when editing) */}
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Select 
                      value={selectedOrg} 
                      onValueChange={setSelectedOrg}
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Credentials Form */}
                  <div className="space-y-2">
                    <Label>Update {platform.charAt(0).toUpperCase() + platform.slice(1)} Credentials</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Leave fields empty to keep existing values. Only fill in fields you want to change.
                    </p>
                    <CredentialForm
                      platform={platform}
                      formData={formData}
                      onFormDataChange={setFormData}
                      onPlatformChange={setPlatform}
                      organizationId={selectedOrg}
                      disabled={false}
                      isEditing={true}
                      existingCredentialMask={(existingCredential?.credential_mask as Record<string, string>) || {}}
                      credentialStatus={{
                        lastTestedAt: existingCredential?.last_tested_at,
                        lastTestStatus: existingCredential?.last_test_status,
                        lastTestError: existingCredential?.last_test_error,
                        lastSyncAt: existingCredential?.last_sync_at,
                        lastSyncStatus: existingCredential?.last_sync_status,
                        lastSyncError: existingCredential?.last_sync_error,
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {/* Organization Selection */}
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select 
                  value={selectedOrg} 
                  onValueChange={setSelectedOrg}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Platform & Credentials Form */}
              <div className="space-y-2">
                <Label>Platform & Credentials</Label>
                <CredentialForm
                  platform={platform}
                  formData={formData}
                  onFormDataChange={setFormData}
                  onPlatformChange={setPlatform}
                  organizationId={selectedOrg}
                  disabled={false}
                />
              </div>
            </div>
          )}

          <SheetFooter className="flex-col gap-2 sm:flex-row">
            {existingCredential && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            {(activeTab === 'credentials' || !existingCredential) && (
              <>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || isSaving}
                  className="w-full sm:w-auto"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isTesting || isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  {existingCredential ? 'Update' : 'Save'} Securely
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {platform} credentials for {selectedOrgName}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
