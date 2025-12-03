import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, GripVertical, RefreshCw, Newspaper, Users, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedTrends, getSourceTypeBadgeClass, getVelocityColor, formatSentiment } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface UnifiedTrendsWidgetProps {
  showDragHandle?: boolean;
  compact?: boolean;
}

export function UnifiedTrendsWidget({ showDragHandle = false, compact = false }: UnifiedTrendsWidgetProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: compact ? 8 : 15 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'news':
        return <Newspaper className="h-3 w-3" />;
      case 'social':
        return <Users className="h-3 w-3" />;
      case 'entity':
        return <Hash className="h-3 w-3" />;
      default:
        return null;
    }
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
              <h3 className="text-sm font-semibold portal-text-primary">Unified Trends</h3>
              {!compact && (
                <p className="text-xs portal-text-secondary">
                  {stats.totalTrending} trending • {stats.multiSourceTrends} cross-source
                </p>
              )}
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
            {[...Array(compact ? 5 : 8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <TrendingUp className="h-10 w-10 portal-text-secondary mb-2 opacity-50" />
            <p className="text-sm portal-text-secondary">No trending topics at this time</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-2">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors border border-transparent hover:border-[hsl(var(--portal-border-subtle))]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {trend.is_breakthrough && (
                          <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        )}
                        <span 
                          className="text-sm font-medium portal-text-primary truncate" 
                          title={trend.name}
                        >
                          {trend.name}
                        </span>
                        {index < 3 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-400 border-red-500/30">
                            #{index + 1}
                          </Badge>
                        )}
                      </div>
                      
                      {!compact && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {trend.source_types.map((type) => (
                            <Badge 
                              key={type} 
                              variant="outline" 
                              className={cn("text-[10px] px-1.5 py-0 h-4 gap-1", getSourceTypeBadgeClass(type))}
                            >
                              {getSourceIcon(type)}
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn("text-sm font-bold", getVelocityColor(trend.unified_score))}>
                        {trend.unified_score.toFixed(0)}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] portal-text-secondary">
                        <span>{trend.total_mentions_24h} mentions</span>
                        {trend.source_count > 1 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-green-500/10 text-green-400 border-green-500/30">
                            {trend.source_count}×
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!compact && trend.avg_sentiment !== null && (
                    <div className="mt-2 pt-2 border-t border-[hsl(var(--portal-border-subtle))]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="portal-text-secondary">Sentiment</span>
                        <span className={formatSentiment(trend.avg_sentiment).color}>
                          {formatSentiment(trend.avg_sentiment).label}
                          {trend.avg_sentiment !== null && ` (${(trend.avg_sentiment * 100).toFixed(0)}%)`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
