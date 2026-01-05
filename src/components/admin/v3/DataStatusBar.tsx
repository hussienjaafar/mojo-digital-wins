import { 
  Radio, 
  AlertTriangle, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSourceFreshness, formatSourceAge, getStatusColor, FreshnessStatus } from '@/hooks/useSourceFreshness';
import { useAdminPipelineHealth } from '@/hooks/useAdminPipelineHealth';
import { cn } from '@/lib/utils';

interface DataStatusBarProps {
  onOpenDetails: () => void;
  className?: string;
}

const STATUS_ICONS = {
  live: CheckCircle,
  stale: Clock,
  critical: AlertTriangle,
  unknown: AlertCircle,
};

export function DataStatusBar({ onOpenDetails, className }: DataStatusBarProps) {
  const { data: freshnessData, isLoading: freshnessLoading, refetch: refetchFreshness } = useSourceFreshness();
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
          <span className="text-sm font-medium">Data sources unavailable</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenDetails}>
          Details <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  const status = freshnessData?.overallStatus || 'unknown';
  const statusColors = getStatusColor(status);
  const StatusIcon = STATUS_ICONS[status];

  // Calculate stats from health data
  const totalBacklog = healthData?.backlog.reduce((sum, b) => sum + b.pending_count, 0) || 0;
  const failingJobs = healthData?.jobs.filter(j => j.freshness_status === 'error').length || 0;
  
  // Get actual last updated from freshness data
  const lastUpdated = freshnessData?.lastDataTimestamp;
  const lastUpdatedText = lastUpdated 
    ? formatSourceAge(Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60)))
    : 'No data';

  const isUnhealthy = status !== 'live';

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2 h-12 rounded-lg border",
      "bg-card/50 backdrop-blur-sm",
      statusColors.border,
      className
    )}>
      {/* Left: Overall status + per-source indicators */}
      <div className="flex items-center gap-4">
        {/* Overall Status Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1.5 font-semibold text-xs px-2 py-0.5 cursor-help",
                statusColors.bg,
                statusColors.border,
                statusColors.text
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StatusIcon className={cn("h-3 w-3", status === 'live' && "animate-pulse")} />
              )}
              {isLoading ? 'Loading...' : status.toUpperCase()}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">
                {status === 'live' && 'All data sources are fresh'}
                {status === 'stale' && 'Some data sources have delayed updates'}
                {status === 'critical' && 'Critical data gap - sources are significantly behind'}
                {status === 'unknown' && 'Unable to determine data freshness'}
              </p>
              {freshnessData?.dataGapDays && freshnessData.dataGapDays > 0 && (
                <p className="text-xs text-status-error">
                  Data gap: {freshnessData.dataGapDays} day(s) since last update
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Per-Source Status Indicators */}
        {!isLoading && freshnessData && (
          <div className="flex items-center gap-2 text-xs">
            {Object.values(freshnessData.sources).map(source => {
              const sourceColors = getStatusColor(source.status);
              return (
                <Tooltip key={source.source}>
                  <TooltipTrigger asChild>
                    <span className={cn(
                      "inline-flex items-center gap-1 cursor-help",
                      sourceColors.text
                    )}>
                      <span>{source.icon}</span>
                      <span className="hidden sm:inline">{sourceColors.icon}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">{source.label}</p>
                      <p>Latest: {formatSourceAge(source.ageMinutes)}</p>
                      <p>{source.articleCount24h.toLocaleString()} items in 24h</p>
                      {source.pipelineLastRun && (
                        <p className="text-muted-foreground">
                          Pipeline ran: {formatSourceAge(
                            Math.floor((Date.now() - source.pipelineLastRun.getTime()) / (1000 * 60))
                          )}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {!isLoading && (
          <span className={cn(
            "text-xs hidden md:inline",
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
            {totalBacklog > 0 && (
              <div className={cn(
                "hidden sm:flex items-center gap-1.5",
                totalBacklog > 100 ? "text-status-warning" : "text-muted-foreground"
              )}>
                <span>Backlog:</span>
                <span className="font-medium">{totalBacklog.toLocaleString()}</span>
              </div>
            )}

            {/* Failing jobs */}
            {failingJobs > 0 && (
              <div className="flex items-center gap-1.5 text-status-error">
                <span>Failing:</span>
                <span className="font-medium">{failingJobs}</span>
              </div>
            )}

            {/* 24h totals */}
            {freshnessData && (
              <div className="hidden lg:flex items-center gap-1.5 text-muted-foreground">
                <span>24h:</span>
                <span className="font-medium">
                  {(
                    (freshnessData.sources.rss?.articleCount24h || 0) +
                    (freshnessData.sources.google_news?.articleCount24h || 0)
                  ).toLocaleString()} articles
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="font-medium">
                  {(freshnessData.sources.bluesky?.articleCount24h || 0).toLocaleString()} posts
                </span>
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
            isUnhealthy && statusColors.border,
            isUnhealthy && statusColors.text
          )}
        >
          {isUnhealthy ? 'View Issues' : 'Details'}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
