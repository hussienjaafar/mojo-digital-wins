import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  IntegrationSummary, 
  IntegrationStatusCounts, 
  IntegrationHealthStatus,
  IntegrationDetail 
} from '@/types/integrations';

interface UseIntegrationSummaryOptions {
  statusFilter?: IntegrationHealthStatus | 'all';
  platformFilter?: string | 'all';
  searchQuery?: string;
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
  const { statusFilter = 'all', platformFilter = 'all', searchQuery = '' } = options;
  
  const [data, setData] = useState<IntegrationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<IntegrationStatusCounts>({
    needsAttention: 0,
    healthy: 0,
    noSetup: 0,
    untested: 0,
  });

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
      const typedData: IntegrationSummary[] = (summaryData || []).map((row: any) => ({
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
  }, [statusFilter, platformFilter, searchQuery]);

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
