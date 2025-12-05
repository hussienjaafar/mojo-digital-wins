import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, MessageSquare, TrendingUp, Heart } from "lucide-react";
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

  const syncActBlue = async () => {
    setSyncing({ ...syncing, actblue: true });
    try {
      const { error } = await (supabase as any).functions.invoke('sync-actblue-csv', {
        body: { organization_id: organizationId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "ActBlue sync completed successfully",
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
      setSyncing({ ...syncing, actblue: false });
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
      syncActBlue(),
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            onClick={syncActBlue}
            disabled={syncing.actblue}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            <Heart className="w-6 h-6" />
            <span>Sync ActBlue</span>
            {syncing.actblue && <RefreshCw className="w-4 h-4 animate-spin" />}
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
