import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDataFreshness, DataSource as FreshnessDataSource } from './useDataFreshness';

export type DataSource = FreshnessDataSource;
import { useClientHealth } from '@/hooks/useActBlueMetrics';

/**
 * Dashboard health issue severity levels
 */
export type IssueSeverity = 'info' | 'warning' | 'critical';

/**
 * A single issue detected during dashboard health check
 */
export interface DashboardHealthIssue {
  id: string;
  severity: IssueSeverity;
  source: DataSource | 'integration' | 'data_quality' | 'rpc';
  title: string;
  message: string;
  recommendation?: string;
  canProceed: boolean;
}

/**
 * Data source readiness status
 */
export interface DataSourceStatus {
  source: DataSource;
  displayName: string;
  isReady: boolean;
  isFresh: boolean;
  lastSyncedAt: Date | null;
  dataLagHours: number;
  slaHours: number;
  status: 'healthy' | 'stale' | 'critical' | 'never_synced';
  hasIntegration: boolean;
  integrationStatus: 'success' | 'error' | 'pending' | 'untested' | null;
}

/**
 * Complete dashboard health status
 */
export interface DashboardHealthStatus {
  isReady: boolean;
  isLoading: boolean;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'loading';
  healthScore: number; // 0-100
  issues: DashboardHealthIssue[];
  dataSources: DataSourceStatus[];
  recommendations: string[];
  degradedSources: DataSource[];
  missingSources: DataSource[];
  canRenderDashboard: boolean;
  lastCheckedAt: Date;
}

/**
 * Source display name mapping
 */
const SOURCE_DISPLAY_NAMES: Record<DataSource, string> = {
  meta: 'Meta Ads',
  actblue_webhook: 'ActBlue (Real-time)',
  actblue_csv: 'ActBlue (CSV)',
  switchboard: 'Switchboard SMS',
};

/**
 * Universal dashboard pre-flight check hook
 * 
 * Validates all data sources and integrations before rendering dashboard metrics.
 * Returns comprehensive health status with actionable issues and recommendations.
 * 
 * @param organizationId - The organization to check
 * @param requiredSources - Optional: specific sources required for this dashboard view
 */
