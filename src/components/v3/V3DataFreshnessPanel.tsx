import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatDistanceToNow,
  parseISO,
  format,
  differenceInHours,
  differenceInDays,
} from "date-fns";
import { motion } from "framer-motion";
import { V3Badge } from "./V3Badge";

// ============================================================================
// Types
// ============================================================================

export interface V3DataFreshnessPanelProps {
  organizationId: string;
  /** Compact mode shows a single badge summary */
  compact?: boolean;
  /** Show critical alerts section */
  showAlerts?: boolean;
  /** Additional className */
  className?: string;
}

type SyncStatus = {
  platform: string;
  lastSync: string | null;
  status: string | null;
  hoursStale: number | null;
};

type DataFreshness = {
  source: string;
  latestDate: string | null;
  recordCount: number;
  hoursStale: number | null;
  expectedFreshnessHours: number;
  isWebhookBased: boolean;
};

// ============================================================================
// Constants
// ============================================================================

/** Platform-specific expected freshness (hours) */
const EXPECTED_FRESHNESS: Record<
  string,
  { hours: number; isWebhook: boolean; description: string }
> = {
  "Meta Ads": {
    hours: 48,
    isWebhook: false,
    description: "Meta API has 24-48h reporting delay",
  },
  ActBlue: {
    hours: 1,
    isWebhook: true,
    description: "Real-time via webhook, or 6h via CSV sync",
  },
  SMS: {
    hours: 24,
    isWebhook: false,
    description: "Daily sync from Switchboard",
  },
};

/** Query key factory for data freshness */
export const dataFreshnessKeys = {
  all: ["data-freshness"] as const,
  byOrg: (orgId: string) => ["data-freshness", orgId] as const,
};

// ============================================================================
// Status Badge Component
// ============================================================================

type FreshnessLevel = "fresh" | "stale" | "critical" | "noData" | "failed";

interface StatusBadgeConfig {
  variant: "success" | "warning" | "error" | "muted";
  icon: typeof CheckCircle;
  label: string;
}

const statusBadgeConfig: Record<FreshnessLevel, StatusBadgeConfig> = {
  fresh: { variant: "success", icon: CheckCircle, label: "Fresh" },
  stale: { variant: "warning", icon: Clock, label: "Delayed" },
  critical: { variant: "error", icon: AlertCircle, label: "Stale" },
  noData: { variant: "muted", icon: Clock, label: "No data" },
  failed: { variant: "error", icon: AlertCircle, label: "Sync Failed" },
};

function getFreshnessLevel(
  item: DataFreshness,
  syncStatus?: string | null
): FreshnessLevel {
  if (syncStatus === "failed") return "failed";
  if (item.hoursStale === null) return "noData";

  const freshnessThreshold = item.expectedFreshnessHours;
  const criticalThreshold = freshnessThreshold * 3;

  if (item.hoursStale <= freshnessThreshold) return "fresh";
  if (item.hoursStale <= criticalThreshold) return "stale";
  return "critical";
}

const FreshnessStatusBadge: React.FC<{
  item: DataFreshness;
  syncStatus?: string | null;
  showTimeAgo?: boolean;
}> = ({ item, syncStatus, showTimeAgo = false }) => {
  const level = getFreshnessLevel(item, syncStatus);
  const config = statusBadgeConfig[level];
  const Icon = config.icon;

  let label = config.label;
  if (showTimeAgo && item.hoursStale !== null && level !== "fresh") {
    const daysStale = Math.round(item.hoursStale / 24);
    label = daysStale > 0 ? `${daysStale}d ago` : `${Math.round(item.hoursStale)}h ago`;
  }

  return (
    <V3Badge variant={config.variant} size="sm">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </V3Badge>
  );
};

// ============================================================================
// Compact Summary Badge
// ============================================================================

