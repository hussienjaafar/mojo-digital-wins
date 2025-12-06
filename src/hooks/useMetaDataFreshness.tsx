import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MetaDataFreshness {
  lastSyncAt: Date | null;
  lastSyncStatus: 'success' | 'success_no_data' | 'error' | 'pending' | null;
  latestDataDate: string | null;
  dataLagDays: number;
  lagReason: string;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  metaApiLatencyHours: number | null;
  freshnessMessage: string | null;
}

export interface SyncResult {
  success: boolean;
  latestDataDate: string | null;
  dataLagDays: number;
  lagReason: string;
  insightRecords: number;
  campaignsWithData: number;
  campaignsWithoutData: number;
  message: string;
}

/**
 * Hook to track Meta Ads data freshness and sync status
 * 
 * Meta API has a typical 24-48 hour data processing delay.
 * This hook helps users understand:
 * - When data was last synced
 * - How current the data actually is
 * - Whether the delay is normal or indicates an issue
 */
export function useMetaDataFreshness(organizationId: string) {
  const [freshness, setFreshness] = useState<MetaDataFreshness>({
    lastSyncAt: null,
    lastSyncStatus: null,
    latestDataDate: null,
    dataLagDays: 0,
    lagReason: '',
    isLoading: true,
    isSyncing: false,
    syncError: null,
    metaApiLatencyHours: null,
    freshnessMessage: null,
  });

  // Fetch current sync status from credentials table
  const fetchFreshnessStatus = useCallback(async () => {
    if (!organizationId) return;

    try {
      // Get sync status from credentials
      const { data: credData, error: credError } = await supabase
        .from('client_api_credentials')
        .select('last_sync_at, last_sync_status')
        .eq('organization_id', organizationId)
        .eq('platform', 'meta')
        .eq('is_active', true)
        .single();

      if (credError) {
        logger.warn('Could not fetch Meta credentials status', credError);
      }

      // Get latest data date from metrics table
      const { data: metricsData, error: metricsError } = await supabase
        .from('meta_ad_metrics')
        .select('date, synced_at')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (metricsError && metricsError.code !== 'PGRST116') {
        logger.warn('Could not fetch latest metrics date', metricsError);
      }

      const latestDataDate = metricsData?.date || null;
      
      // Calculate data lag
      let dataLagDays = 0;
      let lagReason = '';
      
      if (latestDataDate) {
        const today = new Date();
        const latestDate = new Date(latestDataDate);
        dataLagDays = Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dataLagDays <= 2) {
          lagReason = 'Data is current (within normal Meta API delay)';
        } else if (dataLagDays <= 4) {
          lagReason = 'Data is slightly behind - normal for weekends or low activity periods';
        } else {
          lagReason = 'Data may be stale - consider triggering a sync';
        }
      } else {
        lagReason = 'No data available - sync may be needed';
      }

      setFreshness(prev => ({
        ...prev,
        lastSyncAt: credData?.last_sync_at ? new Date(credData.last_sync_at) : null,
        lastSyncStatus: credData?.last_sync_status as MetaDataFreshness['lastSyncStatus'],
        latestDataDate,
        dataLagDays,
        lagReason,
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Error fetching Meta data freshness', error);
      setFreshness(prev => ({ ...prev, isLoading: false }));
    }
  }, [organizationId]);

  // Trigger a sync
  const triggerSync = useCallback(async (startDate?: string, endDate?: string): Promise<SyncResult> => {
    if (!organizationId) {
      return {
        success: false,
        latestDataDate: null,
        dataLagDays: 0,
        lagReason: 'No organization ID',
        insightRecords: 0,
        campaignsWithData: 0,
        campaignsWithoutData: 0,
        message: 'Organization ID is required'
      };
    }

    setFreshness(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('sync-meta-ads', {
        body: {
          organization_id: organizationId,
          start_date: startDate,
          end_date: endDate,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      const result = response.data;

      // Update freshness state with sync results
      setFreshness(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
        lastSyncStatus: result.insight_records > 0 ? 'success' : 'success_no_data',
        latestDataDate: result.data_freshness?.latest_data_date || null,
        dataLagDays: result.data_freshness?.data_lag_days || 0,
        lagReason: result.data_freshness?.lag_reason || '',
        metaApiLatencyHours: result.data_freshness?.meta_api_latency_hours || null,
        freshnessMessage: result.data_freshness?.freshness_message || null,
      }));

      return {
        success: true,
        latestDataDate: result.data_freshness?.latest_data_date || null,
        dataLagDays: result.data_freshness?.data_lag_days || 0,
        lagReason: result.data_freshness?.lag_reason || '',
        insightRecords: result.insight_records || 0,
        campaignsWithData: result.data_freshness?.campaigns_with_data || 0,
        campaignsWithoutData: result.data_freshness?.campaigns_without_data || 0,
        message: result.message || 'Sync completed'
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Sync failed';
      setFreshness(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncError: errorMessage,
        lastSyncStatus: 'error'
      }));

      return {
        success: false,
        latestDataDate: null,
        dataLagDays: 0,
        lagReason: errorMessage,
        insightRecords: 0,
        campaignsWithData: 0,
        campaignsWithoutData: 0,
        message: errorMessage
      };
    }
  }, [organizationId]);

  // Check freshness without syncing (lightweight call)
  const checkFreshnessOnly = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('sync-meta-ads', {
        body: {
          organization_id: organizationId,
          check_freshness_only: true,
        }
      });

      if (!response.error && response.data) {
        setFreshness(prev => ({
          ...prev,
          metaApiLatencyHours: response.data.latency_hours,
          freshnessMessage: response.data.message,
        }));
      }
    } catch (error) {
      logger.error('Error checking Meta data freshness', error);
    }
  }, [organizationId]);

  // Load initial status
  useEffect(() => {
    fetchFreshnessStatus();
  }, [fetchFreshnessStatus]);

  return {
    ...freshness,
    refresh: fetchFreshnessStatus,
    triggerSync,
    checkFreshnessOnly,
  };
}
