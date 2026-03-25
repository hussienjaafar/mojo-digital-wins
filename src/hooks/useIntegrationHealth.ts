import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookHealthStats {
  recentSuccessCount: number;
  recentFailureCount: number;
  failureRate: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  recentErrors: string[];
}

export interface SyncHealthStats {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncSuccessRate: number;
  recentSyncCount: number;
}

export interface DataFreshnessStats {
  lastTransactionAt: string | null;
  transactionsLast7Days: number;
  daysStale: number;
  isStale: boolean;
}

export interface CredentialHealthStatus {
  field: string;
  configured: boolean;
  hint?: string; // Last 3-4 chars for verification
}

export interface IntegrationHealth {
  platform: string;
  organizationId: string;
  organizationName: string;
  credentialId: string;
  isActive: boolean;
  
  // Credential configuration status
  credentialStatus: CredentialHealthStatus[];
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  
  // Webhook health (for platforms that use webhooks)
  webhookHealth: WebhookHealthStats | null;
  
  // Sync health (for platforms with CSV/API sync)
  syncHealth: SyncHealthStats | null;
  
  // Data freshness
  dataFreshness: DataFreshnessStats | null;
  
  // Overall health score (0-100)
  healthScore: number;
  
  // Recommendations
  recommendations: string[];
  
  // Last updated
  checkedAt: string;
}

interface UseIntegrationHealthOptions {
  organizationId?: string;
  platform?: string;
  enabled?: boolean;
}

export function useIntegrationHealth(options: UseIntegrationHealthOptions = {}) {
  const { organizationId, platform, enabled = true } = options;

  return useQuery({
    queryKey: ['integration-health', organizationId, platform],
    queryFn: async (): Promise<IntegrationHealth[]> => {
      const { data, error } = await supabase.functions.invoke('check-integration-health', {
        body: {
          organization_id: organizationId,
          platform,
        },
      });

      if (error) {
        console.error('[useIntegrationHealth] Error:', error);
        throw error;
      }

      return data?.results || [];
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook to get health for a specific organization
export function useOrganizationIntegrationHealth(organizationId: string | null | undefined) {
  return useIntegrationHealth({
    organizationId: organizationId || undefined,
    enabled: !!organizationId,
  });
}
