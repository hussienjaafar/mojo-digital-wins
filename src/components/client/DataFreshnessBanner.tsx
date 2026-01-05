import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataFreshnessBannerProps {
  lastUpdated: Date;
  staleThresholdMinutes?: number;
  className?: string;
}

export function DataFreshnessBanner({ 
  lastUpdated, 
  staleThresholdMinutes = 30,
  className 
}: DataFreshnessBannerProps) {
  const minutesAgo = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60));
  const isStale = minutesAgo > staleThresholdMinutes;
  const isVeryStale = minutesAgo > staleThresholdMinutes * 2;

  if (!isStale) {
    return null; // Don't show banner if data is fresh
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        isVeryStale 
          ? "bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.2)]" 
          : "bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.2)]",
        className
      )}
      role="alert"
    >
      {isVeryStale ? (
        <WifiOff className="h-4 w-4 text-[hsl(var(--portal-error))] shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isVeryStale ? "text-[hsl(var(--portal-error))]" : "text-[hsl(var(--portal-warning))]"
        )}>
          {isVeryStale ? "Data may be outdated" : "Data is slightly stale"}
        </p>
        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
          Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}. 
          {isVeryStale && " Click refresh to get latest data."}
        </p>
      </div>
      <Clock className="h-4 w-4 text-[hsl(var(--portal-text-muted))] shrink-0" />
    </div>
  );
}
