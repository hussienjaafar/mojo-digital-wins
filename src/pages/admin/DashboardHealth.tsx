import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Activity,
  Database,
  Zap,
  MessageSquare,
  ArrowUpDown,
  Search,
  ExternalLink,
  PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface DashboardHealthRecord {
  organizationId: string;
  organizationName: string;
  isActive: boolean;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  healthScore: number;
  dataSources: {
    meta: { status: string; lastSync: string | null; hoursStale: number };
    actblue: { status: string; lastSync: string | null; hoursStale: number };
    switchboard: { status: string; lastSync: string | null; hoursStale: number };
  };
  integrations: {
    meta: { status: string | null; lastTested: string | null };
    switchboard: { status: string | null; lastTested: string | null };
    actblue: { status: string | null; lastTested: string | null };
  };
  lastUserLogin: string | null;
  issues: number;
}

const statusIcons = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  critical: AlertCircle,
  unknown: Activity,
};

const statusColors = {
  healthy: 'text-[hsl(var(--portal-success))] bg-[hsl(var(--portal-success))]/10',
  degraded: 'text-[hsl(var(--portal-warning))] bg-[hsl(var(--portal-warning))]/10',
  critical: 'text-[hsl(var(--portal-error))] bg-[hsl(var(--portal-error))]/10',
  unknown: 'text-muted-foreground bg-muted',
};

function HealthStatusBadge({ status, score }: { status: DashboardHealthRecord['overallStatus']; score: number }) {
  const Icon = statusIcons[status];
  return (
    <Badge variant="outline" className={cn('gap-1.5', statusColors[status])}>
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{status}</span>
      <span className="opacity-70">({score}%)</span>
    </Badge>
  );
}

