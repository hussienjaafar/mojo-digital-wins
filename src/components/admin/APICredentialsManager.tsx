import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, CheckCircle2, XCircle, RefreshCw, Settings, Pencil, Trash2, Play, Loader2, AlertTriangle, MoreVertical, ChevronDown, ChevronRight, Search, Clock, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";

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
  encrypted_credentials?: any;
};

type PlatformConfig = {
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
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({});
  const [editingCredential, setEditingCredential] = useState<APICredential | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [deleteCredential, setDeleteCredential] = useState<APICredential | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Expand all organizations by default when data loads
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

      const { data: credsData, error: credsError } = await (supabase as any)
        .from('client_api_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (credsError) throw credsError;
      setCredentials(credsData || []);
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

  // Group credentials by organization
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

  // Filter organizations based on search
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

    try {
      const { error } = await (supabase as any)
        .from('client_api_credentials')
        .upsert([{
          organization_id: selectedOrg,
          platform: selectedPlatform,
          encrypted_credentials: platformConfig[selectedPlatform],
          is_active: true,
        }], {
          onConflict: 'organization_id,platform'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: editingCredential ? "API credentials updated" : "API credentials saved",
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
    setPlatformConfig({});
    setSelectedOrg("");
    setSelectedPlatform('meta');
  };

  const handleEditCredential = (cred: APICredential) => {
    setEditingCredential(cred);
    setSelectedOrg(cred.organization_id);
    setSelectedPlatform(cred.platform as any);
    
    if (cred.encrypted_credentials) {
      setPlatformConfig({
        [cred.platform]: cred.encrypted_credentials
      } as PlatformConfig);
    }
    
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

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('client_api_credentials')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

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

  // Credential card for mobile and grouped view
  const CredentialCard = ({ cred }: { cred: APICredential }) => {
    const health = getHealthStatus(cred);
    
    return (
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${health.color}`} title={health.label} />
          <span className="text-lg">{getPlatformIcon(cred.platform)}</span>
          <div>
            <p className="font-medium capitalize">{cred.platform}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {cred.last_sync_at 
                ? new Date(cred.last_sync_at).toLocaleDateString() 
                : 'Never synced'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Primary action: Sync */}
          <Button
            size="sm"
            variant="default"
            onClick={() => triggerSync(cred)}
            disabled={syncingId === cred.id || !cred.is_active}
            className="h-8"
          >
            {syncingId === cred.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            <span className="ml-1">Sync</span>
          </Button>
          
          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => testConnection(cred)} disabled={testingId === cred.id}>
                <RefreshCw className={`h-4 w-4 mr-2 ${testingId === cred.id ? 'animate-spin' : ''}`} />
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditCredential(cred)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Credentials
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggleActive(cred.id, cred.is_active)}>
                {cred.is_active ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteCredential(cred)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
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
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
            <Settings className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">API Credentials</h2>
            <p className="text-sm text-muted-foreground">Loading platform connections...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Credentials
            </CardTitle>
            <CardDescription>
              Manage API credentials for Meta, Switchboard, and ActBlue
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            if (!open) handleCloseDialog();
            else setShowCreateDialog(true);
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Credentials
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCredential ? 'Edit API Credentials' : 'Configure API Credentials'}
                </DialogTitle>
                <DialogDescription>
                  {editingCredential 
                    ? 'Update API credentials for this integration' 
                    : 'Add or update API credentials for a client organization'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization *</Label>
                  <Select 
                    value={selectedOrg} 
                    onValueChange={setSelectedOrg} 
                    disabled={!!editingCredential}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs 
                  value={selectedPlatform} 
                  onValueChange={(v) => setSelectedPlatform(v as any)}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="meta" disabled={!!editingCredential && editingCredential.platform !== 'meta'}>
                      Meta Ads
                    </TabsTrigger>
                    <TabsTrigger value="switchboard" disabled={!!editingCredential && editingCredential.platform !== 'switchboard'}>
                      Switchboard
                    </TabsTrigger>
                    <TabsTrigger value="actblue" disabled={!!editingCredential && editingCredential.platform !== 'actblue'}>
                      ActBlue
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="meta" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="meta_access_token">Access Token *</Label>
                      <Input
                        id="meta_access_token"
                        type="password"
                        value={platformConfig.meta?.access_token || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          meta: { ...platformConfig.meta!, access_token: e.target.value }
                        })}
                        placeholder="Long-lived User Access Token"
                        required={selectedPlatform === 'meta'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ad_account_id">Ad Account ID *</Label>
                      <Input
                        id="ad_account_id"
                        value={platformConfig.meta?.ad_account_id || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          meta: { ...platformConfig.meta!, ad_account_id: e.target.value }
                        })}
                        placeholder="act_123456789"
                        required={selectedPlatform === 'meta'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business_manager_id">Business Manager ID</Label>
                      <Input
                        id="business_manager_id"
                        value={platformConfig.meta?.business_manager_id || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          meta: { ...platformConfig.meta!, business_manager_id: e.target.value }
                        })}
                        placeholder="123456789"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="switchboard" className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground mb-4">
                      <p className="font-medium mb-1">Switchboard Credentials:</p>
                      <p>Find these in your Switchboard dashboard under Settings → API.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="switchboard_api_key">Token *</Label>
                      <Input
                        id="switchboard_api_key"
                        type="password"
                        value={platformConfig.switchboard?.api_key || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          switchboard: { ...platformConfig.switchboard!, api_key: e.target.value }
                        })}
                        placeholder="d58a7a264232412794cf2a42b379514e"
                        required={selectedPlatform === 'switchboard'}
                      />
                      <p className="text-xs text-muted-foreground">Your Switchboard API token</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_id">Account ID *</Label>
                      <Input
                        id="account_id"
                        value={platformConfig.switchboard?.account_id || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          switchboard: { ...platformConfig.switchboard!, account_id: e.target.value }
                        })}
                        placeholder="ac_01kbnytb9sd619s7nv7r7x4r10"
                        required={selectedPlatform === 'switchboard'}
                      />
                      <p className="text-xs text-muted-foreground">Format: ac_xxxx</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="actblue" className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground mb-4">
                      <p className="font-medium mb-1">Setup Instructions:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Find your Entity ID in ActBlue Dashboard → Integrations → Webhooks</li>
                        <li>Create CSV API credentials in ActBlue Dashboard → API Keys</li>
                        <li>Create a webhook with your chosen username/password</li>
                        <li>Enter all credentials below</li>
                      </ol>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="entity_id">Entity ID *</Label>
                      <Input
                        id="entity_id"
                        value={platformConfig.actblue?.entity_id || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          actblue: { ...platformConfig.actblue!, entity_id: e.target.value }
                        })}
                        placeholder="12345"
                        required={selectedPlatform === 'actblue'}
                      />
                      <p className="text-xs text-muted-foreground">Found on ActBlue's Webhook Integrations page</p>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium mb-3">CSV API Credentials (for data sync)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="csv_username">Client UUID *</Label>
                          <Input
                            id="csv_username"
                            value={platformConfig.actblue?.username || ''}
                            onChange={(e) => setPlatformConfig({
                              ...platformConfig,
                              actblue: { ...platformConfig.actblue!, username: e.target.value }
                            })}
                            placeholder="b2ec7394-ae72-439a-a68c-eba35648e631"
                            required={selectedPlatform === 'actblue'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="csv_password">Client Secret *</Label>
                          <Input
                            id="csv_password"
                            type="password"
                            value={platformConfig.actblue?.password || ''}
                            onChange={(e) => setPlatformConfig({
                              ...platformConfig,
                              actblue: { ...platformConfig.actblue!, password: e.target.value }
                            })}
                            placeholder="Your client secret"
                            required={selectedPlatform === 'actblue'}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">From ActBlue Dashboard → CSV API Settings</p>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium mb-3">Webhook Credentials (for real-time updates)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="webhook_username">Webhook Username *</Label>
                          <Input
                            id="webhook_username"
                            value={platformConfig.actblue?.webhook_username || ''}
                            onChange={(e) => setPlatformConfig({
                              ...platformConfig,
                              actblue: { ...platformConfig.actblue!, webhook_username: e.target.value }
                            })}
                            placeholder="webhook-user"
                            required={selectedPlatform === 'actblue'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="webhook_password">Webhook Password *</Label>
                          <Input
                            id="webhook_password"
                            type="password"
                            value={platformConfig.actblue?.webhook_password || ''}
                            onChange={(e) => setPlatformConfig({
                              ...platformConfig,
                              actblue: { ...platformConfig.actblue!, webhook_password: e.target.value }
                            })}
                            placeholder="webhook-password"
                            required={selectedPlatform === 'actblue'}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        The username/password you entered when creating the webhook in ActBlue
                      </p>
                      <div className="mt-3 p-2 bg-primary/5 rounded text-xs">
                        <span className="font-medium">Webhook URL:</span>{' '}
                        <code className="bg-muted px-1 rounded break-all">
                          https://nuclmzoasgydubdshtab.supabase.co/functions/v1/actblue-webhook
                        </code>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto">
                    {editingCredential ? 'Update Credentials' : 'Save Credentials'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations or platforms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Grouped credentials by organization */}
        {credentials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Key className="w-12 h-12 mx-auto opacity-30 mb-4" />
            <p className="font-medium">No API credentials configured yet</p>
            <p className="text-sm mb-4">Add your first integration to start syncing data</p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add your first integration
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrganizations.map(org => {
              const orgCreds = credentialsByOrg[org.id] || [];
              if (orgCreds.length === 0 && searchQuery) return null;
              
              const orgHealth = getOrgHealth(org.id);
              const isExpanded = expandedOrgs.has(org.id);
              
              return (
                <Collapsible 
                  key={org.id} 
                  open={isExpanded} 
                  onOpenChange={() => toggleOrgExpanded(org.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {orgCreds.length} integration{orgCreds.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {orgHealth.status === 'healthy' && (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Healthy
                          </Badge>
                        )}
                        {orgHealth.status === 'error' && (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        {orgHealth.status === 'warning' && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Warning
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-7 pr-3 py-2 space-y-2">
                      {orgCreds.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No integrations configured</p>
                      ) : (
                        orgCreds.map(cred => (
                          <CredentialCard key={cred.id} cred={cred} />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCredential} onOpenChange={() => setDeleteCredential(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete API Credentials?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteCredential?.platform} credentials for{' '}
              <strong>{deleteCredential && getOrganizationName(deleteCredential.organization_id)}</strong>.
              This action cannot be undone and will stop data syncing for this integration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCredential && handleDeleteCredential(deleteCredential.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
