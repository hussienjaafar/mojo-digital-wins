import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface WatchlistEntity {
  id: string;
  entity_name: string;
  entity_type: EntityType;
  aliases: string[];
  alert_threshold: number;
  sentiment_alerts_enabled: boolean;
  sentiment_alert?: boolean;
  relevance_score: number;
  created_at: string;
  is_active: boolean;
}

export type EntityType =
  | "organization"
  | "person"
  | "topic"
  | "location"
  | "opposition"
  | "issue";

export interface WatchlistStats {
  totalEntities: number;
  sentimentAlertsEnabled: number;
  averageThreshold: number;
  byType: Record<EntityType, number>;
}

export interface WatchlistData {
  entities: WatchlistEntity[];
  stats: WatchlistStats;
  fetchedAt: string;
}

export interface WatchlistQueryResult {
  data: WatchlistData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
}

export interface AddEntityInput {
  entity_name: string;
  entity_type: EntityType;
  aliases: string[];
  alert_threshold: number;
  sentiment_alerts_enabled: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

export const watchlistKeys = {
  all: ["watchlist"] as const,
  list: (orgId: string) => [...watchlistKeys.all, "list", orgId] as const,
  entity: (orgId: string, entityId: string) =>
    [...watchlistKeys.all, "entity", orgId, entityId] as const,
};

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchWatchlist(organizationId: string): Promise<WatchlistData> {
  const { data, error } = await supabase
    .from("entity_watchlist")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[useWatchlistQuery] Fetch error:", error);
    throw error;
  }

  const entities = ((data || []) as unknown as any[]).map((e) => ({
    ...e,
    sentiment_alerts_enabled: e.sentiment_alerts_enabled ?? e.sentiment_alert ?? false,
  })) as WatchlistEntity[];

  // Calculate aggregated stats
  const stats: WatchlistStats = {
    totalEntities: entities.length,
    sentimentAlertsEnabled: entities.filter((e) => e.sentiment_alerts_enabled).length,
    averageThreshold:
      entities.length > 0
        ? Math.round(
            entities.reduce((sum, e) => sum + e.alert_threshold, 0) / entities.length
          )
        : 0,
    byType: {
      organization: 0,
      person: 0,
      topic: 0,
      location: 0,
      opposition: 0,
      issue: 0,
    },
  };

  // Count by type
  entities.forEach((entity) => {
    const type = entity.entity_type as EntityType;
    if (type in stats.byType) {
      stats.byType[type]++;
    }
  });

  return {
    entities,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Query Hook
// ============================================================================

export function useWatchlistQuery(
  organizationId: string | undefined
): WatchlistQueryResult {
  const query = useQuery({
    queryKey: watchlistKeys.list(organizationId || ""),
    queryFn: () => fetchWatchlist(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds - watchlist changes should reflect quickly
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useAddWatchlistEntity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddEntityInput) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("entity_watchlist")
        .insert({
          organization_id: organizationId,
          entity_name: input.entity_name,
          entity_type: input.entity_type,
          aliases: input.aliases,
          alert_threshold: input.alert_threshold,
          sentiment_alerts_enabled: input.sentiment_alerts_enabled,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: watchlistKeys.list(organizationId || ""),
      });
    },
  });
}

export function useDeleteWatchlistEntity(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityId: string) => {
      const { error } = await supabase
        .from("entity_watchlist")
        .update({ is_active: false })
        .eq("id", entityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: watchlistKeys.list(organizationId || ""),
      });
    },
  });
}

export function useToggleSentimentAlerts(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      enabled,
    }: {
      entityId: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("entity_watchlist")
        .update({ sentiment_alert: enabled } as any)
        .eq("id", entityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: watchlistKeys.list(organizationId || ""),
      });
    },
  });
}

export function useUpdateAlertThreshold(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      threshold,
    }: {
      entityId: string;
      threshold: number;
    }) => {
      const { error } = await supabase
        .from("entity_watchlist")
        .update({ alert_threshold: threshold })
        .eq("id", entityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: watchlistKeys.list(organizationId || ""),
      });
    },
  });
}
