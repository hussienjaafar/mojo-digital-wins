import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Activity, Globe, Newspaper, Hash, Zap } from 'lucide-react';
import { useTrendEvents, TrendEvent, getTrendStageInfo } from '@/hooks/useTrendEvents';
import { cn } from '@/lib/utils';

interface TrendCardProps {
  trend: TrendEvent;
  rank: number;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function TrendCard({ trend, rank }: TrendCardProps) {
  const maxMentions = 100; // Normalize volume meter
  const volumePercent = Math.min((trend.current_24h / maxMentions) * 100, 100);
  const stageInfo = getTrendStageInfo(trend.trend_stage);
  
  return (
    <div className="py-3 border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors px-3 -mx-3 cursor-pointer">
      {/* Header: Rank + Title + Stage */}
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground w-5 flex-shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          {/* Topic Title */}
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">
              {trend.event_title}
            </h4>
            {trend.is_breaking && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Breaking
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={cn('text-[10px] px-1.5 py-0 h-5', stageInfo.color, stageInfo.bgColor)}
            >
              {stageInfo.label}
            </Badge>
          </div>
          
          {/* Top Headline */}
          {trend.top_headline && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {trend.top_headline}
            </p>
          )}
          
          {/* Metrics Row */}
          <div className="flex items-center gap-4 mt-2 text-xs">
            {/* Sentiment Badge */}
            <Badge 
              variant="outline" 
              className={cn(
                'capitalize text-xs',
                trend.sentiment_label === 'positive' && 'border-green-500/50 text-green-500',
                trend.sentiment_label === 'negative' && 'border-red-500/50 text-red-500'
              )}
            >
              {trend.sentiment_label || 'neutral'}
            </Badge>
            
            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{trend.current_24h} mentions</span>
            </div>
            
            {/* Sources */}
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{trend.source_count} sources</span>
            </div>
            
            {/* Confidence */}
            <span className="text-muted-foreground">
              {trend.confidence_score}% confidence
            </span>
            
            {/* Time */}
            <span className="text-muted-foreground">
              {formatTimeAgo(trend.first_seen_at)}
            </span>
          </div>
          
          {/* Volume Meter */}
          <div className="mt-2">
            <Progress value={volumePercent} className="h-1" />
          </div>
          
          {/* Source Distribution */}
          <div className="flex items-center gap-2 mt-2">
            {(trend.news_source_count || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <Newspaper className="h-2.5 w-2.5 mr-1" />
                {trend.news_source_count} news
              </Badge>
            )}
            {(trend.social_source_count || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <Hash className="h-2.5 w-2.5 mr-1" />
                {trend.social_source_count} social
              </Badge>
            )}
          </div>
        </div>
        
        {/* Velocity Badge */}
        {trend.velocity > 50 && (
          <Badge 
            variant="default" 
            className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs flex-shrink-0"
          >
            +{Math.round(trend.velocity)}%
          </Badge>
        )}
      </div>
    </div>
  );
}

function TrendSkeleton() {
  return (
    <div className="py-3 border-b border-border/50">
      <div className="flex items-start gap-3">
        <Skeleton className="h-4 w-4" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function PoliticalTrendsFeed() {
  const { events, isLoading, error, stats } = useTrendEvents({
    limit: 15,
    trendingOnly: false,
    minConfidence: 20
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Political Trends
          </CardTitle>
          {!isLoading && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.trendingCount} trending
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.multiSourceCount} multi-source
              </Badge>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Cross-source political discourse analysis • Updates every 15 min
        </p>
      </CardHeader>
      
      <CardContent className="pt-0">
        {error && (
          <div className="text-center py-8 text-destructive text-sm">
            {error}
          </div>
        )}
        
        {isLoading && (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <TrendSkeleton key={i} />
            ))}
          </div>
        )}
        
        {!isLoading && !error && events.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No trending topics detected. Data collection in progress...
          </div>
        )}
        
        {!isLoading && !error && events.length > 0 && (
          <div className="space-y-0">
            {events.map((trend, index) => (
              <TrendCard key={trend.id} trend={trend} rank={index + 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
