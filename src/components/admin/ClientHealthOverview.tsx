import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, Calendar } from "lucide-react";

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
}

export default function ClientHealthOverview() {
  const [clients, setClients] = useState<ClientHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          is_active: org.is_active || false,
          last_login: lastLogin,
          user_count: orgUsers.length,
          api_credentials: apiCredentials,
        };
      }) || [];

      setClients(clientHealthData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching client health:", error);
    } finally {
      setLoading(false);
    }
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
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading client health...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Client Health Overview</h2>
        <p className="text-sm text-muted-foreground">
          Monitor client activity, data sync status, and API integrations
        </p>
      </div>

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
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">API Integrations</p>
                    {client.api_credentials.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No API credentials configured</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {client.api_credentials.map((cred, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
                            <span className="text-xs font-medium text-foreground">{cred.platform}</span>
                            {getSyncStatusBadge(cred.last_sync_status)}
                            {cred.last_sync_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(cred.last_sync_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
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
