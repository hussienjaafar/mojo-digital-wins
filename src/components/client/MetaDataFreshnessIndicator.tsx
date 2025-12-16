import { useState } from 'react';
import { useMetaDataFreshness } from '@/hooks/useMetaDataFreshness';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PortalBadge } from '@/components/portal/PortalBadge';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Info,
  Loader2,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Props = {
  organizationId: string;
  compact?: boolean;
};

/**
 * Visual indicator for Meta Ads data freshness
 * Shows users:
 * - When data was last synced
 * - How current the actual data is
 * - Whether the delay is normal (Meta has 24-48h processing delay)
 * - Ability to trigger a manual sync
 */
export function MetaDataFreshnessIndicator({ organizationId, compact = false }: Props) {
  const {
    lastSyncAt,
    lastSyncStatus,
    latestDataDate,
    dataLagDays,
    lagReason,
    isLoading,
    isSyncing,
    syncError,
    metaApiLatencyHours,
    freshnessMessage,
    triggerSync,
    refresh,
  } = useMetaDataFreshness(organizationId);
  
  const [isOpen, setIsOpen] = useState(false);

  const handleSync = async () => {
    const result = await triggerSync();
    if (result.success) {
      toast.success('Meta Ads sync completed', {
        description: `${result.insightRecords} records synced. Latest data: ${result.latestDataDate || 'N/A'}`
      });
    } else {
      toast.error('Sync failed', {
        description: result.message
      });
    }
    await refresh();
  };

  // Determine status color and icon
  const getStatusInfo = () => {
    if (isLoading || isSyncing) {
      return { 
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, 
        variant: 'neutral' as const,
        label: isSyncing ? 'Syncing...' : 'Loading...'
      };
    }

    if (lastSyncStatus === 'error' || syncError) {
      return { 
        icon: <AlertTriangle className="h-3.5 w-3.5" />, 
        variant: 'error' as const,
        label: 'Sync Error'
      };
    }

    if (!latestDataDate) {
      return { 
        icon: <Info className="h-3.5 w-3.5" />, 
        variant: 'neutral' as const,
        label: 'No Data'
      };
    }

    if (dataLagDays <= 2) {
      return { 
        icon: <CheckCircle className="h-3.5 w-3.5" />, 
        variant: 'success' as const,
        label: 'Current'
      };
    }

    if (dataLagDays <= 4) {
      return { 
        icon: <Clock className="h-3.5 w-3.5" />, 
        variant: 'warning' as const,
        label: `${dataLagDays}d behind`
      };
    }

    return { 
      icon: <AlertTriangle className="h-3.5 w-3.5" />, 
      variant: 'error' as const,
      label: `${dataLagDays}d stale`
    };
  };

  const status = getStatusInfo();

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-1 rounded-md" aria-label={`Meta Ads data status: ${status.label}`}>
              <PortalBadge variant={status.variant} className="gap-1">
                {status.icon}
                {status.label}
              </PortalBadge>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
            <div className="text-xs space-y-1">
              <p className="font-medium">Meta Ads Data Status</p>
              {latestDataDate && (
                <p>Latest data: {format(new Date(latestDataDate), 'MMM d, yyyy')}</p>
              )}
              {lastSyncAt && (
                <p>Last sync: {formatDistanceToNow(lastSyncAt, { addSuffix: true })}</p>
              )}
              <p className="text-[hsl(var(--portal-text-muted))]">{lagReason}</p>
              <p className="text-[hsl(var(--portal-text-muted))] text-[10px] mt-1">
                Meta API has a normal 24-48h processing delay
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-2 text-xs"
        >
          {status.icon}
          <span className="hidden sm:inline">{status.label}</span>
          <span className="sm:hidden">
            {latestDataDate 
              ? format(new Date(latestDataDate), 'MMM d')
              : 'No data'
            }
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="portal-theme w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Meta Ads Data Status</h4>
            <PortalBadge variant={status.variant} className="gap-1">
              {status.icon}
              {status.label}
            </PortalBadge>
          </div>

          <div className="space-y-3 text-sm">
            {/* Latest Data Date */}
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--portal-text-muted))] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Latest data
              </span>
              <span className="font-medium">
                {latestDataDate 
                  ? format(new Date(latestDataDate), 'MMM d, yyyy')
                  : 'No data available'
                }
              </span>
            </div>

            {/* Last Sync Time */}
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--portal-text-muted))] flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Last synced
              </span>
              <span className="font-medium">
                {lastSyncAt 
                  ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
                  : 'Never'
                }
              </span>
            </div>

            {/* Data Lag */}
            {dataLagDays > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--portal-text-muted))] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Data lag
                </span>
                <span className="font-medium">
                  {dataLagDays} day{dataLagDays !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Meta API Latency */}
            {metaApiLatencyHours !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--portal-text-muted))] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Meta API latency
                </span>
                <span className="font-medium">
                  {metaApiLatencyHours}h
                </span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="rounded-md bg-[hsl(var(--portal-bg-elevated))] p-3 text-xs text-[hsl(var(--portal-text-muted))]">
            <p className="font-medium mb-1">About Meta data delays:</p>
            <p>{lagReason || 'Meta Ads API typically has a 24-48 hour data processing delay. This is normal and expected.'}</p>
            {freshnessMessage && (
              <p className="mt-1 text-[10px]">{freshnessMessage}</p>
            )}
          </div>

          {/* Sync Error */}
          {syncError && (
            <div className="rounded-md bg-[hsl(var(--portal-error)/0.12)] p-3 text-xs text-[hsl(var(--portal-error))]">
              <p className="font-medium">Sync Error</p>
              <p>{syncError}</p>
            </div>
          )}

          {/* Sync Button */}
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="w-full"
            size="sm"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>

          <p className="text-[10px] text-[hsl(var(--portal-text-muted))] text-center">
            Syncing fetches the latest available data from Meta's API
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
