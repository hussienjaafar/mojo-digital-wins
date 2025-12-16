import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Clock, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow, parseISO, format, differenceInHours, differenceInDays } from "date-fns";
import { toast } from "sonner";

type Props = {
  organizationId: string;
  compact?: boolean;
  showAlerts?: boolean;
};

type SyncStatus = {
  platform: string;
  lastSync: string | null;
  status: string | null;
  hoursStale: number | null;
};

type DataFreshness = {
  source: string;
  latestDate: string | null;
  recordCount: number;
  hoursStale: number | null;
  expectedFreshnessHours: number; // Platform-specific expected freshness
  isWebhookBased: boolean;
};

// Platform-specific expected freshness (hours)
const EXPECTED_FRESHNESS: Record<string, { hours: number; isWebhook: boolean; description: string }> = {
  'Meta Ads': { hours: 48, isWebhook: false, description: 'Meta API has 24-48h reporting delay' },
  'ActBlue': { hours: 1, isWebhook: true, description: 'Real-time via webhook, or 6h via CSV sync' },
  'SMS': { hours: 24, isWebhook: false, description: 'Daily sync from Switchboard' },
};

export const DataFreshnessIndicator = ({ organizationId, compact = false, showAlerts = true }: Props) => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [dataFreshness, setDataFreshness] = useState<DataFreshness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [webhookCount, setWebhookCount] = useState<number>(0);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    loadFreshnessData();
  }, [organizationId]);

  const loadFreshnessData = async () => {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      // Get sync statuses from credentials
      const { data: credentials } = await supabase
        .from('client_api_credentials')
        .select('platform, last_sync_at, last_sync_status')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (credentials) {
        setSyncStatuses(credentials.map(c => ({
          platform: c.platform,
          lastSync: c.last_sync_at,
          status: c.last_sync_status,
          hoursStale: c.last_sync_at 
            ? (Date.now() - new Date(c.last_sync_at).getTime()) / (1000 * 60 * 60)
            : null
        })));
      }

      // Get actual data freshness
      const freshness: DataFreshness[] = [];

      // Meta metrics freshness
      const { data: metaData, count: metaCount } = await supabase
        .from('meta_ad_metrics')
        .select('date', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })
        .limit(1);

      if (metaData && metaData.length > 0) {
        const latestDate = metaData[0].date;
        freshness.push({
          source: 'Meta Ads',
          latestDate,
          recordCount: metaCount || 0,
          hoursStale: latestDate 
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['Meta Ads'].hours,
          isWebhookBased: false
        });
      } else if (credentials?.some(c => c.platform === 'meta')) {
        // Meta configured but no data
        freshness.push({
          source: 'Meta Ads',
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['Meta Ads'].hours,
          isWebhookBased: false
        });
      }

      // ActBlue freshness (using secure view for defense-in-depth PII protection)
      const { data: actblueData, count: actblueCount } = await supabase
        .from('actblue_transactions_secure')
        .select('transaction_date', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('transaction_date', { ascending: false })
        .limit(1);

      // Check for recent webhook activity (last 24h) - using secure view
      const { count: recentWebhooks } = await supabase
        .from('actblue_transactions_secure')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setWebhookCount(recentWebhooks || 0);

      if (actblueData && actblueData.length > 0) {
        const latestDate = actblueData[0].transaction_date;
        freshness.push({
          source: 'ActBlue',
          latestDate,
          recordCount: actblueCount || 0,
          hoursStale: latestDate 
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['ActBlue'].hours,
          isWebhookBased: true
        });
      } else if (credentials?.some(c => c.platform === 'actblue')) {
        freshness.push({
          source: 'ActBlue',
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['ActBlue'].hours,
          isWebhookBased: true
        });
      }

      // SMS freshness
      const { data: smsData, count: smsCount } = await supabase
        .from('sms_campaigns')
        .select('send_date', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('send_date', { ascending: false })
        .limit(1);

      if (smsData && smsData.length > 0) {
        const latestDate = smsData[0].send_date;
        freshness.push({
          source: 'SMS',
          latestDate,
          recordCount: smsCount || 0,
          hoursStale: latestDate 
            ? differenceInHours(new Date(), parseISO(latestDate))
            : null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['SMS'].hours,
          isWebhookBased: false
        });
      } else if (credentials?.some(c => c.platform === 'switchboard')) {
        freshness.push({
          source: 'SMS',
          latestDate: null,
          recordCount: 0,
          hoursStale: null,
          expectedFreshnessHours: EXPECTED_FRESHNESS['SMS'].hours,
          isWebhookBased: false
        });
      }

      setDataFreshness(freshness);
    } catch (error) {
      setHasLoadError(true);
      toast.error('Failed to load data freshness', { description: 'Unable to check data status. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (item: DataFreshness, status?: string | null) => {
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertCircle className="h-3 w-3" />
          Sync Failed
        </Badge>
      );
    }
    
    if (item.hoursStale === null) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-[hsl(var(--portal-text-muted))]">
          <Clock className="h-3 w-3" />
          No data
        </Badge>
      );
    }

    // Check against expected freshness for this platform
    const freshnessThreshold = item.expectedFreshnessHours;
    const criticalThreshold = freshnessThreshold * 3; // 3x expected = critical
    
    if (item.hoursStale <= freshnessThreshold) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
          <CheckCircle className="h-3 w-3" />
          Fresh
        </Badge>
      );
    }
    
    if (item.hoursStale <= criticalThreshold) {
      const daysStale = Math.round(item.hoursStale / 24);
      return (
        <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.2)]">
          <Clock className="h-3 w-3" />
          {daysStale > 0 ? `${daysStale}d ago` : `${Math.round(item.hoursStale)}h ago`}
        </Badge>
      );
    }
    
    const daysStale = Math.round(item.hoursStale / 24);
    return (
      <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]">
        <AlertCircle className="h-3 w-3" />
        {daysStale}d stale!
      </Badge>
    );
  };

  const getCriticalAlerts = () => {
    const alerts: { type: 'warning' | 'error'; message: string; source: string }[] = [];
    
    for (const item of dataFreshness) {
      if (item.hoursStale === null && item.recordCount === 0) {
        alerts.push({
          type: 'warning',
          message: `No ${item.source} data received yet`,
          source: item.source
        });
        continue;
      }

      const criticalThreshold = item.expectedFreshnessHours * 3;
      
      if (item.hoursStale && item.hoursStale > criticalThreshold) {
        const days = Math.round(item.hoursStale / 24);
        alerts.push({
          type: 'error',
          message: `${item.source} data is ${days} days behind. ${EXPECTED_FRESHNESS[item.source]?.description || ''}`,
          source: item.source
        });
      }
    }

    // Check for ActBlue webhook activity
    const actblueItem = dataFreshness.find(d => d.source === 'ActBlue');
    if (actblueItem && actblueItem.recordCount > 0 && webhookCount === 0 && actblueItem.hoursStale && actblueItem.hoursStale > 24) {
      alerts.push({
        type: 'warning',
        message: 'No ActBlue webhook events in 24h. Verify webhook is configured in ActBlue dashboard.',
        source: 'ActBlue'
      });
    }

    return alerts;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-3 w-3 animate-spin text-[hsl(var(--portal-text-muted))]" />
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">Loading...</span>
      </div>
    );
  }

  if (compact) {
    // Compact view: show overall health
    const hasCritical = dataFreshness.some(d => 
      d.hoursStale && d.hoursStale > (d.expectedFreshnessHours * 3)
    );
    const hasStaleData = dataFreshness.some(d => 
      d.hoursStale && d.hoursStale > d.expectedFreshnessHours
    );
    const hasFailed = syncStatuses.some(s => s.status === 'failed');
    
    if (hasLoadError) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]">
                <AlertCircle className="h-3 w-3" />
                Load Error
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
              <p className="text-xs">Failed to load data freshness status. Please refresh.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (hasFailed || hasCritical) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertCircle className="h-3 w-3" />
                {hasFailed ? 'Sync Failed' : 'Data Critical'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
              <p className="text-xs">
                {hasFailed 
                  ? 'One or more data syncs have failed. Check settings.' 
                  : 'Data is significantly behind expected freshness levels.'
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (hasStaleData) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.2)]">
                <Clock className="h-3 w-3" />
                Data Delayed
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
              <p className="text-xs">Some data is behind expected freshness levels.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
              <CheckCircle className="h-3 w-3" />
              Data Fresh
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
            <p className="text-xs">All data sources are within expected freshness.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const alerts = getCriticalAlerts();

  // Full view
  return (
    <div className="space-y-3">
      {/* Load Error Alert */}
      {hasLoadError && (
        <div className="p-3 rounded-md bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.2)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
            <span className="text-sm text-[hsl(var(--portal-error))]">Failed to load data freshness status</span>
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <Alert 
              key={idx} 
              variant={alert.type === 'error' ? 'destructive' : 'default'}
              className="py-2"
            >
              {alert.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription className="text-xs ml-2">
                {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="text-sm font-medium">Data Freshness</div>
      <div className="grid gap-2">
        {dataFreshness.map((item) => {
          const syncStatus = syncStatuses.find(s => 
            s.platform.toLowerCase() === item.source.toLowerCase() ||
            (s.platform === 'actblue' && item.source === 'ActBlue') ||
            (s.platform === 'meta' && item.source === 'Meta Ads') ||
            (s.platform === 'switchboard' && item.source === 'SMS')
          );
          
          const platformInfo = EXPECTED_FRESHNESS[item.source];
          
          return (
            <div 
              key={item.source}
              className="flex items-center justify-between p-2 rounded-md bg-[hsl(var(--portal-bg-elevated))]"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.source}</span>
                  {platformInfo && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label="Explain data freshness" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] rounded-sm"><Info className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" /></button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
                          <p className="text-xs max-w-48">{platformInfo.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {item.recordCount.toLocaleString()} records
                  {item.latestDate && (
                    <>
                      {' • Latest: '}
                      {differenceInDays(new Date(), parseISO(item.latestDate)) > 7 
                        ? format(parseISO(item.latestDate), 'MMM d, yyyy')
                        : formatDistanceToNow(parseISO(item.latestDate), { addSuffix: true })
                      }
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(item, syncStatus?.status)}
              </div>
            </div>
          );
        })}
        
        {dataFreshness.length === 0 && (
          <div className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-2">
            No data sources connected yet
          </div>
        )}
      </div>
      
      {/* Sync status summary */}
      {syncStatuses.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-[hsl(var(--portal-text-muted))]">
            Last sync attempts:
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {syncStatuses.map((sync) => (
              <TooltipProvider key={sync.platform}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${
                        sync.status === 'success' 
                          ? 'bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]'
                          : sync.status === 'failed'
                          ? 'bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]'
                          : 'text-[hsl(var(--portal-text-muted))]'
                      }`}
                    >
                      {sync.platform}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] shadow-md rounded-lg">
                    <p className="text-xs">
                      {sync.lastSync 
                        ? `Last synced ${formatDistanceToNow(parseISO(sync.lastSync), { addSuffix: true })}`
                        : 'Never synced'
                      }
                      {sync.status && ` (${sync.status})`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataFreshnessIndicator;