import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, GripVertical, RefreshCw, Newspaper, Users, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedTrends, getSourceTypeBadgeClass, getVelocityColor } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface TrendingTopicsWidgetProps {
  showDragHandle?: boolean;
}

export function TrendingTopicsWidget({ showDragHandle = false }: TrendingTopicsWidgetProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: 10 });
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
              <h3 className="text-sm font-semibold portal-text-primary">Trending Topics</h3>
              <p className="text-xs portal-text-secondary">
                {stats.multiSourceTrends} cross-source correlations
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
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <p className="text-sm portal-text-secondary text-center py-4">
            No trending topics at this time
          </p>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-2">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  className="flex items-center justify-between p-2 rounded-md bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {trend.is_breakthrough && (
                      <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium portal-text-primary truncate" title={trend.name}>
                      {trend.name}
                    </span>
                    {trend.source_count > 1 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-400 border-green-500/30 flex-shrink-0">
                        {trend.source_count}×
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="portal-badge-info portal-badge text-xs">
                      {trend.total_mentions_24h}
                    </span>
                    <span className={cn("text-xs font-semibold", getVelocityColor(trend.unified_score))}>
                      {trend.unified_score.toFixed(0)}
                    </span>
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
