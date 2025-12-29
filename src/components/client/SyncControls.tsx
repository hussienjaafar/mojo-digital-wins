import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  DollarSign,
  MessageSquare,
  TrendingUp,
  Heart,
  History,
  CheckCircle,
  AlertCircle,
  Zap,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3Badge,
  V3Button,
  V3DataFreshnessPanel,
} from "@/components/v3";
import { dataFreshnessKeys } from "@/components/v3/V3DataFreshnessPanel";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  dashboardKeys,
  metaKeys,
  smsKeys,
  donationKeys,
  channelKeys,
} from "@/queries/queryKeys";

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

// Accent color mapping using portal tokens
const accentColors = {
  blue: {
    hover: "hover:border-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.05)]",
    icon: "text-[hsl(var(--portal-accent-blue))]",
  },
  purple: {
    hover: "hover:border-[hsl(var(--portal-accent-purple))] hover:bg-[hsl(var(--portal-accent-purple)/0.05)]",
    icon: "text-[hsl(var(--portal-accent-purple))]",
  },
  green: {
    hover: "hover:border-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.05)]",
    icon: "text-[hsl(var(--portal-success))]",
  },
  amber: {
    hover: "hover:border-[hsl(var(--portal-warning))] hover:bg-[hsl(var(--portal-warning)/0.05)]",
    icon: "text-[hsl(var(--portal-warning))]",
  },
} as const;

type AccentColor = keyof typeof accentColors;

