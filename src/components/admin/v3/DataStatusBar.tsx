import { 
  Radio, 
  AlertTriangle, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePipelineFreshness, formatAge, FreshnessStatus } from '@/hooks/usePipelineFreshness';
import { useAdminPipelineHealth } from '@/hooks/useAdminPipelineHealth';
import { cn } from '@/lib/utils';

interface DataStatusBarProps {
  onOpenDetails: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<FreshnessStatus, {
  icon: typeof Radio;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  animate: boolean;
}> = {
  live: { 
    icon: Radio, 
    label: 'LIVE', 
    color: 'text-status-success',
    bgColor: 'bg-status-success/10',
    borderColor: 'border-status-success/30',
    animate: true 
  },
  stale: { 
    icon: Clock, 
    label: 'STALE', 
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    animate: false 
  },
  critical: { 
    icon: AlertTriangle, 
    label: 'CRITICAL', 
    color: 'text-status-error',
    bgColor: 'bg-status-error/10',
    borderColor: 'border-status-error/30',
    animate: false 
  },
  unknown: { 
    icon: AlertCircle, 
    label: 'UNKNOWN', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10',
    borderColor: 'border-muted/30',
    animate: false 
  },
};

export function DataStatusBar({ onOpenDetails, className }: DataStatusBarProps) {
  const { data: freshnessData, isLoading: freshnessLoading, refetch: refetchFreshness } = usePipelineFreshness();
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useAdminPipelineHealth();

  const isLoading = freshnessLoading || healthLoading;
  
  const handleRefresh = () => {
    refetchFreshness();
    refetchHealth();
  };

  if (!freshnessData && !isLoading) {
    return (
      <div className={cn(
        "flex items-center justify-between px-4 py-2 h-12 rounded-lg border",
        "bg-status-error/5 border-status-error/30",
        className
      )}>
        <div className="flex items-center gap-2 text-status-error">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Pipeline health unavailable</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenDetails}>
          Details <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  const status = freshnessData?.overallStatus || 'unknown';
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Calculate stats from health data
  const totalBacklog = healthData?.backlog.reduce((sum, b) => sum + b.pending_count, 0) || 0;
  const failingJobs = healthData?.jobs.filter(j => j.freshness_status === 'error').length || 0;
  
  // Get actual last updated from freshness data
  const lastUpdated = freshnessData?.lastSuccessfulUpdate;
  const lastUpdatedText = lastUpdated 
    ? formatAge(Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60)))
    : 'Never';

  const isUnhealthy = status !== 'live';

  // Build stale reason for tooltip
  const staleReason = freshnessData?.overallStatusReason || 'Unknown status';
  const stalePipelineCount = freshnessData?.criticalStaleCount || 0;

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2 h-12 rounded-lg border",
      "bg-card/50 backdrop-blur-sm",
      config.borderColor,
      className
    )}>
      {/* Left: Status indicator with tooltip */}
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1.5 font-semibold text-xs px-2 py-0.5 cursor-help",
                config.bgColor,
                config.borderColor,
                config.color
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StatusIcon className={cn("h-3 w-3", config.animate && "animate-pulse")} />
              )}
              {isLoading ? 'Loading...' : config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{staleReason}</p>
              {stalePipelineCount > 0 && freshnessData?.stalePipelines && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mt-1">Stale pipelines:</p>
                  <ul className="list-disc list-inside">
                    {freshnessData.stalePipelines.slice(0, 5).map(p => (
                      <li key={p.jobType}>
                        {p.jobName}: {formatAge(p.ageMinutes)}
                      </li>
                    ))}
                    {freshnessData.stalePipelines.length > 5 && (
                      <li>...and {freshnessData.stalePipelines.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {!isLoading && (
          <span className={cn(
            "text-xs hidden sm:inline",
            isUnhealthy ? "text-status-warning" : "text-muted-foreground"
          )}>
            Last data: {lastUpdatedText}
          </span>
        )}
      </div>

      {/* Center: Quick stats */}
      <div className="flex items-center gap-4 text-xs">
        {!isLoading && (
          <>
            {/* Backlog */}
            <div className={cn(
              "hidden sm:flex items-center gap-1.5",
              totalBacklog > 0 ? "text-status-warning" : "text-muted-foreground"
            )}>
              <span>Backlog:</span>
              <span className="font-medium">{totalBacklog.toLocaleString()}</span>
            </div>

            {/* Failing jobs */}
            {failingJobs > 0 && (
              <div className="flex items-center gap-1.5 text-status-error">
                <span>Failing:</span>
                <span className="font-medium">{failingJobs}</span>
              </div>
            )}

            {/* Stale pipelines indicator */}
            {stalePipelineCount > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-status-warning">
                <span>Stale:</span>
                <span className="font-medium">{stalePipelineCount} pipeline(s)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
        
        <Button 
          variant={isUnhealthy ? "outline" : "ghost"} 
          size="sm"
          onClick={onOpenDetails}
          className={cn(
            "h-7 text-xs gap-1",
            isUnhealthy && config.borderColor,
            isUnhealthy && config.color
          )}
        >
          {isUnhealthy ? 'View Issues' : 'Pipeline Details'}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
