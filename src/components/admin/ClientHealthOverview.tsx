import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, Calendar, Activity, Database, Clock, HeartPulse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { AdminPageHeader, AdminLoadingState } from "./v3";

interface DataFreshness {
  source: string;
  latestDate: string | null;
  recordCount: number;
  hoursStale: number | null;
}

interface ClientHealth {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  last_login: string | null;
  user_count: number;
  api_credentials: {
    platform: string;
    is_active: boolean;
    last_sync_at: string | null;
    last_sync_status: string | null;
  }[];
  data_freshness?: DataFreshness[];
}

export default function ClientHealthOverview() {
  const [clients, setClients] = useState<ClientHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchClientHealth();
  }, []);

  const fetchClientHealth = async () => {
    try {
      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("client_organizations")
        .select("id, name, slug, is_active");

      if (orgsError) throw orgsError;

      // Fetch user counts and last login
      const { data: users, error: usersError } = await supabase
        .from("client_users")
        .select("organization_id, last_login_at");

      if (usersError) throw usersError;

      // Fetch API credentials
      const { data: credentials, error: credError } = await supabase
        .from("client_api_credentials")
        .select("organization_id, platform, is_active, last_sync_at, last_sync_status");

      if (credError) throw credError;

      // Fetch data freshness metrics
      const { data: metaFreshness } = await supabase
        .from("meta_ad_metrics")
        .select("organization_id, date")
        .order("date", { ascending: false });

      // Using secure view for defense-in-depth PII protection
      const { data: actblueFreshness } = await supabase
        .from("actblue_transactions_secure")
        .select("organization_id, transaction_date")
        .order("transaction_date", { ascending: false });

      const { data: smsFreshness } = await supabase
        .from("sms_campaigns")
        .select("organization_id, send_date")
        .order("send_date", { ascending: false });

      // Combine data
      const clientHealthData = orgs?.map(org => {
        const orgUsers = users?.filter(u => u.organization_id === org.id) || [];
        const lastLogin = orgUsers.length > 0 
          ? orgUsers.sort((a, b) => {
              if (!a.last_login_at) return 1;
              if (!b.last_login_at) return -1;
              return new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime();
            })[0]?.last_login_at 
          : null;

        const apiCredentials = credentials?.filter(c => c.organization_id === org.id).map(c => ({
          platform: c.platform,
          is_active: c.is_active || false,
          last_sync_at: c.last_sync_at,
          last_sync_status: c.last_sync_status,
        })) || [];

        // Calculate data freshness
        const freshness: DataFreshness[] = [];
        
        const latestMeta = metaFreshness?.find(m => m.organization_id === org.id);
        if (latestMeta) {
          const hoursStale = (Date.now() - new Date(latestMeta.date).getTime()) / (1000 * 60 * 60);
          freshness.push({ source: 'Meta', latestDate: latestMeta.date, recordCount: 0, hoursStale });
        }
        
        const latestActblue = actblueFreshness?.find(a => a.organization_id === org.id);
        if (latestActblue) {
          const hoursStale = (Date.now() - new Date(latestActblue.transaction_date).getTime()) / (1000 * 60 * 60);
          freshness.push({ source: 'ActBlue', latestDate: latestActblue.transaction_date, recordCount: 0, hoursStale });
        }
        
        const latestSms = smsFreshness?.find(s => s.organization_id === org.id);
        if (latestSms) {
          const hoursStale = (Date.now() - new Date(latestSms.send_date).getTime()) / (1000 * 60 * 60);
          freshness.push({ source: 'SMS', latestDate: latestSms.send_date, recordCount: 0, hoursStale });
        }

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          is_active: org.is_active || false,
          last_login: lastLogin,
          user_count: orgUsers.length,
          api_credentials: apiCredentials,
          data_freshness: freshness,
        };
      }) || [];

      setClients(clientHealthData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching client health:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (orgId: string, platform: string) => {
    const syncKey = `${orgId}-${platform}`;
    setSyncing(prev => ({ ...prev, [syncKey]: true }));
    
    try {
      const functionName = platform === 'actblue' ? 'sync-actblue-csv' 
        : platform === 'meta' ? 'sync-meta-ads'
        : 'sync-switchboard-sms';
      
      const { error } = await supabase.functions.invoke(functionName, {
        body: { organization_id: orgId }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sync Triggered",
        description: `${platform} sync started for organization`,
      });
      
      // Refresh data after a delay
      setTimeout(() => fetchClientHealth(), 3000);
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || `Failed to sync ${platform}`,
        variant: "destructive",
      });
    } finally {
      setSyncing(prev => ({ ...prev, [syncKey]: false }));
    }
  };

  const getDataFreshnessBadge = (hoursStale: number | null) => {
    if (hoursStale === null) return null;
    
    if (hoursStale < 24) {
      return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">Fresh</Badge>;
    }
    if (hoursStale < 72) {
      return <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">{Math.round(hoursStale)}h</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">{Math.round(hoursStale / 24)}d stale</Badge>;
  };

  const getSyncStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">No Sync</Badge>;
    
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><RefreshCw className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysSinceLogin = (lastLogin: string | null) => {
    if (!lastLogin) return '∞';
    const days = Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Client Health Overview"
          description="Loading health metrics..."
          icon={HeartPulse}
          iconColor="green"
        />
        <AdminLoadingState variant="card" count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Client Health Overview"
        description="Monitor client activity, data sync status, and API integrations"
        icon={HeartPulse}
        iconColor="green"
        onRefresh={fetchClientHealth}
      />

      <div className="grid gap-4">
        {clients.map((client) => {
          const hasActiveIntegrations = client.api_credentials.some(c => c.is_active);
          const hasFailedSync = client.api_credentials.some(c => c.last_sync_status === 'failed');
          const daysSinceLogin = getDaysSinceLogin(client.last_login);
          const isStale = !client.last_login || (typeof daysSinceLogin === 'string' && daysSinceLogin.includes('d') && parseInt(daysSinceLogin) > 7);

          return (
            <Card key={client.id} className={hasFailedSync ? "border-destructive/50" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{client.name}</CardTitle>
                        <Badge variant={client.is_active ? "default" : "outline"}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {isStale && (
                          <Badge variant="outline" className="text-warning border-warning">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Stale
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last login: {daysSinceLogin}
                          </span>
                          <span>{client.user_count} user{client.user_count !== 1 ? 's' : ''}</span>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/client-view/${client.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Data Freshness */}
                  {client.data_freshness && client.data_freshness.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Data Freshness
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {client.data_freshness.map((df, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 border border-border/50">
                            <span className="text-[10px] font-medium">{df.source}</span>
                            {getDataFreshnessBadge(df.hoursStale)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">API Integrations</p>
                    {client.api_credentials.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No API credentials configured</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {client.api_credentials.map((cred, idx) => {
                          const syncKey = `${client.id}-${cred.platform}`;
                          const isSyncing = syncing[syncKey];
                          
                          return (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                              <span className="text-xs font-medium text-foreground">{cred.platform}</span>
                              {getSyncStatusBadge(cred.last_sync_status)}
                              {cred.last_sync_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(cred.last_sync_at), { addSuffix: true })}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                disabled={isSyncing}
                                onClick={() => triggerSync(client.id, cred.platform)}
                              >
                                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {hasFailedSync && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/50">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <p className="text-xs text-destructive">
                        One or more data syncs have failed. Check API credentials and sync logs.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {clients.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No client organizations found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
