import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, GripVertical, RefreshCw, Newspaper, Users, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedTrends, getVelocityColor } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface TrendingTopicsWidgetProps {
  showDragHandle?: boolean;
}

export function TrendingTopicsWidget({ showDragHandle = false }: TrendingTopicsWidgetProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: 15 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getSourceIcon = (sourceTypes: string[]) => {
    if (sourceTypes.includes('news') && sourceTypes.includes('social')) {
      return <span className="text-[10px]">📰🔵</span>;
    }
    if (sourceTypes.includes('news')) {
      return <Newspaper className="h-3 w-3 text-status-info" />;
    }
    if (sourceTypes.includes('social')) {
      return <Users className="h-3 w-3 text-secondary" />;
    }
    return <Hash className="h-3 w-3 text-muted-foreground" />;
  };

  // Format time since trending
  const formatTrendingTime = (lastUpdated: string) => {
    const diff = Date.now() - new Date(lastUpdated).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour';
    if (hours < 24) return `${hours} hours`;
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
                Real-time • {stats.breakthroughs} breakthrough{stats.breakthroughs !== 1 ? 's' : ''}
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
              <Skeleton key={i} className="h-12 w-full" />
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
            <div className="space-y-1">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors cursor-pointer group"
                >
                  {/* Rank number */}
                  <div className="flex-shrink-0 w-5 text-center">
                    <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                  </div>
                  
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {trend.is_breakthrough && (
                        <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold portal-text-primary truncate group-hover:text-primary transition-colors" title={trend.name}>
                        {trend.name}
                      </span>
                    </div>
                    
                    {/* Context line - Twitter style */}
                    <div className="flex items-center gap-2 mt-0.5">
                      {getSourceIcon(trend.source_types)}
                      <span className="text-xs text-muted-foreground">
                        {trend.total_mentions_24h.toLocaleString()} posts
                        {trend.source_count >= 2 && (
                          <span className="text-status-success ml-1">• Multi-source</span>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {/* Right side - velocity indicator */}
                  <div className="flex-shrink-0 text-right">
                    <span className={cn(
                      "text-xs font-bold",
                      getVelocityColor(trend.unified_score)
                    )}>
                      {trend.max_velocity > 0 ? '+' : ''}{Math.min(trend.max_velocity, 500).toFixed(0)}%
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {formatTrendingTime(trend.last_updated)}
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
