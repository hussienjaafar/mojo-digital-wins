import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { OnboardingEffectiveStatus } from '@/components/admin/clients/OnboardingStatusBadge';

export interface ClientOnboardingSummary {
  organization_id: string;
  organization_name: string;
  slug: string;
  is_active: boolean;
  org_created_at: string;
  current_step: number;
  completed_steps: number[];
  onboarding_status: string;
  blocking_reason: string | null;
  onboarding_updated_at: string | null;
  user_count: number;
  integration_count: number;
  error_count: number;
  has_profile: boolean;
  effective_status: OnboardingEffectiveStatus;
  progress_percentage: number;
}

export function useClientOnboardingSummary() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['client-onboarding-summary'],
    queryFn: async (): Promise<ClientOnboardingSummary[]> => {
      const { data, error } = await supabase
        .from('org_onboarding_summary')
        .select('*');

      if (error) {
        console.error('Error fetching onboarding summary:', error);
        throw error;
      }

      // Transform the data to ensure proper typing
      return (data || []).map((row: any) => ({
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        slug: row.slug,
        is_active: row.is_active,
        org_created_at: row.org_created_at,
        current_step: row.current_step || 1,
        completed_steps: Array.isArray(row.completed_steps) 
          ? row.completed_steps 
          : [],
        onboarding_status: row.onboarding_status || 'not_started',
        blocking_reason: row.blocking_reason,
        onboarding_updated_at: row.onboarding_updated_at,
        user_count: Number(row.user_count) || 0,
        integration_count: Number(row.integration_count) || 0,
        error_count: Number(row.error_count) || 0,
        has_profile: Boolean(row.has_profile),
        effective_status: (row.effective_status || 'not_started') as OnboardingEffectiveStatus,
        progress_percentage: Number(row.progress_percentage) || 0,
      }));
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Set up realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('onboarding-summary-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'org_onboarding_state',
        },
        () => {
          // Invalidate and refetch when onboarding state changes
          queryClient.invalidateQueries({ queryKey: ['client-onboarding-summary'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_organizations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['client-onboarding-summary'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Aggregated stats for admin dashboard
export function useOnboardingStats() {
  const { data: summaries, isLoading } = useClientOnboardingSummary();

  const stats = {
    total: summaries?.length || 0,
    notStarted: summaries?.filter(s => s.effective_status === 'not_started').length || 0,
    inProgress: summaries?.filter(s => s.effective_status === 'in_progress').length || 0,
    blocked: summaries?.filter(s => s.effective_status === 'blocked').length || 0,
    completed: summaries?.filter(s => s.effective_status === 'completed').length || 0,
    needsAttention: summaries?.filter(s => 
      s.effective_status === 'blocked' || 
      s.effective_status === 'not_started' ||
      s.error_count > 0
    ).length || 0,
  };

  return { stats, isLoading };
}

// Single client lookup
export function useClientOnboardingStatus(organizationId: string | undefined) {
  const { data: summaries, isLoading, error } = useClientOnboardingSummary();

  const summary = summaries?.find(s => s.organization_id === organizationId);

  return {
    summary,
    isLoading,
    error,
  };
}
