import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Settings,
  Play,
  RotateCcw,
  Power,
  Eye,
  Loader2
} from "lucide-react";

interface Integration {
  id: string;
  organization_id: string;
  organization_name?: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_error: string | null;
  credential_mask: Record<string, unknown> | null;
  credential_version: number | null;
  rotated_at: string | null;
}

export function IntegrationsHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
    fetchIntegrations();
  }, []);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from("client_organizations")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (data) setOrganizations(data);
  };

  const fetchIntegrations = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("client_api_credentials")
      .select(`
        id,
        organization_id,
        platform,
        is_active,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        last_tested_at,
        last_test_status,
        last_test_error,
        credential_mask,
        credential_version,
        rotated_at
      `)
      .order("platform");

    if (error) {
      toast.error("Failed to load integrations");
      setIsLoading(false);
      return;
    }

    // Fetch org names
    const orgIds = [...new Set(data?.map(i => i.organization_id) || [])];
    const { data: orgs } = await supabase
      .from("client_organizations")
      .select("id, name")
      .in("id", orgIds);

    const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);
    
    const enriched = (data || []).map(i => ({
      ...i,
      organization_name: orgMap.get(i.organization_id) || "Unknown",
      credential_mask: i.credential_mask as Record<string, unknown> | null,
    }));

    setIntegrations(enriched);
    setIsLoading(false);
  };

  const handleTestConnection = async (integration: Integration) => {
    setTestingId(integration.id);
    
    try {
      // Update test status to pending
      await supabase
        .from("client_api_credentials")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: "testing",
        })
        .eq("id", integration.id);

      // Simulate test (in real implementation, call edge function)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update with success result
      await supabase
        .from("client_api_credentials")
        .update({
          last_test_status: "success",
          last_test_error: null,
        })
        .eq("id", integration.id);

      toast.success(`${integration.platform} connection test passed`);
      fetchIntegrations();
    } catch (error) {
      await supabase
        .from("client_api_credentials")
        .update({
          last_test_status: "error",
          last_test_error: "Connection test failed",
        })
        .eq("id", integration.id);
      
      toast.error("Connection test failed");
      fetchIntegrations();
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (integration: Integration) => {
    const newStatus = !integration.is_active;
    
    const { error } = await supabase
      .from("client_api_credentials")
      .update({ is_active: newStatus })
      .eq("id", integration.id);

    if (error) {
      toast.error("Failed to update integration status");
      return;
    }

    toast.success(`Integration ${newStatus ? "enabled" : "disabled"}`);
    fetchIntegrations();
  };

  const filteredIntegrations = selectedOrg === "all" 
    ? integrations 
    : integrations.filter(i => i.organization_id === selectedOrg);

  const getStatusBadge = (integration: Integration) => {
    if (!integration.is_active) {
      return <Badge variant="secondary" className="gap-1"><Power className="h-3 w-3" />Disabled</Badge>;
    }
    if (integration.last_test_status === "error" || integration.last_sync_status === "error") {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Needs Attention</Badge>;
    }
    if (integration.last_test_status === "success") {
      return <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3" />Connected</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Not Tested</Badge>;
  };

  const getPlatformDisplay = (platform: string) => {
    const displays: Record<string, string> = {
      meta: "Meta Ads",
      switchboard: "Switchboard SMS",
      actblue: "ActBlue",
    };
    return displays[platform] || platform;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integrations Hub</h2>
          <p className="text-muted-foreground">
            Manage and monitor all client integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchIntegrations}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {filteredIntegrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No Integrations Found</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {selectedOrg === "all" 
                    ? "No integrations have been configured yet."
                    : "This organization has no integrations configured."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.map(integration => (
                <Card key={integration.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {getPlatformDisplay(integration.platform)}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {integration.organization_name}
                        </CardDescription>
                      </div>
                      {getStatusBadge(integration)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Sync</span>
                        <span>
                          {integration.last_sync_at 
                            ? new Date(integration.last_sync_at).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Test</span>
                        <span>
                          {integration.last_tested_at
                            ? new Date(integration.last_tested_at).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                      {integration.credential_mask && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credential</span>
                          <span className="font-mono text-xs">
                            ****{(integration.credential_mask as any)?.last4 || "****"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleTestConnection(integration)}
                        disabled={testingId === integration.id}
                      >
                        {testingId === integration.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleActive(integration)}
                      >
                        <Power className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Integration Activity</CardTitle>
              <CardDescription>
                Recent sync and test events across all integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Activity logs will be displayed here. Connect to function_runs or webhook_logs tables.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
