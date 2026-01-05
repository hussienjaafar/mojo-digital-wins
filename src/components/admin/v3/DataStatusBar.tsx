import { 
  Radio, 
  AlertTriangle, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminPipelineHealth, formatTimeAgo } from '@/hooks/useAdminPipelineHealth';
import { cn } from '@/lib/utils';

interface DataStatusBarProps {
  onOpenDetails: () => void;
  className?: string;
}

const STATUS_CONFIG = {
  healthy: { 
    icon: Radio, 
    label: 'LIVE', 
    color: 'text-status-success',
    bgColor: 'bg-status-success/10',
    borderColor: 'border-status-success/30',
    animate: true 
  },
  warning: { 
    icon: Clock, 
    label: 'WARNING', 
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    animate: false 
  },
  stale: { 
    icon: AlertTriangle, 
    label: 'STALE', 
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    animate: false 
  },
  error: { 
    icon: AlertCircle, 
    label: 'ERROR', 
    color: 'text-status-error',
    bgColor: 'bg-status-error/10',
    borderColor: 'border-status-error/30',
    animate: false 
  },
};

export function DataStatusBar({ onOpenDetails, className }: DataStatusBarProps) {
  const { data, isLoading, error } = useAdminPipelineHealth();

  if (error) {
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

  const status = data?.overallStatus || 'healthy';
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Calculate stats
  const totalBacklog = data?.backlog.reduce((sum, b) => sum + b.pending_count, 0) || 0;
  const failingJobs = data?.jobs.filter(j => j.freshness_status === 'error').length || 0;
  
  // Find most recent run
  const mostRecentRun = data?.jobs
    .filter(j => j.last_run_at)
    .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())[0];

  const isUnhealthy = status !== 'healthy';

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2 h-12 rounded-lg border",
      "bg-card/50 backdrop-blur-sm",
      config.borderColor,
      className
    )}>
      {/* Left: Status indicator */}
      <div className="flex items-center gap-4">
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1.5 font-semibold text-xs px-2 py-0.5",
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

        {!isLoading && mostRecentRun && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Updated {formatTimeAgo(mostRecentRun.last_run_at)}
          </span>
        )}
      </div>

      {/* Center: Quick stats (conditional) */}
      <div className="flex items-center gap-4 text-xs">
        {!isLoading && (
          <>
            {/* Backlog - always show number */}
            <div className={cn(
              "hidden sm:flex items-center gap-1.5",
              totalBacklog > 0 ? "text-status-warning" : "text-muted-foreground"
            )}>
              <span>Backlog:</span>
              <span className="font-medium">{totalBacklog.toLocaleString()}</span>
            </div>

            {/* Failing jobs - only show if > 0 */}
            {failingJobs > 0 && (
              <div className="flex items-center gap-1.5 text-status-error">
                <span>Failing:</span>
                <span className="font-medium">{failingJobs}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Action button */}
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
  );
}
