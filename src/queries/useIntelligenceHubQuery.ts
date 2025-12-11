import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntelligenceHubStats {
  watchlistCount: number;
  trendingTopics: number;
  criticalAlerts: number;
  suggestedActions: number;
  opportunities: number;
  latestTrend?: string;
}

async function fetchIntelligenceHubStats(organizationId: string): Promise<IntelligenceHubStats> {
  const sb = supabase as any;

  const [watchlistResult, trendsResult, alertsResult, actionsResult, opportunitiesResult] = await Promise.all([
    sb
      .from('entity_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    sb
      .from('bluesky_trends')
      .select('topic')
      .eq('is_trending', true)
      .order('velocity', { ascending: false })
      .limit(1),
    sb
      .from('client_entity_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_read', false)
      .in('severity', ['critical', 'high']),
    sb
      .from('suggested_actions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'pending'),
    sb
      .from('fundraising_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true),
  ]);

  return {
    watchlistCount: watchlistResult.count || 0,
    trendingTopics: trendsResult.data?.length || 0,
    criticalAlerts: alertsResult.count || 0,
    suggestedActions: actionsResult.count || 0,
    opportunities: opportunitiesResult.count || 0,
    latestTrend: trendsResult.data?.[0]?.topic,
  };
}

export const hubKeys = {
  all: ['hub'] as const,
  stats: (orgId: string) => [...hubKeys.all, 'stats', orgId] as const,
};

export function useIntelligenceHubQuery(organizationId: string) {
  return useQuery({
    queryKey: hubKeys.stats(organizationId),
    queryFn: () => fetchIntelligenceHubStats(organizationId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!organizationId,
  });
}
