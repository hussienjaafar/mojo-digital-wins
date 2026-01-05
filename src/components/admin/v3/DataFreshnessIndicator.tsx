import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Radio, Clock, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePipelineFreshness, formatAge } from '@/hooks/usePipelineFreshness';

interface DataFreshnessIndicatorProps {
  /** Optional: use a specific timestamp instead of pipeline-derived freshness */
  lastUpdated?: string | null;
  /** Expected max age in minutes (used when lastUpdated is provided) */
  expectedMaxAgeMinutes?: number;
  /** Show loading state */
  isLoading?: boolean;
  /** Show the actual timestamp vs generic status */
  showTimestamp?: boolean;
  /** Use pipeline-derived freshness (default: true) */
  usePipelineFreshness?: boolean;
  /** Which pipeline to check (if not using overall) */
  pipelineType?: string;
  /** Additional class names */
  className?: string;
}

/**
 * DataFreshnessIndicator - Shows actual data freshness status
 * 
 * By default, uses pipeline-derived freshness to show honest status.
 * Can be overridden to use a specific timestamp if needed.
 */
export function DataFreshnessIndicator({
  lastUpdated,
  expectedMaxAgeMinutes = 30,
  isLoading: externalLoading = false,
  showTimestamp = false,
  usePipelineFreshness: usePipeline = true,
  pipelineType,
  className,
}: DataFreshnessIndicatorProps) {
  const { data: freshnessData, isLoading: pipelineLoading } = usePipelineFreshness();
  
  const isLoading = externalLoading || (usePipeline && pipelineLoading);

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </Badge>
    );
  }

  // If using pipeline freshness
  if (usePipeline && freshnessData) {
    const status = pipelineType 
      ? freshnessData.pipelines.find(p => p.jobType === pipelineType)?.status || 'unknown'
      : freshnessData.overallStatus;
    
    const pipeline = pipelineType 
      ? freshnessData.pipelines.find(p => p.jobType === pipelineType)
      : freshnessData.oldestCriticalPipeline;

    const lastUpdate = pipeline?.lastRunAt || freshnessData.lastSuccessfulUpdate;
    const ageText = lastUpdate 
      ? formatAge(Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)))
      : 'Never';

    if (status === 'critical') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1 text-xs bg-status-error/10 text-status-error border-status-error/30",
                className
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {showTimestamp ? ageText : 'CRITICAL'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs font-medium text-status-error">
              Pipeline data is severely stale
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {freshnessData.overallStatusReason}
            </p>
            {pipeline && (
              <p className="text-xs text-muted-foreground mt-1">
                Last successful update: {ageText}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    if (status === 'stale') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1 text-xs bg-status-warning/10 text-status-warning border-status-warning/30",
                className
              )}
            >
              <Clock className="h-3 w-3" />
              {showTimestamp ? ageText : 'STALE'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs font-medium text-status-warning">
              Some pipelines are behind schedule
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {freshnessData.overallStatusReason}
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (status === 'unknown') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1 text-xs bg-muted/50", className)}>
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              Unknown
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Pipeline status could not be determined</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    // Live status
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 text-xs bg-status-success/10 text-status-success border-status-success/30",
              className
            )}
          >
            <Radio className="h-3 w-3 animate-pulse" />
            LIVE
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            All critical pipelines running on schedule
          </p>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Most recent update: {ageText}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Fallback: use provided lastUpdated timestamp
  if (!lastUpdated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1 text-xs bg-muted/50", className)}>
            <Clock className="h-3 w-3 text-muted-foreground" />
            No data
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">No data has been collected yet</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const parsedDate = typeof lastUpdated === 'string' ? parseISO(lastUpdated) : lastUpdated;
  const ageMinutes = differenceInMinutes(new Date(), parsedDate);
  const isStale = ageMinutes > expectedMaxAgeMinutes;
  const isCritical = ageMinutes > expectedMaxAgeMinutes * 3;

  if (isCritical) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 text-xs bg-status-error/10 text-status-error border-status-error/30",
              className
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {showTimestamp ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'CRITICAL'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Data is {formatDistanceToNow(parsedDate)} old - pipeline may be down
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Expected refresh: every {expectedMaxAgeMinutes} minutes
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isStale) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 text-xs bg-status-warning/10 text-status-warning border-status-warning/30",
              className
            )}
          >
            <Clock className="h-3 w-3" />
            {showTimestamp ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'STALE'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Last updated {formatDistanceToNow(parsedDate, { addSuffix: true })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Data may be slightly behind
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1 text-xs bg-status-success/10 text-status-success border-status-success/30",
            className
          )}
        >
          <Radio className="h-3 w-3 animate-pulse" />
          LIVE
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          Data is live - updated {formatDistanceToNow(parsedDate, { addSuffix: true })}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
