import { useState } from 'react';
import { 
  RefreshCw,
  Bell,
  FileText,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSourceFreshness, formatSourceAge, getStatusColor, type FreshnessStatus } from '@/hooks/useSourceFreshness';
import { cn } from '@/lib/utils';

interface ExecutiveSignalBarProps {
  actionableSignalCount: number;
  onOpenBriefing: () => void;
  onOpenAlerts: () => void;
  onOpenDetails: () => void;
  alertCount?: number;
  className?: string;
}

const STATUS_CONFIG = {
  live: { 
    icon: CheckCircle, 
    label: 'LIVE',
    pulseClass: 'animate-pulse'
  },
  stale: { 
    icon: Clock, 
    label: 'STALE',
    pulseClass: ''
  },
  critical: { 
    icon: AlertTriangle, 
    label: 'DEGRADED',
    pulseClass: ''
  },
  unknown: { 
    icon: Clock, 
    label: 'UNKNOWN',
    pulseClass: ''
  },
};

export function ExecutiveSignalBar({
  actionableSignalCount,
  onOpenBriefing,
  onOpenAlerts,
  onOpenDetails,
  alertCount = 0,
  className,
}: ExecutiveSignalBarProps) {
  const { data: freshnessData, isLoading, refetch } = useSourceFreshness();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const status = (freshnessData?.overallStatus || 'unknown') as FreshnessStatus;
  const statusColors = getStatusColor(status);
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const lastUpdated = freshnessData?.lastDataTimestamp;
  const lastUpdatedText = lastUpdated 
    ? formatSourceAge(Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60)))
    : 'Unknown';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3 rounded-lg border",
      "bg-card/80 backdrop-blur-sm border-border/50",
      className
    )}>
      {/* Left: Status + Last Updated + Signal Count */}
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1.5 font-semibold text-xs px-2.5 py-1 cursor-help",
                statusColors.bg,
                statusColors.border,
                statusColors.text
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StatusIcon className={cn("h-3 w-3", statusConfig.pulseClass)} />
              )}
              {isLoading ? 'Loading...' : statusConfig.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {status === 'live' && 'All data sources are fresh and active'}
              {status === 'stale' && 'Some data sources have delayed updates'}
              {status === 'critical' && 'Data pipeline is experiencing issues'}
              {status === 'unknown' && 'Unable to determine system status'}
            </p>
          </TooltipContent>
        </Tooltip>

        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdatedText}
          </span>
        )}

        {/* Actionable Signals Count - Primary indicator */}
        {actionableSignalCount > 0 && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border/50">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {actionableSignalCount}
            </span>
            <span className="text-xs text-muted-foreground">
              actionable {actionableSignalCount === 1 ? 'signal' : 'signals'}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Refresh */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>

        {/* Alerts */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative"
              onClick={onOpenAlerts}
            >
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {alertCount > 0 ? `${alertCount} unread alerts` : 'No alerts'}
          </TooltipContent>
        </Tooltip>

        {/* Briefing Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onOpenBriefing}
        >
          <FileText className="h-3.5 w-3.5" />
          Briefing
        </Button>

        {/* Details link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={onOpenDetails}
            >
              Details
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View pipeline health & system details</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
