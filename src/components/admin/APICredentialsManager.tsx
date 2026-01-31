import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { V3Button } from "@/components/v3/V3Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, CheckCircle2, XCircle, RefreshCw, Settings, Pencil, Trash2, Play, Loader2, AlertTriangle, MoreVertical, ChevronDown, ChevronRight, Search, Clock, Zap, Command, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminPageHeader, AdminLoadingState } from "./v3";

type Organization = {
  id: string;
  name: string;
};

type APICredential = {
  id: string;
  organization_id: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
  // SECURITY: Never store or display raw credentials
  has_credentials: boolean;
};

// SECURITY: Form state for new credentials (never persisted to state after save)
type CredentialFormData = {
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
    webhook_secret: string; // SECURITY: Required for HMAC validation
  };
};

const APICredentialsManager = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [credentials, setCredentials] = useState<APICredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'switchboard' | 'actblue'>('meta');
  const [formData, setFormData] = useState<CredentialFormData>({});
  const [editingCredential, setEditingCredential] = useState<APICredential | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [deleteCredential, setDeleteCredential] = useState<APICredential | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showCreateDialog) {
          handleCloseDialog();
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !showCreateDialog) {
        e.preventDefault();
        setShowCreateDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateDialog, searchQuery]);

  useEffect(() => {
    if (organizations.length > 0) {
      setExpandedOrgs(new Set(organizations.map(o => o.id)));
    }
  }, [organizations]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // SECURITY: Only fetch metadata, never raw credentials
      const { data: credsData, error: credsError } = await (supabase as any)
        .from('client_api_credentials')
        .select('id, organization_id, platform, is_active, last_sync_at, last_sync_status, created_at')
        .order('created_at', { ascending: false });

      if (credsError) throw credsError;
      
      // Mark as having credentials without exposing them
      setCredentials((credsData || []).map((cred: any) => ({
        ...cred,
        has_credentials: true,
      })));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const credentialsByOrg = useMemo(() => {
    const grouped: Record<string, APICredential[]> = {};
    credentials.forEach(cred => {
      if (!grouped[cred.organization_id]) {
        grouped[cred.organization_id] = [];
      }
      grouped[cred.organization_id].push(cred);
    });
    return grouped;
  }, [credentials]);

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery) return organizations;
    const query = searchQuery.toLowerCase();
    return organizations.filter(org => 
      org.name.toLowerCase().includes(query) ||
      credentialsByOrg[org.id]?.some(c => c.platform.toLowerCase().includes(query))
    );
  }, [organizations, searchQuery, credentialsByOrg]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrg || !selectedPlatform) {
      toast({
        title: "Error",
        description: "Please select an organization and platform",
        variant: "destructive",
      });
      return;
    }

    const platformData = formData[selectedPlatform];
    if (!platformData) {
      toast({
        title: "Error",
        description: "Please fill in the credentials",
        variant: "destructive",
      });
      return;
    }

    // SECURITY: Validate ActBlue has webhook_secret
    if (selectedPlatform === 'actblue' && !formData.actblue?.webhook_secret) {
      toast({
        title: "Security Error",
        description: "ActBlue webhook secret is required for secure webhook validation",
        variant: "destructive",
      });
      return;
    }

    try {
      // SECURITY: Send credentials to server for storage
      // Server will encrypt before storing
      const { error } = await (supabase as any)
        .from('client_api_credentials')
        .upsert([{
          organization_id: selectedOrg,
          platform: selectedPlatform,
          encrypted_credentials: platformData,
          is_active: true,
        }], {
          onConflict: 'organization_id,platform'
        });

      if (error) throw error;

      // Auto-trigger historical backfill for ActBlue when credentials are saved
      if (selectedPlatform === 'actblue') {
        try {
          const { error: backfillError } = await supabase.functions.invoke('backfill-actblue-csv-orchestrator', {
            body: {
              organization_id: selectedOrg,
              days_back: 365,
              start_immediately: true
            }
          });
          
          if (!backfillError) {
            toast({
              title: "Historical Import Started",
              description: "ActBlue transaction history is being imported in the background. This may take 30-45 minutes.",
            });
          }
        } catch (e) {
          console.error('Failed to trigger ActBlue backfill:', e);
          // Non-blocking - don't fail the credential save
        }
      }

      toast({
        title: "Success",
        description: editingCredential ? "API credentials updated" : "API credentials saved securely",
      });

      handleCloseDialog();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingCredential(null);
    // SECURITY: Clear form data immediately
    setFormData({});
    setSelectedOrg("");
    setSelectedPlatform('meta');
    setShowSecrets({});
  };

  const handleEditCredential = (cred: APICredential) => {
    setEditingCredential(cred);
    setSelectedOrg(cred.organization_id);
    setSelectedPlatform(cred.platform as any);
    // SECURITY: Don't populate form with existing credentials
    // User must re-enter all credentials when editing
    setFormData({});
    setShowCreateDialog(true);
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('client_api_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Credentials deleted successfully",
      });

      setDeleteCredential(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete credentials",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (cred: APICredential) => {
    setTestingId(cred.id);
    
    try {
      let endpoint = '';
      switch (cred.platform) {
        case 'meta':
          endpoint = 'admin-sync-meta';
          break;
        case 'switchboard':
          endpoint = 'sync-switchboard-sms';
          break;
        case 'actblue':
          endpoint = 'sync-actblue-csv';
          break;
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { 
          organization_id: cred.organization_id,
          test_only: true 
        }
      });

      if (error) throw error;

      toast({
        title: "Connection Successful",
        description: `${cred.platform} API connection is working`,
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || `Unable to connect to ${cred.platform} API`,
        variant: "destructive",
      });
    } finally {
      setTestingId(null);
    }
  };

  const testFormConnection = async () => {
    if (!selectedOrg || !selectedPlatform || !formData[selectedPlatform]) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before testing",
        variant: "destructive",
      });
      return;
    }

    setTestingForm(true);
    
    try {
      let endpoint = '';
      switch (selectedPlatform) {
        case 'meta':
          endpoint = 'admin-sync-meta';
          break;
        case 'switchboard':
          endpoint = 'sync-switchboard-sms';
          break;
        case 'actblue':
          endpoint = 'sync-actblue-csv';
          break;
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { 
          organization_id: selectedOrg,
          test_only: true,
          credentials: formData[selectedPlatform]
        }
      });

      if (error) throw error;

      toast({
        title: "Connection Successful",
        description: `${selectedPlatform} credentials are valid. You can now save them.`,
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || `Unable to verify ${selectedPlatform} credentials`,
        variant: "destructive",
      });
    } finally {
      setTestingForm(false);
    }
  };

  const triggerSync = async (cred: APICredential) => {
    setSyncingId(cred.id);
    
    try {
      let endpoint = '';
      switch (cred.platform) {
        case 'meta':
          endpoint = 'admin-sync-meta';
          break;
        case 'switchboard':
          endpoint = 'sync-switchboard-sms';
          break;
        case 'actblue':
          endpoint = 'sync-actblue-csv';
          break;
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { organization_id: cred.organization_id }
      });

      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: data?.message || `${cred.platform} data synced successfully`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || `Failed to sync ${cred.platform} data`,
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean, credential?: APICredential) => {
    try {
      const { error } = await (supabase as any)
        .from('client_api_credentials')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      // Auto-trigger historical backfill when ActBlue is activated
      if (!currentStatus && credential?.platform === 'actblue') {
        try {
          const { error: backfillError } = await supabase.functions.invoke('backfill-actblue-csv-orchestrator', {
            body: {
              organization_id: credential.organization_id,
              days_back: 365,
              start_immediately: true
            }
          });
          
          if (!backfillError) {
            toast({
              title: "Historical Import Started",
              description: "ActBlue transaction history is being imported in the background.",
            });
          }
        } catch (e) {
          console.error('Failed to trigger ActBlue backfill:', e);
        }
      }

      toast({
        title: "Success",
        description: `Credentials ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    }
  };

  const getOrganizationName = (orgId: string) => {
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      meta: "📘",
      switchboard: "📱",
      actblue: "💙",
    };
    return icons[platform] || "🔑";
  };

  const getHealthStatus = (cred: APICredential) => {
    if (!cred.is_active) return { status: 'inactive', color: 'bg-muted', label: 'Inactive' };
    if (cred.last_sync_status === 'error') return { status: 'error', color: 'bg-destructive', label: 'Error' };
    if (!cred.last_sync_at) return { status: 'pending', color: 'bg-yellow-500', label: 'Never Synced' };
    
    const lastSync = new Date(cred.last_sync_at);
    const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo > 24) return { status: 'stale', color: 'bg-yellow-500', label: 'Stale' };
    return { status: 'healthy', color: 'bg-green-500', label: 'Healthy' };
  };

  const getOrgHealth = (orgId: string) => {
    const orgCreds = credentialsByOrg[orgId] || [];
    if (orgCreds.length === 0) return { status: 'none', color: 'text-muted-foreground' };
    
    const hasError = orgCreds.some(c => c.last_sync_status === 'error');
    const allHealthy = orgCreds.every(c => c.is_active && c.last_sync_status === 'success');
    
    if (hasError) return { status: 'error', color: 'text-destructive' };
    if (allHealthy) return { status: 'healthy', color: 'text-green-600' };
    return { status: 'warning', color: 'text-yellow-600' };
  };

  const toggleOrgExpanded = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Secure input component
  const SecureInput = ({ 
    id, 
    label, 
    value, 
    onChange, 
    placeholder,
    required = false 
  }: { 
    id: string; 
    label: string; 
    value: string; 
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showSecrets[id] ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-10"
        />
        <V3Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-0 top-0 h-full px-3"
          onClick={() => toggleSecretVisibility(id)}
        >
          {showSecrets[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </V3Button>
      </div>
    </div>
  );

  const CredentialCard = ({ cred }: { cred: APICredential }) => {
    const health = getHealthStatus(cred);
    
    return (
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${health.color}`} title={health.label} />
          <span className="text-lg">{getPlatformIcon(cred.platform)}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium capitalize">{cred.platform}</p>
              <span title="Credentials stored securely">
                <ShieldCheck className="h-3 w-3 text-green-600" />
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {cred.last_sync_at 
                ? new Date(cred.last_sync_at).toLocaleDateString() 
                : 'Never synced'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <V3Button
            size="sm"
            onClick={() => triggerSync(cred)}
            isLoading={syncingId === cred.id}
            disabled={!cred.is_active}
          >
            <Zap className="w-3 h-3" />
            Sync
          </V3Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <V3Button variant="ghost" size="icon-sm">
                <MoreVertical className="h-4 w-4" />
              </V3Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => testConnection(cred)} disabled={testingId === cred.id}>
                {testingId === cred.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditCredential(cred)}>
                <Pencil className="mr-2 h-4 w-4" />
                Update Credentials
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleActive(cred.id, cred.is_active, cred)}>
                {cred.is_active ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteCredential(cred)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Credentials
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Credentials are encrypted and never displayed after saving
            </CardDescription>
          </div>
          <V3Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add Credentials
          </V3Button>
        </div>
        
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search organizations or platforms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {filteredOrganizations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No organizations found</p>
          </div>
        ) : (
          filteredOrganizations.map(org => {
            const orgCreds = credentialsByOrg[org.id] || [];
            const orgHealth = getOrgHealth(org.id);
            const isExpanded = expandedOrgs.has(org.id);

            return (
              <Collapsible key={org.id} open={isExpanded} onOpenChange={() => toggleOrgExpanded(org.id)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{org.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {orgCreds.length} connection{orgCreds.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className={`text-sm ${orgHealth.color}`}>
                      {orgHealth.status === 'healthy' && <CheckCircle2 className="h-4 w-4" />}
                      {orgHealth.status === 'error' && <XCircle className="h-4 w-4" />}
                      {orgHealth.status === 'warning' && <AlertTriangle className="h-4 w-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-8 pr-3 py-3 space-y-2">
                    {orgCreds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No credentials configured</p>
                    ) : (
                      orgCreds.map(cred => (
                        <CredentialCard key={cred.id} cred={cred} />
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              {editingCredential ? 'Update' : 'Add'} API Credentials
            </DialogTitle>
            <DialogDescription>
              Credentials are encrypted before storage and never displayed after saving.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="meta">Meta Ads</TabsTrigger>
                  <TabsTrigger value="switchboard">Switchboard</TabsTrigger>
                  <TabsTrigger value="actblue">ActBlue</TabsTrigger>
                </TabsList>

                <TabsContent value="meta" className="space-y-4 pt-4">
                  <SecureInput
                    id="meta_access_token"
                    label="Access Token"
                    value={formData.meta?.access_token || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, meta: { ...prev.meta!, access_token: v } }))}
                    required
                  />
                  <div className="space-y-2">
                    <Label htmlFor="ad_account_id">Ad Account ID</Label>
                    <Input
                      id="ad_account_id"
                      value={formData.meta?.ad_account_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta: { ...prev.meta!, ad_account_id: e.target.value } }))}
                      placeholder="act_123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_manager_id">Business Manager ID</Label>
                    <Input
                      id="business_manager_id"
                      value={formData.meta?.business_manager_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta: { ...prev.meta!, business_manager_id: e.target.value } }))}
                      placeholder="Optional"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="switchboard" className="space-y-4 pt-4">
                  <SecureInput
                    id="switchboard_api_key"
                    label="API Key"
                    value={formData.switchboard?.api_key || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, switchboard: { ...prev.switchboard!, api_key: v } }))}
                    required
                  />
                  <div className="space-y-2">
                    <Label htmlFor="switchboard_account_id">Account ID</Label>
                    <Input
                      id="switchboard_account_id"
                      value={formData.switchboard?.account_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, switchboard: { ...prev.switchboard!, account_id: e.target.value } }))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="actblue" className="space-y-4 pt-4">
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      The webhook secret is used to validate incoming webhooks via HMAC signature.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Label htmlFor="actblue_entity_id">Entity ID</Label>
                    <Input
                      id="actblue_entity_id"
                      value={formData.actblue?.entity_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, entity_id: e.target.value } }))}
                      placeholder="Your ActBlue entity ID"
                    />
                  </div>
                  <SecureInput
                    id="actblue_username"
                    label="API Username"
                    value={formData.actblue?.username || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, username: v } }))}
                  />
                  <SecureInput
                    id="actblue_password"
                    label="API Password"
                    value={formData.actblue?.password || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, password: v } }))}
                  />
                  <SecureInput
                    id="actblue_webhook_username"
                    label="Webhook Username"
                    value={formData.actblue?.webhook_username || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, webhook_username: v } }))}
                  />
                  <SecureInput
                    id="actblue_webhook_password"
                    label="Webhook Password"
                    value={formData.actblue?.webhook_password || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, webhook_password: v } }))}
                  />
                  <SecureInput
                    id="actblue_webhook_secret"
                    label="Webhook Secret (HMAC)"
                    value={formData.actblue?.webhook_secret || ''}
                    onChange={(v) => setFormData(prev => ({ ...prev, actblue: { ...prev.actblue!, webhook_secret: v } }))}
                    placeholder="For signature validation"
                    required
                  />
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="gap-2">
              <V3Button type="button" variant="secondary" onClick={testFormConnection} isLoading={testingForm}>
                <Play className="h-4 w-4" />
                Test
              </V3Button>
              <V3Button type="submit">
                <ShieldCheck className="h-4 w-4" />
                {editingCredential ? 'Update' : 'Save'} Securely
              </V3Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCredential} onOpenChange={(open) => !open && setDeleteCredential(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {deleteCredential?.platform} credentials for {getOrganizationName(deleteCredential?.organization_id || '')}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteCredential && handleDeleteCredential(deleteCredential.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default APICredentialsManager;
