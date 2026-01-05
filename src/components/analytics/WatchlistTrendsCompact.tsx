import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, ChevronRight, Newspaper, Users, Flame } from "lucide-react";
import { useUnifiedTrends, getSpikeRatioColor, formatSpikeRatio } from "@/hooks/useUnifiedTrends";
import { cn } from "@/lib/utils";

interface WatchlistTrendsCompactProps {
  onTopicClick?: (topic: string, sourceTypes: string[]) => void;
  maxItems?: number;
}

export function WatchlistTrendsCompact({ onTopicClick, maxItems = 8 }: WatchlistTrendsCompactProps) {
  const { trends, isLoading, stats } = useUnifiedTrends({ limit: 20 });

  // Only show watchlist matches
  const watchlistTrends = trends.filter(t => t.matchesWatchlist).slice(0, maxItems);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Watchlist Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSourceIcon = (sourceTypes: string[]) => {
    const hasNews = sourceTypes.includes('news');
    const hasSocial = sourceTypes.includes('social');
    
    if (hasNews && hasSocial) {
      return (
        <div className="flex items-center gap-0.5">
          <Newspaper className="h-3 w-3 text-blue-500" />
          <Users className="h-3 w-3 text-purple-500" />
        </div>
      );
    }
    if (hasNews) return <Newspaper className="h-3 w-3 text-blue-500" />;
    if (hasSocial) return <Users className="h-3 w-3 text-purple-500" />;
    return <TrendingUp className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Watchlist Trends
          </CardTitle>
          {stats.watchlistMatches > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.watchlistMatches} matches
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {watchlistTrends.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No watchlist items are trending</p>
            <p className="text-xs mt-1">Add entities to your watchlist to track them</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-1">
              {watchlistTrends.map((trend, index) => (
                <Button
                  key={trend.normalized_name}
                  variant="ghost"
                  className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50"
                  onClick={() => onTopicClick?.(trend.name, trend.source_types)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground w-4">
                      {index + 1}
                    </span>
                    {trend.is_breakthrough && (
                      <Flame className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">
                      {trend.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getSourceIcon(trend.source_types)}
                    {trend.spike_ratio && trend.spike_ratio > 1 && (
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs px-1.5", getSpikeRatioColor(trend.spike_ratio))}
                      >
                        {formatSpikeRatio(trend.spike_ratio)}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
