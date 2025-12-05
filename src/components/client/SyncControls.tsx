import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, MessageSquare, TrendingUp, Heart, History } from "lucide-react";
import { logger } from "@/lib/logger";

type Props = {
  organizationId: string;
};

const SyncControls = ({ organizationId }: Props) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const syncMetaAds = async () => {
    setSyncing({ ...syncing, meta: true });
    try {
      const { error } = await (supabase as any).functions.invoke('sync-meta-ads', {
        body: { organization_id: organizationId }
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

    // Reload page to show updated data
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>
          Manually sync data from connected platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Button
            onClick={syncMetaAds}
            disabled={syncing.meta}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <DollarSign className="w-6 h-6" />
            <span>Sync Meta Ads</span>
            {syncing.meta && <RefreshCw className="w-4 h-4 animate-spin" />}
          </Button>

          <Button
            onClick={syncSwitchboard}
            disabled={syncing.sms}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <MessageSquare className="w-6 h-6" />
            <span>Sync SMS</span>
            {syncing.sms && <RefreshCw className="w-4 h-4 animate-spin" />}
          </Button>

          <Button
            onClick={() => syncActBlue(false)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Heart className="w-6 h-6" />
            <span>Sync ActBlue</span>
            {syncing.actblue && <RefreshCw className="w-4 h-4 animate-spin" />}
          </Button>

          <Button
            onClick={() => syncActBlue(true)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-dashed"
          >
            <History className="w-6 h-6" />
            <span>Backfill ActBlue</span>
            {syncing.actblueBackfill && <RefreshCw className="w-4 h-4 animate-spin" />}
          </Button>

          <Button
            onClick={calculateROI}
            disabled={syncing.roi}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <TrendingUp className="w-6 h-6" />
            <span>Calculate ROI</span>
            {syncing.roi && <RefreshCw className="w-4 h-4 animate-spin" />}
          </Button>

          <Button
            onClick={syncAll}
            disabled={Object.values(syncing).some(Boolean)}
            className="h-auto flex-col gap-2 py-4"
          >
            <RefreshCw className="w-6 h-6" />
            <span>Sync All</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SyncControls;
