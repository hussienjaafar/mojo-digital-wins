import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, parseISO, differenceInHours } from "date-fns";

export interface V3DataFreshnessIndicatorProps {
  /** ISO timestamp of last data sync */
  lastSyncedAt: string | null;
  /** Expected freshness in hours (default: 24) */
  expectedFreshnessHours?: number;
  /** Platform/source name for tooltip */
  source?: string;
  /** Additional className */
  className?: string;
  /** Show full label or just icon */
  compact?: boolean;
}

type FreshnessStatus = "fresh" | "stale" | "critical" | "unknown";

function getFreshnessStatus(
  lastSyncedAt: string | null,
  expectedHours: number
): { status: FreshnessStatus; hoursAgo: number | null } {
  if (!lastSyncedAt) {
    return { status: "unknown", hoursAgo: null };
  }

  try {
    const lastSync = parseISO(lastSyncedAt);
    const hoursAgo = differenceInHours(new Date(), lastSync);

    if (hoursAgo <= expectedHours) {
      return { status: "fresh", hoursAgo };
    } else if (hoursAgo <= expectedHours * 2) {
      return { status: "stale", hoursAgo };
    } else {
      return { status: "critical", hoursAgo };
    }
  } catch {
    return { status: "unknown", hoursAgo: null };
  }
}

const statusConfig: Record<FreshnessStatus, {
  icon: typeof Clock;
  color: string;
  bgColor: string;
  label: string;
}> = {
  fresh: {
    icon: CheckCircle2,
    color: "text-[hsl(var(--portal-success))]",
    bgColor: "bg-[hsl(var(--portal-success)/0.1)]",
    label: "Data is current",
  },
  stale: {
    icon: Clock,
    color: "text-[hsl(var(--portal-warning))]",
    bgColor: "bg-[hsl(var(--portal-warning)/0.1)]",
    label: "Data may be outdated",
  },
  critical: {
    icon: AlertTriangle,
    color: "text-[hsl(var(--portal-error))]",
    bgColor: "bg-[hsl(var(--portal-error)/0.1)]",
    label: "Data is stale",
  },
  unknown: {
    icon: Clock,
    color: "text-[hsl(var(--portal-text-muted))]",
    bgColor: "bg-[hsl(var(--portal-bg-elevated))]",
    label: "Sync status unknown",
  },
};

export const V3DataFreshnessIndicator: React.FC<V3DataFreshnessIndicatorProps> = ({
  lastSyncedAt,
  expectedFreshnessHours = 24,
  source,
  className,
  compact = false,
}) => {
  const { status, hoursAgo } = getFreshnessStatus(lastSyncedAt, expectedFreshnessHours);
  const config = statusConfig[status];
  const Icon = config.icon;

  const timeAgoLabel = lastSyncedAt
    ? formatDistanceToNow(parseISO(lastSyncedAt), { addSuffix: true })
    : "Never synced";

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{config.label}</div>
      {source && <div className="text-xs opacity-80">Source: {source}</div>}
      <div className="text-xs opacity-80">Last updated: {timeAgoLabel}</div>
      {hoursAgo !== null && (
        <div className="text-xs opacity-80">
          {hoursAgo} hours ago (expected: within {expectedFreshnessHours}h)
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
              config.bgColor,
              config.color,
              "cursor-help",
              className
            )}
            role="status"
            aria-label={`${config.label}. ${timeAgoLabel}`}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {!compact && (
              <span className="hidden sm:inline">{timeAgoLabel}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default V3DataFreshnessIndicator;
