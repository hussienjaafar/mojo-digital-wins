import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  IntegrationSummary, 
  IntegrationStatusCounts, 
  IntegrationHealthStatus,
  IntegrationDetail,
  WebhookStats,
  DataFreshness,
} from '@/types/integrations';

interface UseIntegrationSummaryOptions {
  statusFilter?: IntegrationHealthStatus | 'all';
  platformFilter?: string | 'all';
  searchQuery?: string;
  includeDiagnostics?: boolean;
}

interface UseIntegrationSummaryReturn {
  data: IntegrationSummary[];
  isLoading: boolean;
  error: string | null;
  statusCounts: IntegrationStatusCounts;
  refetch: () => Promise<void>;
  testConnection: (integrationId: string) => Promise<boolean>;
  toggleActive: (integrationId: string, currentState: boolean) => Promise<boolean>;
}

export function useIntegrationSummary(
  options: UseIntegrationSummaryOptions = {}
): UseIntegrationSummaryReturn {
  const { statusFilter = 'all', platformFilter = 'all', searchQuery = '', includeDiagnostics = true } = options;
  
  const [data, setData] = useState<IntegrationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<IntegrationStatusCounts>({
    needsAttention: 0,
    healthy: 0,
    noSetup: 0,
    untested: 0,
  });

  const fetchDiagnostics = useCallback(async (orgIds: string[]): Promise<{
    webhookStats: Map<string, WebhookStats>;
    dataFreshness: Map<string, DataFreshness>;
  }> => {
    const webhookStats = new Map<string, WebhookStats>();
    const dataFreshness = new Map<string, DataFreshness>();

    if (orgIds.length === 0) return { webhookStats, dataFreshness };

    try {
      // Fetch webhook stats
      const { data: webhookData, error: webhookError } = await supabase
        .rpc('get_org_webhook_stats', { org_ids: orgIds });
      
      if (!webhookError && webhookData) {
        webhookData.forEach((row: any) => {
          webhookStats.set(row.org_id, {
            org_id: row.org_id,
            total_events: row.total_events || 0,
            failures: row.failures || 0,
            last_error: row.last_error,
            last_failure_at: row.last_failure_at,
            failure_rate: row.failure_rate || 0,
          });
        });
      }

      // Fetch data freshness
      const { data: freshnessData, error: freshnessError } = await supabase
        .rpc('get_org_data_freshness', { org_ids: orgIds });
      
      if (!freshnessError && freshnessData) {
        freshnessData.forEach((row: any) => {
          dataFreshness.set(row.org_id, {
            org_id: row.org_id,
            last_transaction_at: row.last_transaction_at,
            days_stale: row.days_stale,
            transaction_count_7d: row.transaction_count_7d || 0,
          });
        });
      }
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    }

    return { webhookStats, dataFreshness };
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch from the view
      const { data: summaryData, error: fetchError } = await supabase
        .from('v_integration_summary')
        .select('*');

      if (fetchError) throw fetchError;

      // Parse the integrations JSON and type it properly
      let typedData: IntegrationSummary[] = (summaryData || []).map((row: any) => ({
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        organization_slug: row.organization_slug,
        org_is_active: row.org_is_active,
        integrations: (row.integrations || []) as IntegrationDetail[],
        total_count: row.total_count || 0,
        healthy_count: row.healthy_count || 0,
        error_count: row.error_count || 0,
        disabled_count: row.disabled_count || 0,
        untested_count: row.untested_count || 0,
        health_status: row.health_status as IntegrationHealthStatus,
      }));

      // Fetch diagnostics if enabled
      if (includeDiagnostics) {
        const orgIds = typedData.map(d => d.organization_id);
        const { webhookStats, dataFreshness } = await fetchDiagnostics(orgIds);

        // Enrich with diagnostics
        typedData = typedData.map(summary => ({
          ...summary,
          diagnostics: {
            webhookStats: webhookStats.get(summary.organization_id),
            dataFreshness: dataFreshness.get(summary.organization_id),
          },
        }));
      }

      // Calculate status counts from unfiltered data
      const counts: IntegrationStatusCounts = {
        needsAttention: typedData.filter(d => d.health_status === 'needs_attention').length,
        healthy: typedData.filter(d => d.health_status === 'healthy').length,
        noSetup: typedData.filter(d => d.health_status === 'no_setup').length,
        untested: typedData.filter(d => d.health_status === 'untested').length,
      };
      setStatusCounts(counts);

      // Apply filters
      let filtered = typedData;

      // Status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter(d => d.health_status === statusFilter);
      }

      // Platform filter
      if (platformFilter !== 'all') {
        filtered = filtered.filter(d => 
          d.integrations.some(i => i.platform === platformFilter)
        );
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(d => 
          d.organization_name.toLowerCase().includes(query) ||
          d.organization_slug.toLowerCase().includes(query)
        );
      }

      setData(filtered);
    } catch (err) {
      console.error('Error fetching integration summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, platformFilter, searchQuery, includeDiagnostics, fetchDiagnostics]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const testConnection = useCallback(async (integrationId: string): Promise<boolean> => {
    try {
      // Simulate connection test (in real implementation, this would call an edge function)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const success = Math.random() > 0.2; // 80% success rate for demo
      
      await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: success ? 'success' : 'failed',
          last_test_error: success ? null : 'Connection timeout',
        })
        .eq('id', integrationId);

      await fetchData();
      return success;
    } catch (err) {
      console.error('Error testing connection:', err);
      return false;
    }
  }, [fetchData]);

  const toggleActive = useCallback(async (integrationId: string, currentState: boolean): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('client_api_credentials')
        .update({ is_active: !currentState })
        .eq('id', integrationId);

      if (updateError) throw updateError;
      
      await fetchData();
      return true;
    } catch (err) {
      console.error('Error toggling integration:', err);
      return false;
    }
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    statusCounts,
    refetch: fetchData,
    testConnection,
    toggleActive,
  };
}