function DataSourceCell({ source }: { source: { status: string; lastSync: string | null; hoursStale: number } }) {
  const getColor = () => {
    if (source.status === 'healthy' || source.hoursStale <= 0) return 'bg-[hsl(var(--portal-success))]';
    if (source.status === 'stale' || source.hoursStale <= 24) return 'bg-[hsl(var(--portal-warning))]';
    if (source.status === 'critical' || source.hoursStale > 48) return 'bg-[hsl(var(--portal-error))]';
    return 'bg-muted-foreground';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', getColor())} />
            <span className="text-xs text-muted-foreground">
              {source.lastSync 
                ? `${Math.round(source.hoursStale)}h`
                : 'Never'
              }
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Status: {source.status}</p>
          <p>Last sync: {source.lastSync ? formatDistanceToNow(new Date(source.lastSync), { addSuffix: true }) : 'Never'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IntegrationCell({ integration }: { integration: { status: string | null; lastTested: string | null } }) {
  const getColor = () => {
    if (!integration.status) return 'bg-muted-foreground';
    if (integration.status === 'success') return 'bg-[hsl(var(--portal-success))]';
    if (integration.status === 'error') return 'bg-[hsl(var(--portal-error))]';
    return 'bg-[hsl(var(--portal-warning))]';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('w-2.5 h-2.5 rounded-full inline-block', getColor())} />
        </TooltipTrigger>
        <TooltipContent>
          <p>Status: {integration.status || 'Not configured'}</p>
          {integration.lastTested && (
            <p>Tested: {formatDistanceToNow(new Date(integration.lastTested), { addSuffix: true })}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function DashboardHealth() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'degraded' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'issues'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch all client dashboard health data
  const { data: healthData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-health'],
    queryFn: async (): Promise<DashboardHealthRecord[]> => {
      // Get organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('client_organizations')
        .select('id, name, is_active')
        .order('name');

      if (orgsError) throw orgsError;

      // Get data freshness
      const { data: freshness } = await supabase
        .from('data_freshness')
        .select('organization_id, source, is_within_sla, data_lag_hours, last_synced_at, last_sync_status');

      // Get integration status
      const { data: credentials } = await supabase
        .from('client_api_credentials')
        .select('organization_id, platform, last_test_status, last_tested_at, is_active');

      // Get last user logins
      const { data: users } = await supabase
        .from('client_users')
        .select('organization_id, last_login_at')
        .order('last_login_at', { ascending: false });

      // Build health records
      const records: DashboardHealthRecord[] = (orgs || []).map(org => {
        const orgFreshness = (freshness || []).filter(f => f.organization_id === org.id);
        const orgCreds = (credentials || []).filter(c => c.organization_id === org.id && c.is_active);
        const lastLogin = (users || []).find(u => u.organization_id === org.id)?.last_login_at;

        const getSourceStatus = (source: string) => {
          const record = orgFreshness.find(f => f.source.startsWith(source));
          return {
            status: record?.is_within_sla ? 'healthy' : (record ? 'stale' : 'unknown'),
            lastSync: record?.last_synced_at || null,
            hoursStale: record?.data_lag_hours || 0,
          };
        };

        const getIntegrationStatus = (platform: string) => {
          const cred = orgCreds.find(c => c.platform === platform);
          return {
            status: cred?.last_test_status || null,
            lastTested: cred?.last_tested_at || null,
          };
        };

        const dataSources = {
          meta: getSourceStatus('meta'),
          actblue: getSourceStatus('actblue'),
          switchboard: getSourceStatus('switchboard'),
        };

        const integrations = {
          meta: getIntegrationStatus('meta'),
          switchboard: getIntegrationStatus('switchboard'),
          actblue: getIntegrationStatus('actblue'),
        };

        // Calculate health score
        let healthScore = 100;
        let issues = 0;

        Object.values(dataSources).forEach(ds => {
          if (ds.status === 'stale') { healthScore -= 15; issues++; }
          if (ds.status === 'unknown' && orgCreds.length > 0) { healthScore -= 10; issues++; }
        });

        Object.values(integrations).forEach(int => {
          if (int.status === 'error') { healthScore -= 20; issues++; }
        });

        healthScore = Math.max(0, healthScore);

        let overallStatus: DashboardHealthRecord['overallStatus'] = 'healthy';
        if (healthScore < 50) overallStatus = 'critical';
        else if (healthScore < 80) overallStatus = 'degraded';
        else if (orgCreds.length === 0) overallStatus = 'unknown';

        return {
          organizationId: org.id,
          organizationName: org.name,
          isActive: org.is_active,
          overallStatus,
          healthScore,
          dataSources,
          integrations,
          lastUserLogin: lastLogin || null,
          issues,
        };
      });

      return records;
    },
    staleTime: 60 * 1000,
  });

  // Test all failing integrations
  const testFailingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { test_all_failing: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Tested ${data.summary.total} integrations: ${data.summary.passed} passed, ${data.summary.failed} failed`);
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-health'] });
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
    },
  });

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    let data = healthData || [];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      data = data.filter(r => r.organizationName.toLowerCase().includes(searchLower));
    }

    // Apply filter
    if (filter !== 'all') {
      data = data.filter(r => r.overallStatus === filter);
    }

    // Apply sort
    data.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') comparison = a.organizationName.localeCompare(b.organizationName);
      else if (sortBy === 'score') comparison = a.healthScore - b.healthScore;
      else if (sortBy === 'issues') comparison = a.issues - b.issues;
      return sortAsc ? comparison : -comparison;
    });

    return data;
  }, [healthData, search, filter, sortBy, sortAsc]);

  // Summary stats
  const stats = React.useMemo(() => {
    const data = healthData || [];
    return {
      total: data.length,
      healthy: data.filter(r => r.overallStatus === 'healthy').length,
      degraded: data.filter(r => r.overallStatus === 'degraded').length,
      critical: data.filter(r => r.overallStatus === 'critical').length,
      avgScore: data.length > 0 
        ? Math.round(data.reduce((sum, r) => sum + r.healthScore, 0) / data.length)
        : 0,
    };
  }, [healthData]);

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Health Monitor</h1>
          <p className="text-muted-foreground">Cross-client dashboard status and data freshness</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testFailingMutation.mutate()}
            disabled={testFailingMutation.isPending}
          >
            <PlayCircle className={cn('h-4 w-4 mr-2', testFailingMutation.isPending && 'animate-spin')} />
            Test Failing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clients</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[hsl(var(--portal-success))]/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
              Healthy
            </CardDescription>
            <CardTitle className="text-3xl text-[hsl(var(--portal-success))]">{stats.healthy}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[hsl(var(--portal-warning))]/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
              Degraded
            </CardDescription>
            <CardTitle className="text-3xl text-[hsl(var(--portal-warning))]">{stats.degraded}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[hsl(var(--portal-error))]/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
              Critical
            </CardDescription>
            <CardTitle className="text-3xl text-[hsl(var(--portal-error))]">{stats.critical}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Health Score</CardDescription>
            <CardTitle className="text-3xl">{stats.avgScore}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'critical', 'degraded', 'healthy'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Organization
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('score')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Database className="h-3.5 w-3.5" />
                    Data Sources
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    Integrations
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('issues')}
                >
                  <div className="flex items-center gap-1">
                    Issues
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading dashboard health...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No organizations match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map(record => (
                  <TableRow key={record.organizationId} className={!record.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{record.organizationName}</span>
                        {!record.isActive && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <HealthStatusBadge status={record.overallStatus} score={record.healthScore} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title="Meta">
                          <Database className="h-3 w-3 text-muted-foreground" />
                          <DataSourceCell source={record.dataSources.meta} />
                        </div>
                        <div className="flex items-center gap-1" title="ActBlue">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <DataSourceCell source={record.dataSources.actblue} />
                        </div>
                        <div className="flex items-center gap-1" title="SMS">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <DataSourceCell source={record.dataSources.switchboard} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IntegrationCell integration={record.integrations.meta} />
                        <IntegrationCell integration={record.integrations.switchboard} />
                        <IntegrationCell integration={record.integrations.actblue} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.issues > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {record.issues}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.lastUserLogin 
                        ? formatDistanceToNow(new Date(record.lastUserLogin), { addSuffix: true })
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/admin/organizations/${record.organizationId}`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