export function useClientDashboardHealth(
  organizationId: string | undefined,
  requiredSources?: DataSource[]
): DashboardHealthStatus {
  // Get data freshness status
  const { 
    records: freshnessRecords, 
    isLoading: freshnessLoading, 
    overallHealth: freshnessHealth 
  } = useDataFreshness(organizationId);

  // Get client health data
  const { 
    data: clientHealth, 
    isLoading: clientHealthLoading 
  } = useClientHealth(organizationId);

  // Get integration credentials status
  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['dashboard-integrations', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('client_api_credentials')
        .select('platform, is_active, last_test_status, last_tested_at, last_sync_status')
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = freshnessLoading || clientHealthLoading || integrationsLoading;

  // Build data source statuses
  const allSources: DataSource[] = requiredSources || ['meta', 'actblue_webhook', 'actblue_csv', 'switchboard'];
  const dataSources: DataSourceStatus[] = allSources.map(source => {
    const freshnessRecord = freshnessRecords.find(r => 
      r.source === source && 
      (organizationId ? r.organizationId === organizationId : true)
    );

    const integration = integrations?.find(i => {
      if (source === 'meta') return i.platform === 'meta';
      if (source === 'switchboard') return i.platform === 'switchboard';
      if (source.startsWith('actblue')) return i.platform === 'actblue';
      return false;
    });

    const isWithinSla = freshnessRecord?.isWithinSla ?? false;
    const hasData = freshnessRecord?.lastSyncedAt !== null;
    const dataLagHours = freshnessRecord?.dataLagHours ?? 0;
    const slaHours = freshnessRecord?.freshnessSlaHours ?? 24;

    let status: DataSourceStatus['status'] = 'healthy';
    if (!hasData) {
      status = 'never_synced';
    } else if (dataLagHours >= slaHours * 2) {
      status = 'critical';
    } else if (!isWithinSla) {
      status = 'stale';
    }

    return {
      source,
      displayName: SOURCE_DISPLAY_NAMES[source],
      isReady: hasData && status !== 'critical',
      isFresh: isWithinSla,
      lastSyncedAt: freshnessRecord?.lastSyncedAt ?? null,
      dataLagHours,
      slaHours,
      status,
      hasIntegration: !!integration,
      integrationStatus: integration?.last_test_status as DataSourceStatus['integrationStatus'] ?? null,
    };
  });

  // Collect issues
  const issues: DashboardHealthIssue[] = [];

  // Check for stale or missing data sources
  dataSources.forEach(ds => {
    if (ds.status === 'never_synced') {
      issues.push({
        id: `never-synced-${ds.source}`,
        severity: 'warning',
        source: ds.source,
        title: `${ds.displayName} never synced`,
        message: `No data has been synced for ${ds.displayName}. This section will show empty data.`,
        recommendation: ds.hasIntegration 
          ? 'Try triggering a manual sync from the admin panel.'
          : 'Configure the integration to start syncing data.',
        canProceed: true,
      });
    } else if (ds.status === 'critical') {
      issues.push({
        id: `critical-${ds.source}`,
        severity: 'critical',
        source: ds.source,
        title: `${ds.displayName} data critically stale`,
        message: `Data is ${Math.round(ds.dataLagHours)} hours old (expected: within ${ds.slaHours}h). Metrics may be significantly inaccurate.`,
        recommendation: 'Check the integration status and recent sync errors in admin panel.',
        canProceed: true,
      });
    } else if (ds.status === 'stale') {
      issues.push({
        id: `stale-${ds.source}`,
        severity: 'warning',
        source: ds.source,
        title: `${ds.displayName} data slightly stale`,
        message: `Data is ${Math.round(ds.dataLagHours)} hours old (expected: within ${ds.slaHours}h).`,
        recommendation: 'Data will auto-refresh on next sync cycle.',
        canProceed: true,
      });
    }

    // Check integration status
    if (ds.integrationStatus === 'error') {
      issues.push({
        id: `integration-error-${ds.source}`,
        severity: 'critical',
        source: 'integration',
        title: `${ds.displayName} integration failing`,
        message: 'The last integration test failed. New data may not be syncing.',
        recommendation: 'Check API credentials and re-test the integration.',
        canProceed: true,
      });
    }
  });

  // Check client health recommendations
  if (clientHealth?.recommendations) {
    clientHealth.recommendations.forEach((rec: string, idx: number) => {
      issues.push({
        id: `client-health-${idx}`,
        severity: 'info',
        source: 'data_quality',
        title: 'Data quality recommendation',
        message: rec,
        canProceed: true,
      });
    });
  }

  // Calculate health score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const totalSources = dataSources.length;
  const healthySources = dataSources.filter(ds => ds.status === 'healthy').length;
  
  let healthScore = Math.round((healthySources / totalSources) * 100);
  healthScore = Math.max(0, healthScore - (criticalCount * 20) - (warningCount * 5));

  // Determine overall status
  let overallStatus: DashboardHealthStatus['overallStatus'] = 'loading';
  if (!isLoading) {
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 0 || healthScore < 80) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
  }

  // Collect degraded and missing sources
  const degradedSources = dataSources
    .filter(ds => ds.status === 'stale' || ds.status === 'critical')
    .map(ds => ds.source);
  
  const missingSources = dataSources
    .filter(ds => ds.status === 'never_synced')
    .map(ds => ds.source);

  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalCount > 0) {
    recommendations.push('Review integration status for failing data sources');
  }
  if (missingSources.length > 0) {
    recommendations.push(`Configure missing integrations: ${missingSources.map(s => SOURCE_DISPLAY_NAMES[s]).join(', ')}`);
  }
  if (degradedSources.length > 0 && criticalCount === 0) {
    recommendations.push('Data will auto-refresh soon. Check back in a few minutes.');
  }

  // Can render if no critical issues or if we have at least some data
  const canRenderDashboard = !isLoading && (
    criticalCount === 0 || 
    dataSources.some(ds => ds.isReady)
  );

  return {
    isReady: !isLoading && canRenderDashboard,
    isLoading,
    overallStatus,
    healthScore,
    issues,
    dataSources,
    recommendations,
    degradedSources,
    missingSources,
    canRenderDashboard,
    lastCheckedAt: new Date(),
  };
}

/**
 * Quick check for a single data source readiness
 */
export function useDataSourceReady(
  organizationId: string | undefined,
  source: DataSource
): { isReady: boolean; isLoading: boolean; status: DataSourceStatus | null } {
  const health = useClientDashboardHealth(organizationId, [source]);
  const sourceStatus = health.dataSources.find(ds => ds.source === source) ?? null;
  
  return {
    isReady: sourceStatus?.isReady ?? false,
    isLoading: health.isLoading,
    status: sourceStatus,
  };
}