const SyncControls = ({ organizationId, startDate, endDate }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);

  useEffect(() => {
    loadSyncStatuses();
  }, [organizationId]);

  const loadSyncStatuses = async () => {
    const { data } = await supabase
      .from("client_api_credentials")
      .select("platform, last_sync_at, last_sync_status")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (data) {
      setSyncStatuses(
        data.map((c) => ({
          platform: c.platform,
          lastSync: c.last_sync_at,
          status: c.last_sync_status,
        }))
      );
    }
  };

  const getSyncStatus = (platform: string) => {
    return syncStatuses.find((s) => s.platform === platform);
  };

  // Invalidate all dashboard-related queries including data freshness
  const invalidateDashboardQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: channelKeys.all }),
      queryClient.invalidateQueries({
        queryKey: dataFreshnessKeys.byOrg(organizationId),
      }),
    ]);
  };

  const syncMetaAds = async () => {
    setSyncing({ ...syncing, meta: true });
    try {
      const syncStartDate =
        startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const syncEndDate = endDate || new Date().toISOString().split("T")[0];

      const { error } = await (supabase as any).functions.invoke("sync-meta-ads", {
        body: {
          organization_id: organizationId,
          start_date: syncStartDate,
          end_date: syncEndDate,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Meta Ads sync completed successfully",
      });

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
      const { data, error } = await (supabase as any).functions.invoke(
        "sync-switchboard-sms",
        {
          body: { organization_id: organizationId },
        }
      );

      if (error) throw error;

      if (data && data.error && data.credentials_valid) {
        toast({
          title: "Switchboard API Not Available",
          description:
            "OneSwitchboard doesn't provide a public reporting API. Please export CSV reports from your dashboard manually.",
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Switchboard SMS sync completed successfully",
        });
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
    const syncKey = backfill ? "actblueBackfill" : "actblue";
    setSyncing({ ...syncing, [syncKey]: true });
    try {
      if (backfill) {
        toast({
          title: "Starting ActBlue Backfill",
          description:
            "Fetching 1 year of historical data. This may take a few minutes...",
        });
      }

      const syncStartDate = backfill
        ? undefined
        : startDate ||
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const syncEndDate = backfill
        ? undefined
        : endDate || new Date().toISOString().split("T")[0];

      const { data, error } = await (supabase as any).functions.invoke(
        "sync-actblue-csv",
        {
          body: {
            organization_id: organizationId,
            mode: backfill ? "backfill" : "incremental",
            start_date: syncStartDate,
            end_date: syncEndDate,
          },
        }
      );

      if (error) throw error;

      const inserted = data?.results?.[0]?.inserted || 0;
      const processed = data?.results?.[0]?.processed || 0;

      toast({
        title: "Success",
        description: backfill
          ? `ActBlue backfill completed: ${inserted} new transactions from ${processed} processed`
          : `ActBlue sync completed: ${inserted} new transactions`,
      });

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
      const { error } = await (supabase as any).functions.invoke("calculate-roi", {
        body: { organization_id: organizationId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "ROI calculation completed",
      });
    } catch (error: any) {
      logger.error("ROI calculation failed", error);
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
  };

  const renderSyncStatusBadge = (platform: string) => {
    const status = getSyncStatus(platform);
    if (!status) return null;

    if (status.status === "failed") {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <V3Badge variant="error" size="sm">
            <AlertCircle className="h-2.5 w-2.5" />
            Failed
          </V3Badge>
        </motion.div>
      );
    }

    if (status.status === "success" && status.lastSync) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <V3Badge variant="success" size="sm">
            <CheckCircle className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(status.lastSync), { addSuffix: false })}
          </V3Badge>
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
    variant?: "outline" | "primary";
    dashed?: boolean;
    accent?: AccentColor;
  }) => {
    const isPrimary = variant === "primary";

    return (
      <motion.div
        variants={itemVariants}
        whileHover="hover"
        whileTap="tap"
        initial="idle"
        animate="idle"
      >
        <motion.div variants={buttonVariants}>
          <V3Button
            onClick={onClick}
            disabled={disabled}
            variant={isPrimary ? "primary" : "outline"}
            aria-busy={isSyncing}
            aria-label={isSyncing ? `${label} in progress` : label}
            className={cn(
              // Fixed height for consistency, flex-col layout
              "min-h-[100px] h-full flex-col justify-center gap-[var(--portal-space-xs)] py-[var(--portal-space-md)] px-[var(--portal-space-sm)] relative w-full",
              "transition-all duration-200",
              dashed && "border-dashed",
              !isPrimary && accent && accentColors[accent].hover
            )}
          >
            <AnimatePresence mode="wait">
              {isSyncing ? (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                >
                  <RefreshCw
                    className={cn(
                      "w-5 h-5",
                      accent && !isPrimary ? accentColors[accent].icon : ""
                    )}
                    aria-hidden="true"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      accent && !isPrimary ? accentColors[accent].icon : ""
                    )}
                    aria-hidden="true"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <span className="text-xs font-medium" aria-hidden="true">
              {label}
            </span>
            {platform && !isSyncing && renderSyncStatusBadge(platform)}
            {/* Screen reader live announcement */}
            <span className="sr-only" role="status" aria-live="polite">
              {isSyncing ? `${label} syncing...` : ""}
            </span>
          </V3Button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <V3Card accent="blue">
      <V3CardHeader>
        <div className="flex items-start justify-between gap-[var(--portal-space-md)]">
          <div className="flex items-center gap-[var(--portal-space-sm)]">
            <motion.div
              className="p-2.5 rounded-[var(--portal-radius-sm)] bg-[hsl(var(--portal-accent-blue)/0.1)]"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Zap
                className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]"
                aria-hidden="true"
              />
            </motion.div>
            <div>
              <V3CardTitle>Data Sync</V3CardTitle>
              <V3CardDescription>
                Manually sync data from connected platforms
              </V3CardDescription>
            </div>
          </div>
          <V3DataFreshnessPanel organizationId={organizationId} compact />
        </div>
      </V3CardHeader>
      <V3CardContent className="space-y-[var(--portal-space-lg)]">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--portal-space-sm)]"
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
            variant="primary"
          />
        </motion.div>

        {/* Expanded Freshness View */}
        <motion.div
          className="pt-[var(--portal-space-md)] border-t border-[hsl(var(--portal-border))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <V3DataFreshnessPanel organizationId={organizationId} />
        </motion.div>
      </V3CardContent>
    </V3Card>
  );
};

export default SyncControls;
