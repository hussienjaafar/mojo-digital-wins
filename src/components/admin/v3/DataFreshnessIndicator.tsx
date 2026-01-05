import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Radio, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataFreshnessIndicatorProps {
  lastUpdated: string | null | undefined;
  expectedMaxAgeMinutes?: number;
  isLoading?: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export function DataFreshnessIndicator({
  lastUpdated,
  expectedMaxAgeMinutes = 30,
  isLoading = false,
  showTimestamp = false,
  className,
}: DataFreshnessIndicatorProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </Badge>
    );
  }

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
              "gap-1 text-xs bg-destructive/10 text-destructive border-destructive/30",
              className
            )}
          >
            <AlertCircle className="h-3 w-3" />
            {showTimestamp ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'Data stale'}
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
            {showTimestamp ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'Updating...'}
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