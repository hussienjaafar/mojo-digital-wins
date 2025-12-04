import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Flame, RefreshCw, Newspaper, Users, ArrowUpRight, ExternalLink } from "lucide-react";
import { useUnifiedTrends, getSpikeRatioColor, formatSpikeRatio } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface UnifiedTrendingPanelProps {
  onTopicClick?: (topic: string) => void;
}

export function UnifiedTrendingPanel({ onTopicClick }: UnifiedTrendingPanelProps) {
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
        <div className="flex items-center gap-1">
          <Newspaper className="h-3.5 w-3.5 text-blue-500" />
          <Users className="h-3.5 w-3.5 text-purple-500" />
        </div>
      );
    }
    if (hasNews) return <Newspaper className="h-3.5 w-3.5 text-blue-500" />;
    if (hasSocial) return <Users className="h-3.5 w-3.5 text-purple-500" />;
    return <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const formatTime = (lastUpdated: string) => {
    const diff = Date.now() - new Date(lastUpdated).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Card className="h-full">
      <div className="p-6 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Trending Now</h2>
              <p className="text-xs text-muted-foreground">
                {stats.breakthroughs > 0 && (
                  <span className="text-orange-500 font-medium">{stats.breakthroughs} rising</span>
                )}
                {stats.breakthroughs > 0 && stats.multiSourceTrends > 0 && ' • '}
                {stats.multiSourceTrends > 0 && (
                  <span className="text-green-500">{stats.multiSourceTrends} cross-platform</span>
                )}
                {stats.breakthroughs === 0 && stats.multiSourceTrends === 0 && 'Real-time • Auto-updates'}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
      
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">No trending topics right now</p>
            <p className="text-xs text-muted-foreground mt-1">Check back soon for updates</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  onClick={() => onTopicClick?.(trend.name)}
                  className={cn(
                    "flex items-center gap-4 p-4 transition-colors cursor-pointer",
                    "hover:bg-muted/50",
                    trend.is_breakthrough && trend.spike_ratio >= 3 && "bg-orange-50 dark:bg-orange-950/20"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className={cn(
                      "text-lg font-bold",
                      index < 3 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {trend.is_breakthrough && trend.spike_ratio >= 3 && (
                        <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      )}
                      {trend.spike_ratio >= 2 && trend.spike_ratio < 3 && (
                        <ArrowUpRight className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold truncate" title={trend.name}>
                        {trend.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1">
                      {getSourceIcon(trend.source_types)}
                      <span className="text-sm text-muted-foreground">
                        {trend.total_mentions_24h.toLocaleString()} mentions
                      </span>
                      {trend.source_count >= 2 && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          Cross-platform
                        </span>
                      )}
                    </div>
                    
                    {trend.spike_ratio >= 2 && (
                      <span className={cn("text-xs font-medium mt-1 block", getSpikeRatioColor(trend.spike_ratio))}>
                        {formatSpikeRatio(trend.spike_ratio)}
                        {trend.baseline_hourly > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            • {trend.spike_ratio.toFixed(1)}x baseline
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  
                  {/* Time & Action */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(trend.last_updated)}
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
