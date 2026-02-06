import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

/**
 * Maps data sources to the TanStack Query keys they affect.
 * When a source syncs successfully, all related caches are invalidated.
 */
const SOURCE_QUERY_KEYS: Record<string, string[][]> = {
  meta: [
    ['meta'],
    ['meta-metrics'],
    ['single-day-meta'],
    ['creative-intelligence'],
    ['hourly-metrics'],
    ['adPerformance'],
    ['actblue-metrics'],
    ['channel-spend'],
    ['dashboard-sparkline'],
  ],
  actblue_webhook: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
    ['hourly-metrics'],
    ['kpis'],
    ['actblue-metrics'],
    ['channel-spend'],
    ['dashboard-sparkline'],
  ],
  actblue_csv: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
    ['kpis'],
    ['actblue-metrics'],
    ['dashboard-sparkline'],
  ],
  switchboard: [
    ['sms'],
    ['channels'],
    ['actblue-metrics'],
    ['channel-spend'],
    ['dashboard-sparkline'],
  ],
};

/**
 * Human-readable labels for data sources
 */
const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  actblue_webhook: 'ActBlue',
  actblue_csv: 'ActBlue CSV',
  switchboard: 'SMS',
};

/**
 * Invalidates all query caches related to a specific data source
 */
async function invalidateCachesForSource(
  queryClient: QueryClient,
  source: string
): Promise<void> {
  const keys = SOURCE_QUERY_KEYS[source] || [];

  // Always invalidate dashboard summary regardless of source
  await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

  // Invalidate source-specific keys in parallel
  await Promise.all(
    keys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
  );

  logger.info(`[AutoRefresh] Invalidated caches for source: ${source}`, {
    keysInvalidated: ['dashboard', ...keys.map((k) => k.join('/'))],
  });
}

/**
 * Cooldown period between refreshes to prevent rapid-fire invalidations
 * when multiple sources sync simultaneously
 */
const REFRESH_COOLDOWN_MS = 5000;

/**
 * Automatically invalidates dashboard caches when backend syncs complete.
 * 
 * This hook bridges the gap between scheduled backend syncs and client-side
 * data freshness. When the `data_freshness` table is updated with a successful
 * sync, this hook:
 * 
 * 1. Detects the update via Supabase Realtime
 * 2. Invalidates all related TanStack Query caches
 * 3. Shows a success toast to inform the user
 * 
 * The result is that all dashboard sections automatically refresh when
 * backend syncs complete, ensuring users always see fresh data.
 * 
 * @param organizationId - The current organization's ID to filter updates
 */
export function useAutoRefreshOnSync(organizationId: string | undefined): void {
  const queryClient = useQueryClient();
  
  // Track last sync timestamps to prevent duplicate refreshes
  const lastSyncRef = useRef<Record<string, string>>({});
  
  // Track last refresh time for cooldown
  const lastRefreshTimeRef = useRef<number>(0);
  
  // Queue sources that arrive during cooldown
  const pendingSourcesRef = useRef<Set<string>>(new Set());
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Process a batch of pending sources after cooldown
   */
  const processPendingSources = useCallback(async () => {
    const sources = Array.from(pendingSourcesRef.current);
    pendingSourcesRef.current.clear();
    cooldownTimerRef.current = null;

    if (sources.length === 0) return;

    // Invalidate all affected caches
    for (const source of sources) {
      await invalidateCachesForSource(queryClient, source);
    }

    // Show a single toast for all sources
    const labels = sources
      .map((s) => SOURCE_LABELS[s] || s)
      .join(', ');
    
    toast.success(`${labels} data updated`, {
      duration: 3000,
      id: 'auto-refresh-sync', // Prevent duplicate toasts
    });

    lastRefreshTimeRef.current = Date.now();
  }, [queryClient]);

  useEffect(() => {
    if (!organizationId) return;

    logger.info(`[AutoRefresh] Setting up realtime subscription for org: ${organizationId}`);

    const channel = supabase
      .channel(`auto-refresh-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'data_freshness',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          const newRecord = payload.new as {
            source: string;
            last_synced_at: string;
            last_sync_status: string;
          };

          const { source, last_synced_at, last_sync_status } = newRecord;

          // Only react to successful syncs
          if (last_sync_status !== 'success') {
            logger.debug(`[AutoRefresh] Ignoring non-success sync for ${source}: ${last_sync_status}`);
            return;
          }

          // Prevent duplicate refreshes for the same sync event
          if (lastSyncRef.current[source] === last_synced_at) {
            logger.debug(`[AutoRefresh] Duplicate sync event for ${source}, skipping`);
            return;
          }
          lastSyncRef.current[source] = last_synced_at;

          logger.info(`[AutoRefresh] Detected successful sync for ${source}`, {
            last_synced_at,
          });

          // Add source to pending queue
          pendingSourcesRef.current.add(source);

          // Check if we're within cooldown period
          const now = Date.now();
          const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

          if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
            // We're in cooldown - schedule processing if not already scheduled
            if (!cooldownTimerRef.current) {
              const remainingCooldown = REFRESH_COOLDOWN_MS - timeSinceLastRefresh;
              cooldownTimerRef.current = setTimeout(
                processPendingSources,
                remainingCooldown
              );
            }
          } else {
            // Not in cooldown - process immediately
            processPendingSources();
          }
        }
      )
      .subscribe((status) => {
        logger.debug(`[AutoRefresh] Subscription status: ${status}`);
      });

    return () => {
      logger.info(`[AutoRefresh] Cleaning up subscription for org: ${organizationId}`);
      supabase.removeChannel(channel);
      
      // Clear any pending timer
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [organizationId, queryClient, processPendingSources]);
}
