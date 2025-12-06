import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, MessageSquare, TrendingUp, Heart, History, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

type Props = {
  organizationId: string;
  startDate?: string;
  endDate?: string;
};

type SyncStatus = {
  platform: string;
  lastSync: string | null;
  status: string | null;
};
const SyncControls = ({ organizationId, startDate, endDate }: Props) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadSyncStatuses();
  }, [organizationId]);

  const loadSyncStatuses = async () => {
    const { data } = await supabase
      .from('client_api_credentials')
      .select('platform, last_sync_at, last_sync_status')
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    
    if (data) {
      setSyncStatuses(data.map(c => ({
        platform: c.platform,
        lastSync: c.last_sync_at,
        status: c.last_sync_status
      })));
    }
  };

  const getSyncStatus = (platform: string) => {
    return syncStatuses.find(s => s.platform === platform);
  };

  const syncMetaAds = async () => {
    setSyncing({ ...syncing, meta: true });
    try {
      // Pass date range to ensure we fetch data for the visible period
      // Default to last 30 days if no dates provided
      const syncStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const syncEndDate = endDate || new Date().toISOString().split('T')[0];
      
      const { error } = await (supabase as any).functions.invoke('sync-meta-ads', {
        body: { 
          organization_id: organizationId,
          start_date: syncStartDate,
          end_date: syncEndDate
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Meta Ads sync completed successfully",
      });

      // Trigger ROI calculation
      await calculateROI();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sync Meta Ads",
        variant: "destructive",
      });
    } finally {
      setSyncing({ ...syncing, meta: false });
    }
  };

  const syncSwitchboard = async () => {
    setSyncing({ ...syncing, sms: true });
    try {
      const { data, error } = await (supabase as any).functions.invoke('sync-switchboard-sms', {
        body: { organization_id: organizationId }
      });

      if (error) throw error;

      // Check if API is not available (OneSwitchboard limitation)
      if (data && data.error && data.credentials_valid) {
        toast({
          title: "Switchboard API Not Available",
          description: "OneSwitchboard doesn't provide a public reporting API. Please export CSV reports from your dashboard manually.",
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Switchboard SMS sync completed successfully",
        });
        await calculateROI();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sync Switchboard SMS",
        variant: "destructive",
      });
    } finally {
      setSyncing({ ...syncing, sms: false });
    }
  };

  const syncActBlue = async (backfill = false) => {
    const syncKey = backfill ? 'actblueBackfill' : 'actblue';
    setSyncing({ ...syncing, [syncKey]: true });
    try {
      if (backfill) {
        toast({
          title: "Starting ActBlue Backfill",
          description: "Fetching 1 year of historical data. This may take a few minutes...",
        });
      }

      const { data, error } = await (supabase as any).functions.invoke('sync-actblue-csv', {
        body: { 
          organization_id: organizationId,
          mode: backfill ? 'backfill' : 'incremental'
        }
      });

      if (error) throw error;

      const inserted = data?.results?.[0]?.inserted || 0;
      const processed = data?.results?.[0]?.processed || 0;

      toast({
        title: "Success",
        description: backfill 
          ? `ActBlue backfill completed: ${inserted} new transactions from ${processed} processed`
          : `ActBlue sync completed: ${inserted} new transactions`,
      });

      // Trigger ROI calculation
      await calculateROI();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sync ActBlue",
        variant: "destructive",
      });
    } finally {
      setSyncing({ ...syncing, [syncKey]: false });
    }
  };

  const calculateROI = async () => {
    setSyncing({ ...syncing, roi: true });
    try {
      const { error } = await (supabase as any).functions.invoke('calculate-roi', {
        body: { organization_id: organizationId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "ROI calculation completed",
      });
    } catch (error: any) {
      logger.error('ROI calculation failed', error);
      // Don't show error to user as this is a background task
    } finally {
      setSyncing({ ...syncing, roi: false });
    }
  };

  const syncAll = async () => {
    toast({
      title: "Syncing All Sources",
      description: "This may take a few minutes...",
    });

    await Promise.all([
      syncMetaAds(),
      syncSwitchboard(),
      syncActBlue(false),
    ]);

    toast({
      title: "Complete",
      description: "All data sources synced successfully",
    });

    // Refresh sync statuses and trigger indicator refresh
    await loadSyncStatuses();
    setRefreshKey(prev => prev + 1);
  };

  const renderSyncStatusBadge = (platform: string) => {
    const status = getSyncStatus(platform);
    if (!status) return null;
    
    if (status.status === 'failed') {
      return (
        <Badge variant="destructive" className="text-[9px] gap-0.5 px-1">
          <AlertCircle className="h-2 w-2" />
          Failed
        </Badge>
      );
    }
    
    if (status.status === 'success' && status.lastSync) {
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 px-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-2 w-2" />
          {formatDistanceToNow(new Date(status.lastSync), { addSuffix: false })}
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Data Sync</CardTitle>
            <CardDescription>
              Manually sync data from connected platforms
            </CardDescription>
          </div>
          <DataFreshnessIndicator organizationId={organizationId} compact key={refreshKey} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Button
            onClick={syncMetaAds}
            disabled={syncing.meta}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 relative"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-xs">Sync Meta Ads</span>
            {syncing.meta ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              renderSyncStatusBadge('meta')
            )}
          </Button>

          <Button
            onClick={syncSwitchboard}
            disabled={syncing.sms}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 relative"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Sync SMS</span>
            {syncing.sms ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              renderSyncStatusBadge('switchboard')
            )}
          </Button>

          <Button
            onClick={() => syncActBlue(false)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 relative"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">Sync ActBlue</span>
            {syncing.actblue ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              renderSyncStatusBadge('actblue')
            )}
          </Button>

          <Button
            onClick={() => syncActBlue(true)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 border-dashed"
          >
            <History className="w-5 h-5" />
            <span className="text-xs">Backfill ActBlue</span>
            {syncing.actblueBackfill && <RefreshCw className="w-3 h-3 animate-spin" />}
          </Button>

          <Button
            onClick={calculateROI}
            disabled={syncing.roi}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">Calculate ROI</span>
            {syncing.roi && <RefreshCw className="w-3 h-3 animate-spin" />}
          </Button>

          <Button
            onClick={syncAll}
            disabled={Object.values(syncing).some(Boolean)}
            className="h-auto flex-col gap-1.5 py-3"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-xs">Sync All</span>
          </Button>
        </div>

        {/* Expanded Freshness View */}
        <div className="pt-4 border-t">
          <DataFreshnessIndicator organizationId={organizationId} key={`full-${refreshKey}`} />
        </div>
      </CardContent>
    </Card>
  );
};

export default SyncControls;
