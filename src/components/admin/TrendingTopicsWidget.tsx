import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Flame, GripVertical, RefreshCw, Newspaper, Users, ArrowUpRight, Zap, Link, Rocket, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedTrends, getSpikeRatioColor, formatSpikeRatio } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface TrendingTopicsWidgetProps {
  showDragHandle?: boolean;
}

// Trend stage badge colors and labels
const TREND_STAGE_CONFIG: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  emerging: { label: 'Emerging', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  surging: { label: 'Surging', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  peaking: { label: 'Peaking', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  declining: { label: 'Declining', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  stable: { label: '', color: '' },
};

export function TrendingTopicsWidget({ showDragHandle = false }: TrendingTopicsWidgetProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: 10 });
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

  const formatTime = (lastUpdated: string) => {
    const diff = Date.now() - new Date(lastUpdated).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
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
                  <span className="text-orange-400 font-medium">{stats.breakthroughs} rising</span>
                )}
                {stats.breakthroughs > 0 && stats.multiSourceTrends > 0 && ' • '}
                {stats.multiSourceTrends > 0 && (
                  <span>{stats.multiSourceTrends} cross-platform</span>
                )}
                {stats.breakthroughs === 0 && stats.multiSourceTrends === 0 && 'Real-time snapshot'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
      
      <div className="p-4 pt-0 flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <TrendingUp className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm portal-text-secondary">No trending topics right now</p>
            <p className="text-xs portal-text-secondary mt-1">Check back soon</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-1.5">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer group",
                    "bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))]",
                    trend.is_breaking && "ring-1 ring-red-500/40 bg-red-500/5",
                    !trend.is_breaking && trend.is_breakthrough && trend.spike_ratio >= 3 && "ring-1 ring-orange-500/30 bg-orange-500/5"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 text-center pt-0.5">
                    <span className={cn(
                      "text-sm font-bold",
                      index < 3 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {trend.is_breaking && (
                        <Zap className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                      )}
                      {!trend.is_breaking && trend.trend_stage === 'emerging' && (
                        <Rocket className="h-3.5 w-3.5 text-green-400" />
                      )}
                      {!trend.is_breaking && trend.trend_stage === 'surging' && (
                        <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                      )}
                      {!trend.is_breaking && trend.trend_stage === 'peaking' && (
                        <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                      )}
                      {trend.trend_stage === 'declining' && (
                        <TrendingDown className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="text-sm font-semibold portal-text-primary truncate group-hover:text-primary transition-colors" title={trend.name}>
                        {trend.name}
                      </span>
                      {/* Trend stage badge */}
                      {trend.trend_stage && trend.trend_stage !== 'stable' && !trend.is_breaking && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                          TREND_STAGE_CONFIG[trend.trend_stage]?.color
                        )}>
                          {TREND_STAGE_CONFIG[trend.trend_stage]?.label}
                        </span>
                      )}
                      {trend.entity_type === 'person' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">Person</span>
                      )}
                      {trend.entity_type === 'event' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">Event</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {getSourceIcon(trend.source_types)}
                      <span className="text-xs text-muted-foreground">
                        {trend.total_mentions_24h.toLocaleString()} mentions
                        {trend.source_count >= 2 && (
                          <span className="text-green-400 ml-1">• Cross-platform</span>
                        )}
                        {/* Show acceleration if significant */}
                        {trend.acceleration && Math.abs(trend.acceleration) > 30 && (
                          <span className={cn(
                            "ml-1",
                            trend.acceleration > 0 ? "text-green-400" : "text-red-400"
                          )}>
                            • {trend.acceleration > 0 ? '↑' : '↓'}{Math.abs(Math.round(trend.acceleration))}%
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Related Topics - "Trending with" */}
                    {trend.related_topics && trend.related_topics.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Link className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[10px] text-muted-foreground">
                          Trending with:{" "}
                          <span className="text-foreground/70">
                            {trend.related_topics.slice(0, 3).join(", ")}
                          </span>
                        </span>
                      </div>
                    )}
                    
                    {trend.spike_ratio >= 2 && (
                      <div className="mt-1">
                        <span className={cn("text-xs font-medium", getSpikeRatioColor(trend.spike_ratio))}>
                          {trend.is_breaking ? "🔴 BREAKING" : formatSpikeRatio(trend.spike_ratio)}
                          {trend.baseline_hourly > 0 && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({trend.spike_ratio.toFixed(1)}x baseline)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Time */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[10px] text-muted-foreground">
                      {formatTime(trend.last_updated)}
                    </div>
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