const CompactSummaryBadge: React.FC<{
  dataFreshness: DataFreshness[];
  syncStatuses: SyncStatus[];
  isLoading: boolean;
  hasError: boolean;
}> = ({ dataFreshness, syncStatuses, isLoading, hasError }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-[var(--portal-space-xs)]">
        <RefreshCw className="h-3 w-3 animate-spin text-[hsl(var(--portal-text-muted))]" />
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">Loading...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <V3Badge variant="error" size="sm">
                <AlertCircle className="h-3 w-3" />
                Load Error
              </V3Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
          >
            <p className="text-xs">Failed to load data freshness status. Please refresh.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const hasFailed = syncStatuses.some((s) => s.status === "failed");
  const hasCritical = dataFreshness.some(
    (d) => d.hoursStale && d.hoursStale > d.expectedFreshnessHours * 3
  );
  const hasStaleData = dataFreshness.some(
    (d) => d.hoursStale && d.hoursStale > d.expectedFreshnessHours
  );

  let variant: "success" | "warning" | "error" = "success";
  let icon = CheckCircle;
  let label = "Data Fresh";
  let tooltipText = "All data sources are within expected freshness.";

  if (hasFailed || hasCritical) {
    variant = "error";
    icon = AlertCircle;
    label = hasFailed ? "Sync Failed" : "Data Critical";
    tooltipText = hasFailed
      ? "One or more data syncs have failed. Check settings."
      : "Data is significantly behind expected freshness levels.";
  } else if (hasStaleData) {
    variant = "warning";
    icon = Clock;
    label = "Data Delayed";
    tooltipText = "Some data is behind expected freshness levels.";
  }

  const Icon = icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <V3Badge variant={variant} size="sm">
              <Icon className="h-3 w-3" />
              {label}
            </V3Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
        >
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// Alert Item Component
// ============================================================================

const AlertItem: React.FC<{
  type: "warning" | "error";
  message: string;
}> = ({ type, message }) => {
  const Icon = type === "error" ? AlertCircle : AlertTriangle;
  const bgColor =
    type === "error"
      ? "bg-[hsl(var(--portal-error)/0.1)]"
      : "bg-[hsl(var(--portal-warning)/0.1)]";
  const borderColor =
    type === "error"
      ? "border-[hsl(var(--portal-error)/0.2)]"
      : "border-[hsl(var(--portal-warning)/0.2)]";
  const textColor =
    type === "error"
      ? "text-[hsl(var(--portal-error))]"
      : "text-[hsl(var(--portal-warning))]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-[var(--portal-space-sm)] p-[var(--portal-space-sm)]",
        "rounded-[var(--portal-radius-sm)] border",
        bgColor,
        borderColor
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", textColor)} aria-hidden="true" />
      <span className={cn("text-xs", textColor)}>{message}</span>
    </motion.div>
  );
};

// ============================================================================
// Freshness Row Component
// ============================================================================

const FreshnessRow: React.FC<{
  item: DataFreshness;
  syncStatus?: SyncStatus;
}> = ({ item, syncStatus }) => {
  const platformInfo = EXPECTED_FRESHNESS[item.source];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center justify-between",
        "p-[var(--portal-space-sm)]",
        "rounded-[var(--portal-radius-sm)]",
        "bg-[hsl(var(--portal-bg-elevated))]"
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-[var(--portal-space-xs)]">
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
            {item.source}
          </span>
          {platformInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Info about ${item.source} data freshness`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] rounded-sm"
                  >
                    <Info
                      className="h-3 w-3 text-[hsl(var(--portal-text-muted))]"
                      aria-hidden="true"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
                >
                  <p className="text-xs max-w-48">{platformInfo.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">
          {item.recordCount.toLocaleString()} records
          {item.latestDate && (
            <>
              {" | Latest: "}
              {differenceInDays(new Date(), parseISO(item.latestDate)) > 7
                ? format(parseISO(item.latestDate), "MMM d, yyyy")
                : formatDistanceToNow(parseISO(item.latestDate), {
                    addSuffix: true,
                  })}
            </>
          )}
        </span>
      </div>
      <FreshnessStatusBadge
        item={item}
        syncStatus={syncStatus?.status}
        showTimeAgo
      />
    </motion.div>
  );
};

// ============================================================================
// Sync Status Summary
// ============================================================================

const SyncStatusSummary: React.FC<{
  syncStatuses: SyncStatus[];
}> = ({ syncStatuses }) => {
  if (syncStatuses.length === 0) return null;

  return (
    <div className="pt-[var(--portal-space-sm)] border-t border-[hsl(var(--portal-border))]">
      <div className="text-xs text-[hsl(var(--portal-text-muted))] mb-[var(--portal-space-xs)]">
        Last sync attempts:
      </div>
      <div className="flex flex-wrap gap-[var(--portal-space-xs)]">
        {syncStatuses.map((sync) => {
          const variant =
            sync.status === "success"
              ? "success"
              : sync.status === "failed"
              ? "error"
              : "muted";

          return (
            <TooltipProvider key={sync.platform}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <V3Badge variant={variant} size="sm">
                      {sync.platform}
                    </V3Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
                >
                  <p className="text-xs">
                    {sync.lastSync
                      ? `Last synced ${formatDistanceToNow(parseISO(sync.lastSync), {
                          addSuffix: true,
                        })}`
                      : "Never synced"}
                    {sync.status && ` (${sync.status})`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const V3DataFreshnessPanel: React.FC<V3DataFreshnessPanelProps> = ({
  organizationId,
  compact = false,
  showAlerts = true,
  className,
}) => {
  const {
    data,
    isLoading,
    isError: hasLoadError,
  } = useQuery({
    queryKey: dataFreshnessKeys.byOrg(organizationId),
    queryFn: async () => {
      // Get sync statuses from credentials
      const { data: credentials } = await supabase
        .from("client_api_credentials")
        .select("platform, last_sync_at, last_sync_status")
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      const syncStatuses: SyncStatus[] =
        credentials?.map((c) => ({
          platform: c.platform,
          lastSync: c.last_sync_at,
          status: c.last_sync_status,
          hoursStale: c.last_sync_at
            ? (Date.now() - new Date(c.last_sync_at).getTime()) / (1000 * 60 * 60)
            : null,
        })) || [];

      // Get actual data freshness
      const freshness: DataFreshness[] = [];

      // Meta metrics freshness
      const { data: metaData, count: metaCount } = await supabase
        .from("meta_ad_metrics")
        .select("date", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("date", { ascending: false })
        .limit(1);

      if (metaData && metaData.length > 0) {
        const latestDate = metaData[0].date;
        freshness.push({
          source: "Meta Ads",
          latestDate,
          recordCount: metaCount || 0,
          hoursStale: latestDate
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["Meta Ads"].hours,
          isWebhookBased: false,
        });
      } else if (credentials?.some((c) => c.platform === "meta")) {
        freshness.push({
          source: "Meta Ads",
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["Meta Ads"].hours,
          isWebhookBased: false,
        });
      }

      // ActBlue freshness
      const { data: actblueData, count: actblueCount } = await supabase
        .from("actblue_transactions_secure")
        .select("transaction_date", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("transaction_date", { ascending: false })
        .limit(1);

      const { count: recentWebhooks } = await supabase
        .from("actblue_transactions_secure")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        );

      if (actblueData && actblueData.length > 0) {
        const latestDate = actblueData[0].transaction_date;
        freshness.push({
          source: "ActBlue",
          latestDate,
          recordCount: actblueCount || 0,
          hoursStale: latestDate
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["ActBlue"].hours,
          isWebhookBased: true,
        });
      } else if (credentials?.some((c) => c.platform === "actblue")) {
        freshness.push({
          source: "ActBlue",
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["ActBlue"].hours,
          isWebhookBased: true,
        });
      }

      // SMS freshness
      const { data: smsData, count: smsCount } = await supabase
        .from("sms_campaigns")
        .select("send_date", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("send_date", { ascending: false })
        .limit(1);

      if (smsData && smsData.length > 0) {
        const latestDate = smsData[0].send_date;
        freshness.push({
          source: "SMS",
          latestDate,
          recordCount: smsCount || 0,
          hoursStale: latestDate
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["SMS"].hours,
          isWebhookBased: false,
        });
      } else if (credentials?.some((c) => c.platform === "switchboard")) {
        freshness.push({
          source: "SMS",
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS["SMS"].hours,
          isWebhookBased: false,
        });
      }

      return {
        syncStatuses,
        dataFreshness: freshness,
        webhookCount: recentWebhooks || 0,
      };
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const syncStatuses = data?.syncStatuses ?? [];
  const dataFreshness = data?.dataFreshness ?? [];
  const webhookCount = data?.webhookCount ?? 0;

  // Generate critical alerts
  const getCriticalAlerts = () => {
    const alerts: { type: "warning" | "error"; message: string }[] = [];

    for (const item of dataFreshness) {
      if (item.hoursStale === null && item.recordCount === 0) {
        alerts.push({
          type: "warning",
          message: `No ${item.source} data received yet`,
        });
        continue;
      }

      const criticalThreshold = item.expectedFreshnessHours * 3;

      if (item.hoursStale && item.hoursStale > criticalThreshold) {
        const days = Math.round(item.hoursStale / 24);
        alerts.push({
          type: "error",
          message: `${item.source} data is ${days} days behind. ${
            EXPECTED_FRESHNESS[item.source]?.description || ""
          }`,
        });
      }
    }

    // Check for ActBlue webhook activity
    const actblueItem = dataFreshness.find((d) => d.source === "ActBlue");
    if (
      actblueItem &&
      actblueItem.recordCount > 0 &&
      webhookCount === 0 &&
      actblueItem.hoursStale &&
      actblueItem.hoursStale > 24
    ) {
      alerts.push({
        type: "warning",
        message:
          "No ActBlue webhook events in 24h. Verify webhook is configured in ActBlue dashboard.",
      });
    }

    return alerts;
  };

  // Compact view
  if (compact) {
    return (
      <CompactSummaryBadge
        dataFreshness={dataFreshness}
        syncStatuses={syncStatuses}
        isLoading={isLoading}
        hasError={hasLoadError}
      />
    );
  }

  const alerts = getCriticalAlerts();

  // Full view
  return (
    <div className={cn("space-y-[var(--portal-space-sm)]", className)}>
      {/* Load Error */}
      {hasLoadError && (
        <AlertItem type="error" message="Failed to load data freshness status" />
      )}

      {/* Critical Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="space-y-[var(--portal-space-xs)]">
          {alerts.map((alert, idx) => (
            <AlertItem key={idx} type={alert.type} message={alert.message} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
        Data Freshness
      </div>

      {/* Freshness Grid */}
      <div className="grid gap-[var(--portal-space-xs)]">
        {dataFreshness.map((item) => {
          const syncStatus = syncStatuses.find(
            (s) =>
              s.platform.toLowerCase() === item.source.toLowerCase() ||
              (s.platform === "actblue" && item.source === "ActBlue") ||
              (s.platform === "meta" && item.source === "Meta Ads") ||
              (s.platform === "switchboard" && item.source === "SMS")
          );

          return (
            <FreshnessRow
              key={item.source}
              item={item}
              syncStatus={syncStatus}
            />
          );
        })}

        {dataFreshness.length === 0 && (
          <div className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-[var(--portal-space-sm)]">
            No data sources connected yet
          </div>
        )}
      </div>

      {/* Sync Status Summary */}
      <SyncStatusSummary syncStatuses={syncStatuses} />
    </div>
  );
};

V3DataFreshnessPanel.displayName = "V3DataFreshnessPanel";

export default V3DataFreshnessPanel;
