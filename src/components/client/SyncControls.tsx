import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, MessageSquare, TrendingUp, Heart, History, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
} from "@/components/v3";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardKeys, metaKeys, smsKeys, donationKeys, channelKeys } from "@/queries/queryKeys";

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

// Animation variants for buttons
const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

// Container animation for staggered entry
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
};

// Spinner animation
const spinTransition = {
  repeat: Infinity,
  ease: "linear" as const,
  duration: 1,
};

const SyncControls = ({ organizationId, startDate, endDate }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  // Invalidate all dashboard-related queries
  const invalidateDashboardQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: channelKeys.all }),
    ]);
  };

  const syncMetaAds = async () => {
    setSyncing({ ...syncing, meta: true });
    try {
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

      // Invalidate Meta queries
      await queryClient.invalidateQueries({ queryKey: metaKeys.all });
      await invalidateDashboardQueries();
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
        // Invalidate SMS queries
        await queryClient.invalidateQueries({ queryKey: smsKeys.all });
        await invalidateDashboardQueries();
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

      const syncStartDate = backfill
        ? undefined
        : (startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const syncEndDate = backfill
        ? undefined
        : (endDate || new Date().toISOString().split('T')[0]);

      const { data, error } = await (supabase as any).functions.invoke('sync-actblue-csv', {
        body: {
          organization_id: organizationId,
          mode: backfill ? 'backfill' : 'incremental',
          start_date: syncStartDate,
          end_date: syncEndDate
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

      // Invalidate donation queries
      await queryClient.invalidateQueries({ queryKey: donationKeys.all });
      await invalidateDashboardQueries();
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

    await loadSyncStatuses();
    setRefreshKey(prev => prev + 1);
  };

  const renderSyncStatusBadge = (platform: string) => {
    const status = getSyncStatus(platform);
    if (!status) return null;

    if (status.status === 'failed') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Badge variant="destructive" className="text-[9px] gap-0.5 px-1.5 py-0.5">
            <AlertCircle className="h-2.5 w-2.5" />
            Failed
          </Badge>
        </motion.div>
      );
    }

    if (status.status === 'success' && status.lastSync) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Badge
            variant="outline"
            className="text-[9px] gap-0.5 px-1.5 py-0.5 bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]"
          >
            <CheckCircle className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(status.lastSync), { addSuffix: false })}
          </Badge>
        </motion.div>
      );
    }

    return null;
  };

  const SyncButton = ({
    onClick,
    disabled,
    syncing: isSyncing,
    icon: Icon,
    label,
    platform,
    variant = "outline",
    dashed = false,
    accent,
  }: {
    onClick: () => void;
    disabled: boolean;
    syncing: boolean;
    icon: typeof DollarSign;
    label: string;
    platform?: string;
    variant?: "outline" | "default";
    dashed?: boolean;
    accent?: "blue" | "purple" | "green" | "amber";
  }) => {
    const accentColors = {
      blue: "hover:border-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.05)]",
      purple: "hover:border-[hsl(var(--portal-accent-purple))] hover:bg-[hsl(var(--portal-accent-purple)/0.05)]",
      green: "hover:border-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.05)]",
      amber: "hover:border-[hsl(var(--portal-warning))] hover:bg-[hsl(var(--portal-warning)/0.05)]",
    };

    const iconColors = {
      blue: "text-[hsl(var(--portal-accent-blue))]",
      purple: "text-[hsl(var(--portal-accent-purple))]",
      green: "text-[hsl(var(--portal-success))]",
      amber: "text-[hsl(var(--portal-warning))]",
    };

    return (
      <motion.div
        variants={itemVariants}
        whileHover="hover"
        whileTap="tap"
        initial="idle"
        animate="idle"
      >
        <motion.div variants={buttonVariants}>
          <Button
            onClick={onClick}
            disabled={disabled}
            variant={variant}
            className={cn(
              "h-auto flex-col gap-2 py-4 px-3 relative w-full",
              "transition-all duration-200",
              "border-[hsl(var(--portal-border))]",
              dashed && "border-dashed",
              accent && accentColors[accent],
              variant === "default" && "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white border-transparent"
            )}
          >
            <AnimatePresence mode="wait">
              {isSyncing ? (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={spinTransition}
                >
                  <RefreshCw className={cn("w-5 h-5", accent ? iconColors[accent] : "")} />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon className={cn("w-5 h-5", accent && variant !== "default" ? iconColors[accent] : "")} />
                </motion.div>
              )}
            </AnimatePresence>
            <span className="text-xs font-medium">{label}</span>
            {platform && !isSyncing && renderSyncStatusBadge(platform)}
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <V3Card accent="blue">
      <V3CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Zap className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
            </motion.div>
            <div>
              <V3CardTitle>Data Sync</V3CardTitle>
              <V3CardDescription>
                Manually sync data from connected platforms
              </V3CardDescription>
            </div>
          </div>
          <DataFreshnessIndicator organizationId={organizationId} compact key={refreshKey} />
        </div>
      </V3CardHeader>
      <V3CardContent className="space-y-6">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <SyncButton
            onClick={syncMetaAds}
            disabled={syncing.meta}
            syncing={syncing.meta}
            icon={DollarSign}
            label="Sync Meta Ads"
            platform="meta"
            accent="blue"
          />

          <SyncButton
            onClick={syncSwitchboard}
            disabled={syncing.sms}
            syncing={syncing.sms}
            icon={MessageSquare}
            label="Sync SMS"
            platform="switchboard"
            accent="purple"
          />

          <SyncButton
            onClick={() => syncActBlue(false)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            syncing={syncing.actblue}
            icon={Heart}
            label="Sync ActBlue"
            platform="actblue"
            accent="green"
          />

          <SyncButton
            onClick={() => syncActBlue(true)}
            disabled={syncing.actblue || syncing.actblueBackfill}
            syncing={syncing.actblueBackfill}
            icon={History}
            label="Backfill ActBlue"
            accent="amber"
            dashed
          />

          <SyncButton
            onClick={calculateROI}
            disabled={syncing.roi}
            syncing={syncing.roi}
            icon={TrendingUp}
            label="Calculate ROI"
            accent="green"
          />

          <SyncButton
            onClick={syncAll}
            disabled={Object.values(syncing).some(Boolean)}
            syncing={Object.values(syncing).some(Boolean)}
            icon={RefreshCw}
            label="Sync All"
            variant="default"
          />
        </motion.div>

        {/* Expanded Freshness View */}
        <motion.div
          className="pt-4 border-t border-[hsl(var(--portal-border))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <DataFreshnessIndicator organizationId={organizationId} key={`full-${refreshKey}`} />
        </motion.div>
      </V3CardContent>
    </V3Card>
  );
};

export default SyncControls;
