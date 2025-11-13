import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    webhook_secret: string;
    entity_id: string;
  };
};

const APICredentialsManager = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [credentials, setCredentials] = useState<APICredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'switchboard' | 'actblue'>('meta');
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({});

  useEffect(() => {
    loadData();
  }, []);

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
        description: "API credentials saved successfully",
      });

      setShowCreateDialog(false);
      setPlatformConfig({});
      setSelectedOrg("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (credentialId: string, platform: string) => {
    toast({
      title: "Testing Connection",
      description: `Testing ${platform} API connection...`,
    });
    
    // This would call an edge function to test the connection
    // For now, just show a placeholder message
    setTimeout(() => {
      toast({
        title: "Coming Soon",
        description: "Connection testing will be implemented with sync functions",
      });
    }, 1000);
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

  if (isLoading) {
    return <div className="text-center py-8">Loading credentials...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Credentials
            </CardTitle>
            <CardDescription>
              Manage API credentials for Meta, Switchboard, and ActBlue
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Credentials
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure API Credentials</DialogTitle>
                <DialogDescription>
                  Add or update API credentials for a client organization
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization *</Label>
                  <Select value={selectedOrg} onValueChange={setSelectedOrg} required>
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

                <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="meta">Meta Ads</TabsTrigger>
                    <TabsTrigger value="switchboard">Switchboard</TabsTrigger>
                    <TabsTrigger value="actblue">ActBlue</TabsTrigger>
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
                    <div className="space-y-2">
                      <Label htmlFor="switchboard_api_key">API Key *</Label>
                      <Input
                        id="switchboard_api_key"
                        type="password"
                        value={platformConfig.switchboard?.api_key || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          switchboard: { ...platformConfig.switchboard!, api_key: e.target.value }
                        })}
                        placeholder="sb_live_..."
                        required={selectedPlatform === 'switchboard'}
                      />
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
                        placeholder="acc_..."
                        required={selectedPlatform === 'switchboard'}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="actblue" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhook_secret">Webhook Secret *</Label>
                      <Input
                        id="webhook_secret"
                        type="password"
                        value={platformConfig.actblue?.webhook_secret || ''}
                        onChange={(e) => setPlatformConfig({
                          ...platformConfig,
                          actblue: { ...platformConfig.actblue!, webhook_secret: e.target.value }
                        })}
                        placeholder="whsec_..."
                        required={selectedPlatform === 'actblue'}
                      />
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
                        placeholder="entity_..."
                        required={selectedPlatform === 'actblue'}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Credentials</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Sync Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No API credentials configured yet
                </TableCell>
              </TableRow>
            ) : (
              credentials.map((cred) => (
                <TableRow key={cred.id}>
                  <TableCell className="font-medium">
                    {getOrganizationName(cred.organization_id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getPlatformIcon(cred.platform)}</span>
                      <span className="capitalize">{cred.platform}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cred.is_active ? "default" : "secondary"}>
                      {cred.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cred.last_sync_at
                      ? new Date(cred.last_sync_at).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {cred.last_sync_status === 'success' && (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </Badge>
                    )}
                    {cred.last_sync_status === 'error' && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        Error
                      </Badge>
                    )}
                    {!cred.last_sync_status && '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnection(cred.id, cred.platform)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(cred.id, cred.is_active)}
                      >
                        {cred.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default APICredentialsManager;
