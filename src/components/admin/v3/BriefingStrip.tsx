import { useState } from 'react';
import { 
  Radio, 
  Bell, 
  FileText,
  RefreshCw,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock
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

interface BriefingStripProps {
  onOpenBriefing: () => void;
  onOpenAlerts: () => void;
  onOpenDetails: () => void;
  alertCount?: number;
  clientMode?: 'global' | 'for_you';
  onClientModeChange?: (mode: 'global' | 'for_you') => void;
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

export function BriefingStrip({
  onOpenBriefing,
  onOpenAlerts,
  onOpenDetails,
  alertCount = 0,
  clientMode = 'for_you',
  onClientModeChange,
  className,
}: BriefingStripProps) {
  const { data: freshnessData, isLoading, refetch } = useSourceFreshness();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const status = (freshnessData?.overallStatus || 'unknown') as FreshnessStatus;
  const statusColors = getStatusColor(status);
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  // Get time since last update
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
      "flex items-center justify-between px-4 py-2 h-12 rounded-lg border",
      "bg-card/60 backdrop-blur-sm border-border/50",
      className
    )}>
      {/* Left: Status + Last Updated */}
      <div className="flex items-center gap-4">
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
      </div>

      {/* Center: Client Mode Toggle */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">Mode:</span>
        <div className="flex items-center bg-muted/50 rounded-md p-0.5">
          <Button
            variant={clientMode === 'for_you' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-6 px-2.5 text-xs font-medium rounded-sm",
              clientMode === 'for_you' && "bg-primary/10 text-primary"
            )}
            onClick={() => onClientModeChange?.('for_you')}
          >
            For You
          </Button>
          <Button
            variant={clientMode === 'global' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-6 px-2.5 text-xs font-medium rounded-sm",
              clientMode === 'global' && "bg-primary/10 text-primary"
            )}
            onClick={() => onClientModeChange?.('global')}
          >
            Global
          </Button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Refresh */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
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
              className="h-7 w-7 relative"
              onClick={onOpenAlerts}
            >
              <Bell className="h-3.5 w-3.5" />
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
          className="h-7 text-xs gap-1.5"
          onClick={onOpenBriefing}
        >
          <FileText className="h-3 w-3" />
          Briefing
        </Button>

        {/* Details link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
