import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Flame, RefreshCw, Newspaper, Users, ArrowUpRight, ChevronRight, Target } from "lucide-react";
import { useUnifiedTrends, getSpikeRatioColor, formatSpikeRatio, UnifiedTrend } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface UnifiedTrendingPanelProps {
  onTopicClick?: (topic: string, sourceTypes: string[]) => void;
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
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const getSourceLabel = (sourceTypes: string[]) => {
    const hasNews = sourceTypes.includes('news');
    const hasSocial = sourceTypes.includes('social');
    if (hasNews && hasSocial) return 'News & Social';
    if (hasNews) return 'News';
    if (hasSocial) return 'Social';
    return 'Trending';
  };

  const getContextSnippet = (trend: UnifiedTrend) => {
    const mentions = trend.total_mentions_24h;
    const sources = getSourceLabel(trend.source_types);
    
    // If we have a sample headline, use it for context
    if (trend.sampleHeadline) {
      const truncated = trend.sampleHeadline.length > 60 
        ? trend.sampleHeadline.substring(0, 60) + '...'
        : trend.sampleHeadline;
      return `"${truncated}"`;
    }
    
    // Build descriptive context based on metrics
    if (trend.spike_ratio >= 3) {
      return `Surging ${trend.spike_ratio.toFixed(1)}x above baseline • ${mentions} mentions in ${sources.toLowerCase()}`;
    }
    if (trend.spike_ratio >= 2) {
      return `Trending up ${trend.spike_ratio.toFixed(1)}x • ${mentions} mentions across ${sources.toLowerCase()}`;
    }
    
    // Sentiment-based context
    const sentiment = trend.avg_sentiment || 0;
    const sentimentLabel = sentiment > 0.2 ? 'positive' : sentiment < -0.2 ? 'negative' : 'neutral';
    return `${mentions} mentions • ${sentimentLabel} sentiment • ${sources}`;
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
                  <span className="text-orange-500 font-medium">{stats.breakthroughs} rising fast</span>
                )}
                {stats.breakthroughs > 0 && stats.multiSourceTrends > 0 && ' • '}
                {stats.multiSourceTrends > 0 && (
                  <span className="text-green-500">{stats.multiSourceTrends} cross-platform</span>
                )}
                {stats.breakthroughs === 0 && stats.multiSourceTrends === 0 && 'Real-time • Click to explore'}
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
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">No trending topics right now</p>
            <p className="text-xs text-muted-foreground mt-1">Check back soon for updates</p>
          </div>
        ) : (
          <ScrollArea className="h-[550px]">
            <div className="divide-y">
              {trends.map((trend, index) => (
                <div
                  key={trend.normalized_name}
                  onClick={() => onTopicClick?.(trend.name, trend.source_types)}
                  className={cn(
                    "flex items-center gap-4 p-4 transition-all cursor-pointer group",
                    "hover:bg-muted/50",
                    trend.is_breakthrough && trend.spike_ratio >= 3 && "bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30"
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
                        <Flame className="h-4 w-4 text-orange-500 flex-shrink-0 animate-pulse" />
                      )}
                      {trend.spike_ratio >= 2 && trend.spike_ratio < 3 && (
                        <ArrowUpRight className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold truncate text-base" title={trend.name}>
                        {trend.name}
                      </span>
                    </div>
                    
                    {/* Context Snippet */}
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {getContextSnippet(trend)}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {getSourceIcon(trend.source_types)}
                      <span className="text-xs text-muted-foreground">
                        {getSourceLabel(trend.source_types)}
                      </span>
                      {trend.matchesWatchlist && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                          <Target className="h-3 w-3" />
                          Watchlist
                        </span>
                      )}
                      {trend.source_count >= 2 && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          Cross-platform
                        </span>
                      )}
                      {trend.spike_ratio >= 2 && (
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", 
                          trend.spike_ratio >= 4 ? "bg-destructive/10 text-destructive" :
                          trend.spike_ratio >= 3 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" :
                          "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                        )}>
                          {formatSpikeRatio(trend.spike_ratio)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Action indicator */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
