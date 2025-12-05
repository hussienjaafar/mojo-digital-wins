import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

type Props = {
  organizationId: string;
  compact?: boolean;
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
};

export const DataFreshnessIndicator = ({ organizationId, compact = false }: Props) => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [dataFreshness, setDataFreshness] = useState<DataFreshness[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFreshnessData();
  }, [organizationId]);

  const loadFreshnessData = async () => {
    setIsLoading(true);
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
            ? (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60)
            : null
        });
      }

      // ActBlue freshness
      const { data: actblueData, count: actblueCount } = await supabase
        .from('actblue_transactions')
        .select('transaction_date', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('transaction_date', { ascending: false })
        .limit(1);

      if (actblueData && actblueData.length > 0) {
        const latestDate = actblueData[0].transaction_date;
        freshness.push({
          source: 'ActBlue',
          latestDate,
          recordCount: actblueCount || 0,
          hoursStale: latestDate 
            ? (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60)
            : null
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
            ? (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60)
            : null
        });
      }

      setDataFreshness(freshness);
    } catch (error) {
      console.error('Failed to load freshness data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (hoursStale: number | null, status?: string | null) => {
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }
    
    if (hoursStale === null) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          No data
        </Badge>
      );
    }
    
    if (hoursStale < 24) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3" />
          Fresh
        </Badge>
      );
    }
    
    if (hoursStale < 72) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="h-3 w-3" />
          {Math.round(hoursStale)}h ago
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-[10px] gap-1 bg-red-500/10 text-red-600 border-red-500/20">
        <AlertCircle className="h-3 w-3" />
        {Math.round(hoursStale / 24)}d stale
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (compact) {
    // Compact view: show overall health
    const hasStaleData = dataFreshness.some(d => d.hoursStale && d.hoursStale > 48);
    const hasFailed = syncStatuses.some(s => s.status === 'failed');
    
    if (hasFailed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertCircle className="h-3 w-3" />
                Sync Issue
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">One or more data syncs have failed. Check settings.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (hasStaleData) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                <Clock className="h-3 w-3" />
                Data may be stale
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Some data hasn't been updated in 48+ hours.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle className="h-3 w-3" />
              Data Fresh
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">All data sources are up to date.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Data Freshness</div>
      <div className="grid gap-2">
        {dataFreshness.map((item) => {
          const syncStatus = syncStatuses.find(s => 
            s.platform.toLowerCase() === item.source.toLowerCase() ||
            (s.platform === 'actblue' && item.source === 'ActBlue') ||
            (s.platform === 'meta' && item.source === 'Meta Ads') ||
            (s.platform === 'switchboard' && item.source === 'SMS')
          );
          
          return (
            <div 
              key={item.source}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.source}</span>
                <span className="text-xs text-muted-foreground">
                  {item.recordCount.toLocaleString()} records
                  {item.latestDate && ` • Latest: ${formatDistanceToNow(parseISO(item.latestDate), { addSuffix: true })}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(item.hoursStale, syncStatus?.status)}
              </div>
            </div>
          );
        })}
        
        {dataFreshness.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-2">
            No data sources connected yet
          </div>
        )}
      </div>
      
      {/* Sync status summary */}
      {syncStatuses.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Last sync attempts:
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {syncStatuses.map((sync) => (
              <TooltipProvider key={sync.platform}>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${
                        sync.status === 'success' 
                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                          : sync.status === 'failed'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {sync.platform}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
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
