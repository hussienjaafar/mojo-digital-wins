import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  DollarSign,
  MessageSquare,
  Heart,
  History,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  Database,
  Settings2,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { formatDistanceToNow, differenceInHours, parseISO, format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3Badge,
  V3Button,
} from "@/components/v3";
import { dataFreshnessKeys } from "@/components/v3/V3DataFreshnessPanel";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  dashboardKeys,
  metaKeys,
  smsKeys,
  donationKeys,
  channelKeys,
} from "@/queries/queryKeys";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Props = {
  organizationId: string;
  startDate?: string;
  endDate?: string;
};

type SyncStatus = {
  platform: string;
  lastSync: string | null;
  status: string | null;
  errorCount: number | null;
  lastError: string | null;
};

type DataSourceFreshness = {
  source: "meta" | "actblue" | "sms";
  label: string;
  latestDate: string | null;
  recordCount: number;
  hoursStale: number | null;
  expectedFreshnessHours: number;
  syncStatus: "success" | "failed" | "pending" | null;
};

// Platform-specific expected freshness (hours) and display info
const PLATFORM_CONFIG = {
  meta: {
    label: "Meta Ads",
    icon: DollarSign,
    expectedHours: 48,
    description: "24-48h API delay",
    accentClass: "border-l-[hsl(var(--portal-accent-blue))]",
    iconClass: "text-[hsl(var(--portal-accent-blue))]",
    bgClass: "bg-[hsl(var(--portal-accent-blue)/0.08)]",
  },
  actblue: {
    label: "ActBlue",
    icon: Heart,
    expectedHours: 6,
    description: "Real-time webhooks",
    accentClass: "border-l-[hsl(var(--portal-success))]",
    iconClass: "text-[hsl(var(--portal-success))]",
    bgClass: "bg-[hsl(var(--portal-success)/0.08)]",
  },
  sms: {
    label: "SMS",
    icon: MessageSquare,
    expectedHours: 24,
    description: "Daily sync",
    accentClass: "border-l-[hsl(var(--portal-accent-purple))]",
    iconClass: "text-[hsl(var(--portal-accent-purple))]",
    bgClass: "bg-[hsl(var(--portal-accent-purple)/0.08)]",
  },
} as const;

type FreshnessLevel = "fresh" | "delayed" | "stale" | "noData" | "failed";

function getFreshnessLevel(
  hoursStale: number | null,
  expectedHours: number,
  syncStatus: string | null
): FreshnessLevel {
  if (syncStatus === "failed") return "failed";
  if (hoursStale === null) return "noData";
  if (hoursStale <= expectedHours) return "fresh";
  if (hoursStale <= expectedHours * 2) return "delayed";
  return "stale";
}

const freshnessConfig: Record<FreshnessLevel, { variant: "success" | "warning" | "error" | "muted"; icon: typeof CheckCircle; label: string }> = {
  fresh: { variant: "success", icon: CheckCircle, label: "Fresh" },
  delayed: { variant: "warning", icon: Clock, label: "Delayed" },
  stale: { variant: "error", icon: AlertCircle, label: "Stale" },
  noData: { variant: "muted", icon: Clock, label: "No data" },
  failed: { variant: "error", icon: AlertCircle, label: "Failed" },
};

// ============================================================================
// DataSourceCard Component
// ============================================================================

interface DataSourceCardProps {
  source: "meta" | "actblue" | "sms";
  freshness: DataSourceFreshness | null;
  onSync: () => void;
  isSyncing: boolean;
  disabled?: boolean;
}

const DataSourceCard = ({ source, freshness, onSync, isSyncing, disabled }: DataSourceCardProps) => {
  const config = PLATFORM_CONFIG[source];
  const Icon = config.icon;
  
  const level = freshness 
    ? getFreshnessLevel(freshness.hoursStale, freshness.expectedFreshnessHours, freshness.syncStatus)
    : "noData";
  const statusConfig = freshnessConfig[level];
  const StatusIcon = statusConfig.icon;

  const formatTimeAgo = (hoursStale: number | null): string => {
    if (hoursStale === null) return "Never";
    if (hoursStale < 1) return "< 1h ago";
    if (hoursStale < 24) return `${Math.round(hoursStale)}h ago`;
    const days = Math.round(hoursStale / 24);
    return `${days}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative"
    >
      <div
        className={cn(
          "relative rounded-lg border-l-4 border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-card))] p-4",
          "transition-all duration-200",
          "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
          config.accentClass
        )}
      >
        {/* Sync button - visible on hover, always visible on mobile */}
        <button
          onClick={onSync}
          disabled={disabled || isSyncing}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded-md",
            "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]",
            "hover:bg-[hsl(var(--portal-bg-elevated))]",
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            "transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))]"
          )}
          aria-label={`Sync ${config.label}`}
        >
          <RefreshCw
            className={cn("h-4 w-4", isSyncing && "animate-spin")}
            aria-hidden="true"
          />
        </button>

        {/* Header with icon and name */}
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("p-1.5 rounded-md", config.bgClass)}>
            <Icon className={cn("h-4 w-4", config.iconClass)} aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
            {config.label}
          </span>
        </div>

        {/* Status badge */}
        <div className="mb-2">
          <V3Badge variant={statusConfig.variant} size="sm">
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {statusConfig.label}
          </V3Badge>
        </div>

        {/* Record count and time */}
        <div className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
          <div>{freshness?.recordCount?.toLocaleString() || 0} records</div>
          <div>{formatTimeAgo(freshness?.hoursStale ?? null)}</div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main SyncControls Component
// ============================================================================

const SyncControls = ({ organizationId, startDate, endDate }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch data freshness for all sources
  const { data: freshnessData } = useQuery({
    queryKey: dataFreshnessKeys.byOrg(organizationId),
    queryFn: async () => {
      const result: DataSourceFreshness[] = [];

      // Get sync statuses
      const { data: credentials } = await supabase
        .from("client_api_credentials")
        .select("platform, last_sync_at, last_sync_status")
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      const getSyncStatus = (platform: string) => 
        credentials?.find(c => c.platform === platform)?.last_sync_status || null;

      // Meta Ads
      const { data: metaData, count: metaCount } = await supabase
        .from("meta_ad_metrics")
        .select("date", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("date", { ascending: false })
        .limit(1);

      const metaLatest = metaData?.[0]?.date || null;
      result.push({
        source: "meta",
        label: "Meta Ads",
        latestDate: metaLatest,
        recordCount: metaCount || 0,
        hoursStale: metaLatest ? differenceInHours(new Date(), parseISO(metaLatest)) : null,
        expectedFreshnessHours: PLATFORM_CONFIG.meta.expectedHours,
        syncStatus: getSyncStatus("meta") as any,
      });

      // ActBlue
      const { data: actblueData, count: actblueCount } = await supabase
        .from("actblue_transactions_secure")
        .select("transaction_date", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("transaction_date", { ascending: false })
        .limit(1);

      const actblueLatest = actblueData?.[0]?.transaction_date || null;
      result.push({
        source: "actblue",
        label: "ActBlue",
        latestDate: actblueLatest,
        recordCount: actblueCount || 0,
        hoursStale: actblueLatest ? differenceInHours(new Date(), parseISO(actblueLatest)) : null,
        expectedFreshnessHours: PLATFORM_CONFIG.actblue.expectedHours,
        syncStatus: getSyncStatus("actblue") as any,
      });

      // SMS
      const { data: smsData, count: smsCount } = await supabase
        .from("sms_campaigns")
        .select("created_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1);

      const smsLatest = smsData?.[0]?.created_at || null;
      result.push({
        source: "sms",
        label: "SMS",
        latestDate: smsLatest,
        recordCount: smsCount || 0,
        hoursStale: smsLatest ? differenceInHours(new Date(), parseISO(smsLatest)) : null,
        expectedFreshnessHours: PLATFORM_CONFIG.sms.expectedHours,
        syncStatus: getSyncStatus("switchboard") as any,
      });

      return result;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    loadSyncStatuses();
  }, [organizationId]);

  const loadSyncStatuses = async () => {
    const { data } = await supabase
      .from("client_api_credentials")
      .select("platform, last_sync_at, last_sync_status, sync_error_count, last_sync_error")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (data) {
      setSyncStatuses(
        data.map((c) => ({
          platform: c.platform,
          lastSync: c.last_sync_at,
          status: c.last_sync_status,
          errorCount: c.sync_error_count,
          lastError: c.last_sync_error,
        }))
      );
    }
  };

  // Invalidate all dashboard-related queries
  const invalidateDashboardQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: channelKeys.all }),
      queryClient.invalidateQueries({ queryKey: dataFreshnessKeys.byOrg(organizationId) }),
    ]);
  };

  const syncMetaAds = async () => {
    setSyncing((prev) => ({ ...prev, meta: true }));
    try {
      const syncStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const syncEndDate = endDate || new Date().toISOString().split("T")[0];

      const { error } = await (supabase as any).functions.invoke("sync-meta-ads", {
        body: { organization_id: organizationId, start_date: syncStartDate, end_date: syncEndDate },
      });

      if (error) throw error;

      toast({ title: "Success", description: "Meta Ads sync completed" });
      await queryClient.invalidateQueries({ queryKey: metaKeys.all });
      await invalidateDashboardQueries();
      await calculateROI();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sync Meta Ads", variant: "destructive" });
    } finally {
      setSyncing((prev) => ({ ...prev, meta: false }));
    }
  };

  const syncSwitchboard = async () => {
    setSyncing((prev) => ({ ...prev, sms: true }));
    try {
      const { data, error } = await (supabase as any).functions.invoke("sync-switchboard-sms", {
        body: { organization_id: organizationId },
      });

      if (error) throw error;

      if (data?.error && data?.credentials_valid) {
        toast({
          title: "Switchboard API Not Available",
          description: "Please export CSV reports manually from your dashboard.",
        });
      } else {
        toast({ title: "Success", description: "SMS sync completed" });
        await queryClient.invalidateQueries({ queryKey: smsKeys.all });
        await invalidateDashboardQueries();
        await calculateROI();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sync SMS", variant: "destructive" });
    } finally {
      setSyncing((prev) => ({ ...prev, sms: false }));
    }
  };

  const syncActBlue = async (backfill = false) => {
    const syncKey = backfill ? "actblueBackfill" : "actblue";
    setSyncing((prev) => ({ ...prev, [syncKey]: true }));
    try {
      if (backfill) {
        toast({ title: "Starting Backfill", description: "Fetching 1 year of data. This may take a few minutes..." });
      }

      const syncStartDate = backfill ? undefined : startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const syncEndDate = backfill ? undefined : endDate || new Date().toISOString().split("T")[0];

      const { data, error } = await (supabase as any).functions.invoke("sync-actblue-csv", {
        body: {
          organization_id: organizationId,
          mode: backfill ? "backfill" : "incremental",
          start_date: syncStartDate,
          end_date: syncEndDate,
        },
      });

      if (error) throw error;

      const inserted = data?.results?.[0]?.inserted || 0;
      toast({ title: "Success", description: `ActBlue sync completed: ${inserted} new transactions` });
      await queryClient.invalidateQueries({ queryKey: donationKeys.all });
      await invalidateDashboardQueries();
      await calculateROI();
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase();
      const likelyTimeout = message.includes("timeout") || message.includes("context canceled") || message.includes("aborted");

      if (backfill && likelyTimeout) {
        toast({ title: "Backfill running", description: "This may complete in the background. We'll refresh shortly." });
        window.setTimeout(async () => {
          await loadSyncStatuses();
          await queryClient.invalidateQueries({ queryKey: donationKeys.all });
          await invalidateDashboardQueries();
        }, 30_000);
        return;
      }

      toast({ title: "Error", description: error.message || "Failed to sync ActBlue", variant: "destructive" });
    } finally {
      setSyncing((prev) => ({ ...prev, [syncKey]: false }));
    }
  };

  const calculateROI = async () => {
    setSyncing((prev) => ({ ...prev, roi: true }));
    try {
      const { error } = await (supabase as any).functions.invoke("calculate-roi", {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
      toast({ title: "Success", description: "ROI calculation completed" });
    } catch (error: any) {
      logger.error("ROI calculation failed", error);
    } finally {
      setSyncing((prev) => ({ ...prev, roi: false }));
    }
  };

  const syncAll = async () => {
    toast({ title: "Syncing All Sources", description: "This may take a few minutes..." });
    await Promise.all([syncMetaAds(), syncSwitchboard(), syncActBlue(false)]);
    toast({ title: "Complete", description: "All data sources synced" });
    await loadSyncStatuses();
  };

  const isAnySyncing = Object.values(syncing).some(Boolean);

  const getFreshness = (source: "meta" | "actblue" | "sms") =>
    freshnessData?.find((f) => f.source === source) || null;

  // Calculate overall health for summary
  const overallHealth = (() => {
    if (!freshnessData) return "loading";
    const hasFailed = freshnessData.some((f) => f.syncStatus === "failed");
    const hasStale = freshnessData.some((f) => {
      if (!f.hoursStale) return false;
      return f.hoursStale > f.expectedFreshnessHours * 2;
    });
    if (hasFailed) return "error";
    if (hasStale) return "warning";
    return "healthy";
  })();

  return (
    <V3Card>
      <V3CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Database className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
            </div>
            <div>
              <V3CardTitle>Data Sources</V3CardTitle>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5">
                {overallHealth === "healthy" && "All sources up to date"}
                {overallHealth === "warning" && "Some sources need attention"}
                {overallHealth === "error" && "Sync issues detected"}
                {overallHealth === "loading" && "Checking status..."}
              </p>
            </div>
          </div>
          <V3Button
            onClick={syncAll}
            disabled={isAnySyncing}
            size="sm"
            variant="primary"
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isAnySyncing && "animate-spin")} />
            Sync All
          </V3Button>
        </div>
      </V3CardHeader>

      <V3CardContent className="space-y-4">
        {/* Data Source Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DataSourceCard
            source="meta"
            freshness={getFreshness("meta")}
            onSync={syncMetaAds}
            isSyncing={syncing.meta}
            disabled={isAnySyncing}
          />
          <DataSourceCard
            source="actblue"
            freshness={getFreshness("actblue")}
            onSync={() => syncActBlue(false)}
            isSyncing={syncing.actblue}
            disabled={isAnySyncing || syncing.actblueBackfill}
          />
          <DataSourceCard
            source="sms"
            freshness={getFreshness("sms")}
            onSync={syncSwitchboard}
            isSyncing={syncing.sms}
            disabled={isAnySyncing}
          />
        </div>

        {/* Advanced Options - Collapsible */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 w-full py-2",
                "text-xs text-[hsl(var(--portal-text-muted))]",
                "hover:text-[hsl(var(--portal-text-primary))] transition-colors",
                "border-t border-[hsl(var(--portal-border))] pt-4"
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Advanced Options</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 ml-auto transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2 pt-3"
            >
              <V3Button
                variant="ghost"
                size="sm"
                onClick={() => syncActBlue(true)}
                disabled={syncing.actblue || syncing.actblueBackfill}
                className="text-xs"
              >
                <History className="h-3.5 w-3.5 mr-1.5" />
                {syncing.actblueBackfill ? "Backfilling..." : "Backfill ActBlue"}
              </V3Button>
              <V3Button
                variant="ghost"
                size="sm"
                onClick={calculateROI}
                disabled={syncing.roi}
                className="text-xs"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                {syncing.roi ? "Calculating..." : "Recalculate ROI"}
              </V3Button>
            </motion.div>

            {/* Sync History - compact */}
            {syncStatuses.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[hsl(var(--portal-border))]">
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-2">Recent sync activity</p>
                <div className="space-y-1.5">
                  {syncStatuses.map((status) => (
                    <div
                      key={status.platform}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-[hsl(var(--portal-bg-elevated))]"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            status.status === "success" && "bg-[hsl(var(--portal-success))]",
                            status.status === "failed" && "bg-[hsl(var(--portal-error))]",
                            !status.status && "bg-[hsl(var(--portal-text-muted))]"
                          )}
                        />
                        <span className="capitalize text-[hsl(var(--portal-text-primary))]">
                          {status.platform}
                        </span>
                      </div>
                      <span className="text-[hsl(var(--portal-text-muted))]">
                        {status.lastSync
                          ? formatDistanceToNow(new Date(status.lastSync), { addSuffix: true })
                          : "Never"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </V3CardContent>
    </V3Card>
  );
};

export default SyncControls;
