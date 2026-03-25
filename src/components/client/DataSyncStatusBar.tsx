import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInHours, parseISO } from "date-fns";
import { V3Badge } from "@/components/v3";
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Heart, 
  MessageSquare,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSyncStatusBarProps {
  organizationId: string;
  className?: string;
}

type SyncSource = "meta" | "actblue" | "sms";

interface SourceStatus {
  source: SyncSource;
  label: string;
  icon: typeof DollarSign;
  lastSync: string | null;
  hoursStale: number | null;
  expectedHours: number;
  syncStatus: "success" | "failed" | "pending" | null;
  isLoading?: boolean;
}

const sourceConfig: Record<SyncSource, { label: string; icon: typeof DollarSign; expectedHours: number }> = {
  meta: { label: "Meta", icon: DollarSign, expectedHours: 48 },
  actblue: { label: "ActBlue", icon: Heart, expectedHours: 6 },
  sms: { label: "SMS", icon: MessageSquare, expectedHours: 24 },
};

function getStatusVariant(hoursStale: number | null, expectedHours: number, syncStatus: string | null): "success" | "warning" | "error" | "muted" {
  if (syncStatus === "failed") return "error";
  if (hoursStale === null) return "muted";
  if (hoursStale <= expectedHours) return "success";
  if (hoursStale <= expectedHours * 2) return "warning";
  return "error";
}

function formatFreshness(hoursStale: number | null): string {
  if (hoursStale === null) return "No data";
  if (hoursStale < 1) return "< 1h";
  if (hoursStale < 24) return `${Math.round(hoursStale)}h`;
  return `${Math.round(hoursStale / 24)}d`;
}

function SourceIndicator({ status }: { status: SourceStatus }) {
  const variant = getStatusVariant(status.hoursStale, status.expectedHours, status.syncStatus);
  const Icon = status.icon;
  
  return (
    <div 
      className="flex items-center gap-1.5 text-xs"
      title={`${status.label}: ${status.hoursStale !== null ? `${Math.round(status.hoursStale)}h ago` : "No data"}`}
    >
      <Icon className={cn(
        "h-3.5 w-3.5",
        variant === "success" && "text-[hsl(var(--portal-success))]",
        variant === "warning" && "text-[hsl(var(--portal-warning))]",
        variant === "error" && "text-[hsl(var(--portal-error))]",
        variant === "muted" && "text-[hsl(var(--portal-text-muted))]"
      )} />
      <span className={cn(
        "text-[hsl(var(--portal-text-muted))]",
        variant === "error" && "text-[hsl(var(--portal-error))]"
      )}>
        {formatFreshness(status.hoursStale)}
      </span>
    </div>
  );
}

export function DataSyncStatusBar({ organizationId, className }: DataSyncStatusBarProps) {
  const { data: statuses, isLoading } = useQuery({
    queryKey: ["data-sync-status", organizationId],
    queryFn: async (): Promise<SourceStatus[]> => {
      const result: SourceStatus[] = [];

      // Get sync statuses from credentials
      const { data: credentials } = await supabase
        .from("client_api_credentials")
        .select("platform, last_sync_at, last_sync_status")
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      const getSyncStatus = (platform: string) => 
        credentials?.find(c => c.platform === platform)?.last_sync_status || null;

      // Meta Ads
      const { data: metaData } = await supabase
        .from("meta_ad_metrics")
        .select("date")
        .eq("organization_id", organizationId)
        .order("date", { ascending: false })
        .limit(1);

      const metaLatest = metaData?.[0]?.date || null;
      result.push({
        source: "meta",
        ...sourceConfig.meta,
        lastSync: metaLatest,
        hoursStale: metaLatest ? differenceInHours(new Date(), parseISO(metaLatest)) : null,
        syncStatus: getSyncStatus("meta") as any,
      });

      // ActBlue
      const { data: actblueData } = await supabase
        .from("actblue_transactions_secure")
        .select("transaction_date")
        .eq("organization_id", organizationId)
        .order("transaction_date", { ascending: false })
        .limit(1);

      const actblueLatest = actblueData?.[0]?.transaction_date || null;
      result.push({
        source: "actblue",
        ...sourceConfig.actblue,
        lastSync: actblueLatest,
        hoursStale: actblueLatest ? differenceInHours(new Date(), parseISO(actblueLatest)) : null,
        syncStatus: getSyncStatus("actblue") as any,
      });

      // SMS
      const { data: smsData } = await supabase
        .from("sms_campaigns")
        .select("created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1);

      const smsLatest = smsData?.[0]?.created_at || null;
      result.push({
        source: "sms",
        ...sourceConfig.sms,
        lastSync: smsLatest,
        hoursStale: smsLatest ? differenceInHours(new Date(), parseISO(smsLatest)) : null,
        syncStatus: getSyncStatus("switchboard") as any,
      });

      return result;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Calculate overall health
  const overallHealth = (() => {
    if (!statuses) return "loading";
    const hasFailed = statuses.some(s => s.syncStatus === "failed");
    const hasStale = statuses.some(s => {
      if (s.hoursStale === null) return false;
      return s.hoursStale > s.expectedHours * 2;
    });
    if (hasFailed) return "error";
    if (hasStale) return "warning";
    return "healthy";
  })();

  const healthConfig = {
    loading: { icon: Loader2, label: "Checking...", variant: "muted" as const, animate: true },
    healthy: { icon: CheckCircle, label: "All synced", variant: "success" as const },
    warning: { icon: Clock, label: "Delayed", variant: "warning" as const },
    error: { icon: AlertCircle, label: "Issues", variant: "error" as const },
  };

  const config = healthConfig[overallHealth];
  const StatusIcon = config.icon;

  return (
    <div className={cn(
      "flex items-center gap-4 px-3 py-2 rounded-lg",
      "bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]",
      className
    )}>
      {/* Overall status */}
      <div className="flex items-center gap-2">
        <StatusIcon className={cn(
          "h-4 w-4",
          config.variant === "success" && "text-[hsl(var(--portal-success))]",
          config.variant === "warning" && "text-[hsl(var(--portal-warning))]",
          config.variant === "error" && "text-[hsl(var(--portal-error))]",
          config.variant === "muted" && "text-[hsl(var(--portal-text-muted))]",
          (config as any).animate && "animate-spin"
        )} />
        <V3Badge variant={config.variant} size="sm">
          {config.label}
        </V3Badge>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-[hsl(var(--portal-border))]" />

      {/* Per-source indicators */}
      {isLoading ? (
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">Loading...</span>
      ) : (
        <div className="flex items-center gap-4">
          {statuses?.map(status => (
            <SourceIndicator key={status.source} status={status} />
          ))}
        </div>
      )}
    </div>
  );
}

export default DataSyncStatusBar;
