import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

/**
 * Staleness thresholds (in hours) for triggering external syncs
 * These are more aggressive than the SLA thresholds to ensure freshness
 */
const SYNC_THRESHOLDS = {
  meta: 4,        // Sync if Meta data is >4 hours old
  actblue: 2,     // Sync if ActBlue is >2 hours old  
  switchboard: 4, // Sync if SMS is >4 hours old
} as const;

export type SyncSource = 'meta' | 'actblue' | 'switchboard';

export interface SmartRefreshOptions {
  organizationId: string;
  onComplete?: () => void;
}

export interface SmartRefreshResult {
  handleSmartRefresh: (force?: boolean) => Promise<void>;
  isRefreshing: boolean;
  isSyncing: Record<SyncSource, boolean>;
  syncingSources: SyncSource[];
  staleSources: SyncSource[];
}

/**
 * Smart refresh hook that checks data freshness and conditionally triggers
 * external platform syncs only when data is stale.
 * 
 * - Always invalidates cache first (instant UI refresh)
 * - Checks freshness of each data source
 * - Only triggers external syncs for stale sources
 * - Shows appropriate user feedback
 */
export function useSmartRefresh({ 
  organizationId, 
  onComplete 
}: SmartRefreshOptions): SmartRefreshResult {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState<Record<SyncSource, boolean>>({
    meta: false,
    actblue: false,
    switchboard: false,
  });
  const [staleSources, setStaleSources] = useState<SyncSource[]>([]);

  /**
   * Check freshness of each data source by querying latest records
   */
  const checkFreshness = useCallback(async (): Promise<SyncSource[]> => {
    const stale: SyncSource[] = [];
    const now = new Date();
    
    try {
      // Check Meta freshness - look at most recent sync time
      const { data: metaData } = await supabase
        .from('meta_ad_metrics')
        .select('synced_at')
        .eq('organization_id', organizationId)
        .order('synced_at', { ascending: false })
        .limit(1);
      
      if (metaData?.[0]?.synced_at) {
        const hoursOld = differenceInHours(now, new Date(metaData[0].synced_at));
        if (hoursOld > SYNC_THRESHOLDS.meta) {
          stale.push('meta');
        }
      } else {
        // No data = consider stale
        stale.push('meta');
      }

      // Check ActBlue freshness - look at most recent transaction
      const { data: actblueData } = await supabase
        .from('actblue_transactions_secure')
        .select('created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (actblueData?.[0]?.created_at) {
        const hoursOld = differenceInHours(now, new Date(actblueData[0].created_at));
        if (hoursOld > SYNC_THRESHOLDS.actblue) {
          stale.push('actblue');
        }
      }
      // Don't mark actblue as stale if no data - might just not have any transactions

      // Check Switchboard/SMS freshness - look at most recent campaign created_at
      const { data: smsData } = await supabase
        .from('sms_campaigns')
        .select('created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (smsData?.[0]?.created_at) {
        const hoursOld = differenceInHours(now, new Date(smsData[0].created_at));
        if (hoursOld > SYNC_THRESHOLDS.switchboard) {
          stale.push('switchboard');
        }
      }
      // Don't mark switchboard as stale if no data - might not use SMS

    } catch (error) {
      logger.warn('Error checking data freshness', error);
      // On error, don't trigger syncs - just refresh cache
    }
    
    return stale;
  }, [organizationId]);

  /**
   * Trigger sync for a specific source
   */
  const triggerSync = useCallback(async (source: SyncSource): Promise<void> => {
    try {
      switch (source) {
        case 'meta':
          await supabase.functions.invoke('sync-meta-ads', {
            body: { organization_id: organizationId }
          });
          break;
        case 'actblue':
          await supabase.functions.invoke('reconcile-actblue-data', {
            body: { organization_id: organizationId }
          });
          break;
        case 'switchboard':
          await supabase.functions.invoke('sync-switchboard-sms', {
            body: { organization_id: organizationId }
          });
          break;
      }
    } catch (error) {
      logger.warn(`Failed to sync ${source}`, error);
      throw error;
    }
  }, [organizationId]);

  /**
   * Main smart refresh handler
   * @param force - If true, sync all sources regardless of freshness
   */
  const handleSmartRefresh = useCallback(async (force = false) => {
    if (!organizationId) return;
    
    setIsRefreshing(true);
    logger.info('Smart refresh triggered', { organizationId, force });
    
    try {
      // Step 1: Always invalidate cache first (instant UI refresh)
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard'],
        refetchType: 'all'
      });
      
      // Also invalidate related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['actblue'] }),
        queryClient.invalidateQueries({ queryKey: ['meta-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['sms'] }),
        queryClient.invalidateQueries({ queryKey: ['attribution'] }),
        queryClient.invalidateQueries({ queryKey: ['recurring-health'] }),
      ]);
      
      // Step 2: Check what's stale (unless forcing)
      const stale = force 
        ? ['meta', 'actblue', 'switchboard'] as SyncSource[]
        : await checkFreshness();
      
      setStaleSources(stale);
      
      if (stale.length === 0) {
        toast.success('Data is fresh – no sync needed');
        onComplete?.();
        return;
      }
      
      // Step 3: Trigger syncs for stale sources
      const sourceLabels: Record<SyncSource, string> = {
        meta: 'Meta Ads',
        actblue: 'ActBlue',
        switchboard: 'SMS',
      };
      
      const staleLabels = stale.map(s => sourceLabels[s]).join(', ');
      toast.info(`Syncing ${staleLabels}...`, { id: 'smart-refresh' });
      
      const syncPromises: Promise<void>[] = [];
      
      for (const source of stale) {
        setIsSyncing(prev => ({ ...prev, [source]: true }));
        syncPromises.push(
          triggerSync(source)
            .catch(err => {
              logger.warn(`Sync failed for ${source}`, err);
              toast.error(`${sourceLabels[source]} sync failed`);
            })
            .finally(() => setIsSyncing(prev => ({ ...prev, [source]: false })))
        );
      }
      
      await Promise.allSettled(syncPromises);
      
      // Step 4: Refresh cache again with new data
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard'],
        refetchType: 'all'
      });
      
      toast.success('Smart refresh complete', { id: 'smart-refresh' });
      onComplete?.();
      
    } catch (error) {
      logger.error('Smart refresh failed', error);
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [organizationId, queryClient, checkFreshness, triggerSync, onComplete]);

  // Derive currently syncing sources list for UI
  const syncingSources = Object.entries(isSyncing)
    .filter(([, syncing]) => syncing)
    .map(([source]) => source as SyncSource);

  return { 
    handleSmartRefresh, 
    isRefreshing, 
    isSyncing, 
    syncingSources,
    staleSources 
  };
}
