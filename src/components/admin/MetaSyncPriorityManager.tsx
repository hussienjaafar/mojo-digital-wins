import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap, Clock, AlertTriangle, CheckCircle, Timer } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface SyncStatus {
  credential_id: string;
  organization_id: string;
  organization_name: string;
  meta_sync_priority: string;
  is_active: boolean;
  last_meta_sync_at: string | null;
  latest_meta_data_date: string | null;
  last_sync_status: string | null;
  sync_error_count: number;
  last_sync_error: string | null;
  rate_limit_backoff_until: string | null;
  interval_minutes: number;
  date_range_days: number;
  sync_due: boolean;
  minutes_until_sync: number;
  data_lag_days: number | null;
}

interface SyncConfig {
  tier: string;
  interval_minutes: number;
  date_range_days: number;
  description: string;
}

const MetaSyncPriorityManager = () => {
  const { toast } = useToast();
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingOrgs, setSyncingOrgs] = useState<Set<string>>(new Set());
  const [isRunningTieredSync, setIsRunningTieredSync] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch sync statuses using a direct query since view might not be in types
      const { data: creds, error: credsError } = await supabase
        .from('client_api_credentials')
        .select(`
          id,
          organization_id,
          meta_sync_priority,
          is_active,
          last_meta_sync_at,
          latest_meta_data_date,
          last_sync_status,
          sync_error_count,
          last_sync_error,
          rate_limit_backoff_until,
          client_organizations!inner(name)
        `)
        .eq('platform', 'meta');

      if (credsError) throw credsError;

      // Fetch configs
      const { data: configs, error: configsError } = await supabase
        .from('meta_sync_config')
        .select('*')
        .order('interval_minutes');

      if (configsError) throw configsError;

      // Map configs for lookup
      const configMap = new Map(configs?.map(c => [c.tier, c]) || []);

      // Transform credentials to sync statuses
      const statuses: SyncStatus[] = (creds || []).map((c: any) => {
        const config = configMap.get(c.meta_sync_priority || 'medium');
        const intervalMinutes = config?.interval_minutes || 120;
        const lastSync = c.last_meta_sync_at ? new Date(c.last_meta_sync_at) : null;
        const minutesSinceSync = lastSync 
          ? Math.floor((Date.now() - lastSync.getTime()) / 60000)
          : 999999;
        
        return {
          credential_id: c.id,
          organization_id: c.organization_id,
          organization_name: c.client_organizations?.name || 'Unknown',
          meta_sync_priority: c.meta_sync_priority || 'medium',
          is_active: c.is_active,
          last_meta_sync_at: c.last_meta_sync_at,
          latest_meta_data_date: c.latest_meta_data_date,
          last_sync_status: c.last_sync_status,
          sync_error_count: c.sync_error_count || 0,
          last_sync_error: c.last_sync_error,
          rate_limit_backoff_until: c.rate_limit_backoff_until,
          interval_minutes: intervalMinutes,
          date_range_days: config?.date_range_days || 3,
          sync_due: minutesSinceSync >= intervalMinutes,
          minutes_until_sync: Math.max(0, intervalMinutes - minutesSinceSync),
          data_lag_days: c.latest_meta_data_date 
            ? Math.floor((Date.now() - new Date(c.latest_meta_data_date).getTime()) / 86400000)
            : null
        };
      });

      setSyncStatuses(statuses);
      setSyncConfigs(configs || []);
    } catch (error: any) {
      toast({
        title: "Error loading sync data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePriority = async (organizationId: string, newPriority: string) => {
    try {
      const { error } = await supabase
        .from('client_api_credentials')
        .update({ 
          meta_sync_priority: newPriority,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', organizationId)
        .eq('platform', 'meta');

      if (error) throw error;

      // Update local state
      setSyncStatuses(prev => prev.map(s => 
        s.organization_id === organizationId 
          ? { ...s, meta_sync_priority: newPriority }
          : s
      ));

      toast({
        title: "Priority updated",
        description: `Sync priority changed to ${newPriority.toUpperCase()}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating priority",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const triggerSyncNow = async (organizationId: string, orgName: string) => {
    setSyncingOrgs(prev => new Set(prev).add(organizationId));
    try {
      toast({
        title: "Starting sync...",
        description: `Syncing Meta data for ${orgName}`,
      });

      const { data, error } = await supabase.functions.invoke('tiered-meta-sync', {
        body: { organization_id: organizationId, force: true }
      });

      if (error) throw error;

      const result = data?.results?.[0];
      if (result?.status === 'success') {
        toast({
          title: "Sync complete",
          description: `${result.metrics_stored || 0} metrics synced, latest data: ${result.latest_data_date || 'N/A'}`,
        });
      } else {
        toast({
          title: "Sync issue",
          description: result?.error || "Sync completed with warnings",
          variant: "destructive",
        });
      }

      await loadData();
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncingOrgs(prev => {
        const next = new Set(prev);
        next.delete(organizationId);
        return next;
      });
    }
  };

  const runTieredSync = async () => {
    setIsRunningTieredSync(true);
    try {
      toast({
        title: "Running tiered sync...",
        description: "Checking which accounts are due for sync",
      });

      const { data, error } = await supabase.functions.invoke('tiered-meta-sync', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Tiered sync complete",
        description: `${data?.accounts_synced || 0} synced, ${data?.accounts_skipped || 0} skipped`,
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Tiered sync failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningTieredSync(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">HIGH (1hr)</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">MEDIUM (2hr)</Badge>;
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">LOW (4hr)</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getStatusIcon = (status: SyncStatus) => {
    if (status.rate_limit_backoff_until && new Date(status.rate_limit_backoff_until) > new Date()) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    if (status.sync_error_count > 2) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (status.last_sync_status === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Meta Sync Priority Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Meta Sync Priority Manager
            </CardTitle>
            <CardDescription>
              Configure sync frequency tiers for each client's Meta Ads integration
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={runTieredSync} disabled={isRunningTieredSync}>
              {isRunningTieredSync ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Tiered Sync
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tier Legend */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          {syncConfigs.map(config => (
            <div key={config.tier} className="text-center">
              {getPriorityBadge(config.tier)}
              <p className="text-xs text-muted-foreground mt-1">
                Every {config.interval_minutes} min • {config.date_range_days} day range
              </p>
            </div>
          ))}
        </div>

        {/* Accounts Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Latest Data</TableHead>
              <TableHead>Next Sync</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncStatuses.map(status => (
              <TableRow key={status.credential_id}>
                <TableCell>{getStatusIcon(status)}</TableCell>
                <TableCell className="font-medium">{status.organization_name}</TableCell>
                <TableCell>
                  <Select
                    value={status.meta_sync_priority}
                    onValueChange={(value) => updatePriority(status.organization_id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">HIGH (1hr)</SelectItem>
                      <SelectItem value="medium">MEDIUM (2hr)</SelectItem>
                      <SelectItem value="low">LOW (4hr)</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm">
                  {status.last_meta_sync_at ? (
                    <span title={format(new Date(status.last_meta_sync_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(status.last_meta_sync_at), { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {status.latest_meta_data_date ? (
                    <span className={status.data_lag_days && status.data_lag_days > 2 ? 'text-orange-600' : ''}>
                      {format(new Date(status.latest_meta_data_date), 'MMM d')}
                      {status.data_lag_days !== null && (
                        <span className="text-muted-foreground ml-1">
                          ({status.data_lag_days}d ago)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {status.sync_due ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Due now
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      in {status.minutes_until_sync} min
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerSyncNow(status.organization_id, status.organization_name)}
                    disabled={syncingOrgs.has(status.organization_id)}
                  >
                    {syncingOrgs.has(status.organization_id) ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {syncStatuses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No Meta integrations configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Error Summary */}
        {syncStatuses.some(s => s.sync_error_count > 0) && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              Accounts with sync errors
            </h4>
            {syncStatuses
              .filter(s => s.sync_error_count > 0)
              .map(s => (
                <p key={s.credential_id} className="text-xs text-red-600 dark:text-red-300">
                  {s.organization_name}: {s.last_sync_error || 'Unknown error'} ({s.sync_error_count} failures)
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetaSyncPriorityManager;
