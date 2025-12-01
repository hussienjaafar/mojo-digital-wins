import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Users, AlertCircle, Database, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface UsageStats {
  totalClients: number;
  activeClients: number;
  totalWatchlistEntries: number;
  totalAlerts: number;
  avgWatchlistPerClient: number;
  avgAlertsPerClient: number;
}

interface ClientUsage {
  organization_id: string;
  organization_name: string;
  watchlist_count: number;
  alert_count: number;
  last_login: string | null;
  is_active: boolean;
}

interface WatchlistTrend {
  date: string;
  count: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))'];

export default function UsageAnalytics() {
  const [stats, setStats] = useState<UsageStats>({
    totalClients: 0,
    activeClients: 0,
    totalWatchlistEntries: 0,
    totalAlerts: 0,
    avgWatchlistPerClient: 0,
    avgAlertsPerClient: 0,
  });
  const [clientUsage, setClientUsage] = useState<ClientUsage[]>([]);
  const [watchlistTrends, setWatchlistTrends] = useState<WatchlistTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageAnalytics();
  }, []);

  const fetchUsageAnalytics = async () => {
    try {
      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("client_organizations")
        .select("id, name, is_active");

      if (orgsError) throw orgsError;

      // Fetch watchlist counts
      const { data: watchlists, error: watchlistError } = await supabase
        .from("entity_watchlist")
        .select("organization_id");

      if (watchlistError) throw watchlistError;

      // Fetch alert counts
      const { data: alerts, error: alertsError } = await supabase
        .from("client_entity_alerts")
        .select("organization_id");

      if (alertsError) throw alertsError;

      // Fetch client users for last login
      const { data: users, error: usersError } = await supabase
        .from("client_users")
        .select("organization_id, last_login_at")
        .order("last_login_at", { ascending: false });

      if (usersError) throw usersError;

      // Calculate statistics
      const totalClients = orgs?.length || 0;
      const activeClients = orgs?.filter(o => o.is_active).length || 0;
      const totalWatchlistEntries = watchlists?.length || 0;
      const totalAlerts = alerts?.length || 0;

      setStats({
        totalClients,
        activeClients,
        totalWatchlistEntries,
        totalAlerts,
        avgWatchlistPerClient: totalClients > 0 ? Math.round(totalWatchlistEntries / totalClients) : 0,
        avgAlertsPerClient: totalClients > 0 ? Math.round(totalAlerts / totalClients) : 0,
      });

      // Calculate per-client usage
      const clientUsageData = orgs?.map(org => {
        const watchlistCount = watchlists?.filter(w => w.organization_id === org.id).length || 0;
        const alertCount = alerts?.filter(a => a.organization_id === org.id).length || 0;
        const lastLogin = users?.find(u => u.organization_id === org.id)?.last_login_at || null;

        return {
          organization_id: org.id,
          organization_name: org.name,
          watchlist_count: watchlistCount,
          alert_count: alertCount,
          last_login: lastLogin,
          is_active: org.is_active || false,
        };
      }) || [];

      setClientUsage(clientUsageData.sort((a, b) => b.watchlist_count - a.watchlist_count));

      // Fetch watchlist trends (last 7 days)
      const { data: trendData, error: trendError } = await supabase
        .from("entity_watchlist")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (trendError) throw trendError;

      // Group by date
      const trendsMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        trendsMap.set(date.toISOString().split('T')[0], 0);
      }

      trendData?.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        trendsMap.set(date, (trendsMap.get(date) || 0) + 1);
      });

      const trends = Array.from(trendsMap.entries()).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      }));

      setWatchlistTrends(trends);
    } catch (error) {
      console.error("Error fetching usage analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
            <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Usage Analytics</h2>
            <p className="text-sm portal-text-secondary">Loading usage data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="portal-skeleton h-6 w-32" />
              <div className="portal-skeleton h-32 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Usage Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Monitor client engagement and system utilization
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeClients} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist Entries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalWatchlistEntries}</div>
            <p className="text-xs text-muted-foreground">
              Avg {stats.avgWatchlistPerClient} per client
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Generated</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              Avg {stats.avgAlertsPerClient} per client
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Client engagement
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Watchlist Growth (7 Days)</CardTitle>
            <CardDescription>Daily watchlist entity additions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={watchlistTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))"
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="New Entries"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clients by Watchlist Size</CardTitle>
            <CardDescription>Organizations with most entities tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={clientUsage.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="organization_name" 
                  stroke="hsl(var(--muted-foreground))"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))"
                  }}
                />
                <Bar dataKey="watchlist_count" fill="hsl(var(--primary))" name="Watchlist Entries" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Usage Details</CardTitle>
          <CardDescription>Individual client metrics and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {clientUsage.map((client) => (
              <div key={client.organization_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-foreground">{client.organization_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last login: {client.last_login 
                        ? new Date(client.last_login).toLocaleDateString() 
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{client.watchlist_count} entities</p>
                    <p className="text-xs text-muted-foreground">{client.alert_count} alerts</p>
                  </div>
                  <Badge variant={client.is_active ? "default" : "outline"}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
            {clientUsage.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No client usage data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
