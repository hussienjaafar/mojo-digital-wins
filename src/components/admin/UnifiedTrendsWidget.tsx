import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, GripVertical, RefreshCw, Newspaper, Users, Flame } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import { useUnifiedTrends, getSpikeRatioColor, formatSpikeRatio } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface UnifiedTrendsWidgetProps {
  showDragHandle?: boolean;
  compact?: boolean;
}

export function UnifiedTrendsWidget({ showDragHandle = false, compact = false }: UnifiedTrendsWidgetProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: compact ? 8 : 10 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getSourceIcon = (sourceTypes: string[]) => {
    const hasNews = sourceTypes.includes('news');
    const hasSocial = sourceTypes.includes('social');
    
    if (hasNews && hasSocial) {
      return (
        <div className="flex items-center gap-0.5">
          <Newspaper className="h-3 w-3 text-blue-400" />
          <Users className="h-3 w-3 text-purple-400" />
        </div>
      );
    }
    if (hasNews) return <Newspaper className="h-3 w-3 text-blue-400" />;
    if (hasSocial) return <Users className="h-3 w-3 text-purple-400" />;
    return <TrendingUp className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="portal-card portal-widget-teal h-full flex flex-col">
      <div className={`p-4 pb-3 flex-shrink-0 portal-widget-header-teal ${showDragHandle ? "cursor-move" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showDragHandle && (
              <GripVertical className="h-4 w-4 portal-text-secondary" />
            )}
            <div className="portal-widget-icon portal-widget-icon-teal">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold portal-text-primary">Trending Now</h3>
              <p className="text-xs portal-text-secondary">
                {stats.breakthroughs > 0 && (
                  <span className="text-orange-400">{stats.breakthroughs} rising</span>
                )}
                {stats.breakthroughs > 0 && stats.multiSourceTrends > 0 && ' • '}
                {stats.multiSourceTrends > 0 && (
                  <span>{stats.multiSourceTrends} cross-platform</span>
                )}
                {stats.breakthroughs === 0 && stats.multiSourceTrends === 0 && 'Real-time snapshot'}
              </p>
            </div>
          </div>
          <V3Button 
            variant="ghost" 
            size="icon-sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </V3Button>
        </div>
      </div>
      
      <div className="p-4 pt-0 flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(compact ? 5 : 8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <TrendingUp className="h-10 w-10 portal-text-secondary mb-2 opacity-50" />
            <p className="text-sm portal-text-secondary">No trending topics</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-1.5">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer group",
                    "bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))]",
                    trend.is_breakthrough && trend.spike_ratio >= 3 && "ring-1 ring-orange-500/30"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-5 text-center">
                    <span className={cn(
                      "text-sm font-bold",
                      index < 3 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {trend.is_breakthrough && trend.spike_ratio >= 3 && (
                        <Flame className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium portal-text-primary truncate group-hover:text-primary transition-colors">
                        {trend.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                      {getSourceIcon(trend.source_types)}
                      <span className="text-xs text-muted-foreground">
                        {trend.total_mentions_24h.toLocaleString()} mentions
                        {trend.source_count >= 2 && (
                          <span className="text-green-400 ml-1">• Cross-platform</span>
                        )}
                      </span>
                    </div>
                    
                    {trend.spike_ratio >= 2 && (
                      <span className={cn("text-xs font-medium mt-0.5 block", getSpikeRatioColor(trend.spike_ratio))}>
                        {formatSpikeRatio(trend.spike_ratio)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
