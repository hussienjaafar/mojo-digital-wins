import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock, WifiOff, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceFreshness, type FreshnessStatus, formatSourceAge } from "@/hooks/useSourceFreshness";

interface DataFreshnessBannerProps {
  className?: string;
  /** If true, always show banner even when live (for debugging). Default: false */
  showWhenLive?: boolean;
}

// Status display configuration
const STATUS_CONFIG: Record<FreshnessStatus, {
  label: string;
  description: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  Icon: React.ElementType;
}> = {
  live: {
    label: "Data is Live",
    description: "All sources are within SLA",
    bgClass: "bg-[hsl(var(--portal-success)/0.08)]",
    borderClass: "border-[hsl(var(--portal-success)/0.2)]",
    textClass: "text-[hsl(var(--portal-success))]",
    Icon: CheckCircle2,
  },
  stale: {
    label: "Data May Be Delayed",
    description: "Some sources haven't updated recently",
    bgClass: "bg-[hsl(var(--portal-warning)/0.1)]",
    borderClass: "border-[hsl(var(--portal-warning)/0.2)]",
    textClass: "text-[hsl(var(--portal-warning))]",
    Icon: AlertTriangle,
  },
  critical: {
    label: "Data Outdated",
    description: "Sources are significantly behind — trends may not reflect current news",
    bgClass: "bg-[hsl(var(--portal-error)/0.1)]",
    borderClass: "border-[hsl(var(--portal-error)/0.2)]",
    textClass: "text-[hsl(var(--portal-error))]",
    Icon: WifiOff,
  },
  unknown: {
    label: "Checking Data Status",
    description: "Unable to determine freshness",
    bgClass: "bg-[hsl(var(--portal-bg-elevated))]",
    borderClass: "border-[hsl(var(--portal-border))]",
    textClass: "text-[hsl(var(--portal-text-muted))]",
    Icon: Activity,
  },
};

export function DataFreshnessBanner({ 
  className,
  showWhenLive = false,
}: DataFreshnessBannerProps) {
  const { data: freshness, isLoading, error } = useSourceFreshness();

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]", className)}>
        <div className="h-4 w-4 rounded-full bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-32 bg-[hsl(var(--portal-bg-secondary))] rounded animate-pulse" />
          <div className="h-3 w-48 bg-[hsl(var(--portal-bg-secondary))] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !freshness) {
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg",
          STATUS_CONFIG.unknown.bgClass,
          "border",
          STATUS_CONFIG.unknown.borderClass,
          className
        )}
        role="alert"
      >
        <Activity className={cn("h-4 w-4 shrink-0", STATUS_CONFIG.unknown.textClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", STATUS_CONFIG.unknown.textClass)}>
            Unable to check data freshness
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            Pipeline status unavailable
          </p>
        </div>
      </div>
    );
  }

  const { overallStatus, sources, lastDataTimestamp, stalestSource, isAnySourceCritical, isAnySourceStale } = freshness;
  const config = STATUS_CONFIG[overallStatus];
  const { Icon } = config;

  // Don't show banner if data is live (unless forced)
  if (overallStatus === 'live' && !showWhenLive) {
    return null;
  }

  // Build source summary
  const sourceList = Object.values(sources);
  const liveCount = sourceList.filter(s => s.status === 'live').length;
  const staleCount = sourceList.filter(s => s.status === 'stale').length;
  const criticalCount = sourceList.filter(s => s.status === 'critical').length;

  // Get most relevant timestamp to show
  const displayTimestamp = lastDataTimestamp 
    ? formatDistanceToNow(lastDataTimestamp, { addSuffix: true })
    : stalestSource && sources[stalestSource]?.pipelineLastRun
      ? formatDistanceToNow(sources[stalestSource].pipelineLastRun!, { addSuffix: true })
      : 'Unknown';

  // Build status message
  let statusMessage = config.description;
  if (stalestSource && sources[stalestSource]) {
    const stalest = sources[stalestSource];
    statusMessage = `${stalest.label} last updated ${formatSourceAge(stalest.ageMinutes)}`;
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        config.bgClass,
        config.borderClass,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className={cn("h-4 w-4 shrink-0", config.textClass)} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium", config.textClass)}>
            {config.label}
          </p>
          {/* Source health indicators */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-[hsl(var(--portal-text-muted))]">
            {liveCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-success))]" />
                {liveCount}
              </span>
            )}
            {staleCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-warning))]" />
                {staleCount}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-error))]" />
                {criticalCount}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
          {statusMessage}
          {overallStatus === 'stale' && ". Data may be a few hours old."}
          {overallStatus === 'critical' && ". Please refresh to check for updates."}
        </p>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))] shrink-0">
        <Clock className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{displayTimestamp}</span>
      </div>
    </div>
  );
}
