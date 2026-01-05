import { 
  Radio, 
  AlertTriangle, 
  AlertCircle, 
  Clock,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  useSourceFreshness, 
  formatSourceAge, 
  getStatusColor,
  FreshnessStatus,
  SourceType,
  SourceFreshnessRecord
} from '@/hooks/useSourceFreshness';
import { cn } from '@/lib/utils';

interface SourceFreshnessIndicatorProps {
  className?: string;
  compact?: boolean;
}

const STATUS_ICONS = {
  live: CheckCircle,
  stale: Clock,
  critical: AlertTriangle,
  unknown: AlertCircle,
};

function SourceBadge({ source, compact }: { source: SourceFreshnessRecord; compact?: boolean }) {
  const colors = getStatusColor(source.status);
  const Icon = STATUS_ICONS[source.status];

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-1 text-xs cursor-help",
            colors.text
          )}>
            <span>{source.icon}</span>
            <Icon className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs">
            <p className="font-medium">{source.label}</p>
            <p className="text-muted-foreground">
              {formatSourceAge(source.ageMinutes)} • {source.articleCount24h.toLocaleString()} in 24h
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-help",
          colors.bg,
          colors.border,
          "border"
        )}>
          <span>{source.icon}</span>
          <span className={cn("font-medium", colors.text)}>
            {source.label}
          </span>
          <Icon className={cn("h-3 w-3", colors.text)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs space-y-1">
          <p className="font-medium">{source.label}</p>
          <p className="text-muted-foreground">
            Latest data: {formatSourceAge(source.ageMinutes)}
          </p>
          <p className="text-muted-foreground">
            {source.articleCount24h.toLocaleString()} items in last 24h
          </p>
          {source.pipelineLastRun && (
            <p className="text-muted-foreground">
              Pipeline: {formatSourceAge(
                Math.floor((Date.now() - source.pipelineLastRun.getTime()) / (1000 * 60))
              )}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function SourceFreshnessIndicator({ className, compact = false }: SourceFreshnessIndicatorProps) {
  const { data, isLoading } = useSourceFreshness();

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">No data</span>
      </div>
    );
  }

  const statusColors = getStatusColor(data.overallStatus);
  const StatusIcon = STATUS_ICONS[data.overallStatus];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Overall status badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1.5 font-semibold text-xs cursor-help",
              statusColors.bg,
              statusColors.border,
              statusColors.text
            )}
          >
            <StatusIcon className={cn(
              "h-3 w-3",
              data.overallStatus === 'live' && "animate-pulse"
            )} />
            {data.overallStatus.toUpperCase()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">
              {data.overallStatus === 'live' && 'All sources are up to date'}
              {data.overallStatus === 'stale' && 'Some sources have delayed data'}
              {data.overallStatus === 'critical' && 'Critical data gap detected'}
              {data.overallStatus === 'unknown' && 'Unable to determine data freshness'}
            </p>
            {data.lastDataTimestamp && (
              <p className="text-xs text-muted-foreground">
                Latest data: {data.lastDataTimestamp.toLocaleString()}
              </p>
            )}
            {data.dataGapDays > 0 && (
              <p className="text-xs text-status-error">
                Data gap: {data.dataGapDays} day(s)
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Per-source indicators */}
      <div className="flex items-center gap-2">
        {Object.values(data.sources).map(source => (
          <SourceBadge 
            key={source.source} 
            source={source} 
            compact={compact} 
          />
        ))}
      </div>
    </div>
  );
}

// Compact version for headers
export function SourceFreshnessCompact({ className }: { className?: string }) {
  const { data, isLoading } = useSourceFreshness();

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {Object.values(data.sources).map(source => {
        const colors = getStatusColor(source.status);
        return (
          <Tooltip key={source.source}>
            <TooltipTrigger asChild>
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[10px] cursor-help",
                colors.text
              )}>
                {source.icon}
                {source.status === 'live' ? '✓' : source.status === 'stale' ? '⚠' : '✗'}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {source.label}: {formatSourceAge(source.ageMinutes)}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
