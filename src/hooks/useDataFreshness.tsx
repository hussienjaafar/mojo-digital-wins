import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Freshness SLA targets (in hours) - must match database config
 */
export const FRESHNESS_SLAS = {
  meta: 24,           // Meta Marketing API - 24 hours
  actblue_webhook: 1, // ActBlue webhooks - near real-time
  actblue_csv: 24,    // ActBlue CSV reconciliation - 24 hours
  switchboard: 4,     // Switchboard SMS - 4 hours
} as const;

export type DataSource = keyof typeof FRESHNESS_SLAS;

export interface FreshnessRecord {
  source: DataSource;
  organizationId: string | null;
  organizationName: string | null;
  lastSyncedAt: Date | null;
  lastSyncStatus: 'success' | 'error' | 'pending' | 'stale';
  latestDataTimestamp: Date | null;
  dataLagHours: number;
  freshnessSlaHours: number;
  isWithinSla: boolean;
  freshnessStatus: 'Fresh' | 'Slightly stale' | 'Stale' | 'Never synced';
  sourceDisplayName: string;
  recordsSynced: number;
  lastError: string | null;
}

export interface DataFreshnessState {
  records: FreshnessRecord[];
  isLoading: boolean;
  error: string | null;
  overallHealth: 'healthy' | 'warning' | 'critical';
  staleCount: number;
}

/**
 * Hook to fetch and monitor data freshness across all sources
 * 
 * @param organizationId - Optional: filter to specific organization
 * @param sources - Optional: filter to specific sources
 */
export function useDataFreshness(
  organizationId?: string,
  sources?: DataSource[]
) {
  const [state, setState] = useState<DataFreshnessState>({
    records: [],
    isLoading: true,
    error: null,
    overallHealth: 'healthy',
    staleCount: 0,
  });

  const fetchFreshness = useCallback(async () => {
    try {
      // Query the data_freshness table directly
      let query = supabase
        .from('data_freshness')
        .select(`
          source,
          organization_id,
          last_synced_at,
          last_sync_status,
          latest_data_timestamp,
          data_lag_hours,
          freshness_sla_hours,
          is_within_sla,
          records_synced,
          last_error
        `)
        .order('source');

      if (organizationId) {
        query = query.or(`organization_id.eq.${organizationId},scope.eq.global`);
      }

      if (sources && sources.length > 0) {
        query = query.in('source', sources);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get organization names separately
      const orgIds = [...new Set((data || []).map(d => d.organization_id).filter(Boolean))];
      let orgNames: Record<string, string> = {};
      
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('client_organizations')
          .select('id, name')
          .in('id', orgIds);
        
        orgNames = (orgs || []).reduce((acc, org) => {
          acc[org.id] = org.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const records: FreshnessRecord[] = (data || []).map(row => {
        const dataLagHours = row.data_lag_hours || 0;
        const slaHours = row.freshness_sla_hours || FRESHNESS_SLAS[row.source as DataSource] || 24;
        const isWithinSla = dataLagHours <= slaHours;
        
        let freshnessStatus: FreshnessRecord['freshnessStatus'] = 'Fresh';
        if (!row.last_synced_at) {
          freshnessStatus = 'Never synced';
        } else if (!isWithinSla) {
          freshnessStatus = dataLagHours <= slaHours * 1.5 ? 'Slightly stale' : 'Stale';
        }

        const sourceDisplayNames: Record<string, string> = {
          meta: 'Meta Ads',
          actblue_webhook: 'ActBlue (Real-time)',
          actblue_csv: 'ActBlue (CSV)',
          switchboard: 'Switchboard SMS',
        };

        return {
          source: row.source as DataSource,
          organizationId: row.organization_id,
          organizationName: row.organization_id ? orgNames[row.organization_id] || null : null,
          lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
          lastSyncStatus: row.last_sync_status as FreshnessRecord['lastSyncStatus'],
          latestDataTimestamp: row.latest_data_timestamp ? new Date(row.latest_data_timestamp) : null,
          dataLagHours,
          freshnessSlaHours: slaHours,
          isWithinSla,
          freshnessStatus,
          sourceDisplayName: sourceDisplayNames[row.source] || row.source,
          recordsSynced: row.records_synced || 0,
          lastError: row.last_error,
        };
      });

      const staleCount = records.filter(r => !r.isWithinSla).length;
      const overallHealth: DataFreshnessState['overallHealth'] = 
        staleCount === 0 ? 'healthy' : 
        staleCount <= records.length / 2 ? 'warning' : 'critical';

      setState({
        records,
        isLoading: false,
        error: null,
        overallHealth,
        staleCount,
      });
    } catch (error: any) {
      logger.error('Error fetching data freshness', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    }
  }, [organizationId, sources]);

  // Initial fetch
  useEffect(() => {
    fetchFreshness();
  }, [fetchFreshness]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('data_freshness_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'data_freshness',
        },
        () => {
          // Refetch on any change
          fetchFreshness();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFreshness]);

  return {
    ...state,
    refresh: fetchFreshness,
  };
}

/**
 * Get freshness status for a specific source and organization
 */
export function useSingleSourceFreshness(source: DataSource, organizationId?: string) {
  const { records, isLoading, error, refresh } = useDataFreshness(organizationId, [source]);
  
  const record = records.find(r => 
    r.source === source && 
    (organizationId ? r.organizationId === organizationId : r.organizationId === null)
  );

  return {
    freshness: record || null,
    isLoading,
    error,
    refresh,
  };
}
