import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Activity, Globe, MessageSquare, Newspaper, Hash } from 'lucide-react';
import { 
  useTrendClusters, 
  TrendCluster,
  getMomentumIcon, 
  getMomentumColor,
  getSentimentColor,
  formatTimeAgo 
} from '@/hooks/useTrendClusters';
import { cn } from '@/lib/utils';

interface TrendCardProps {
  trend: TrendCluster;
  rank: number;
}

function TrendCard({ trend, rank }: TrendCardProps) {
  const maxMentions = 100; // Normalize volume meter
  const volumePercent = Math.min((trend.total_mentions / maxMentions) * 100, 100);
  
  const sourceCount = Object.values(trend.source_distribution || {})
    .filter(v => (v || 0) > 0).length;
  
  return (
    <div className="py-3 border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors px-3 -mx-3 cursor-pointer">
      {/* Header: Rank + Title + Momentum */}
      <div className="flex items-start gap-3">
        <span className="text-sm font-medium text-muted-foreground w-5 flex-shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          {/* Topic Title */}
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground truncate">
              {trend.cluster_title}
            </h4>
            <span className={cn('text-lg', getMomentumColor(trend.momentum))}>
              {getMomentumIcon(trend.momentum)}
            </span>
          </div>
          
          {/* Summary */}
          {trend.cluster_summary && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {trend.cluster_summary}
            </p>
          )}
          
          {/* Metrics Row */}
          <div className="flex items-center gap-4 mt-2 text-xs">
            {/* Sentiment Badge */}
            <Badge 
              variant="outline" 
              className={cn(
                'capitalize text-xs',
                trend.dominant_sentiment === 'positive' && 'border-green-500/50 text-green-500',
                trend.dominant_sentiment === 'negative' && 'border-red-500/50 text-red-500'
              )}
            >
              {trend.dominant_sentiment || 'neutral'}
            </Badge>
            
            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{trend.total_mentions} mentions</span>
            </div>
            
            {/* Sources */}
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{sourceCount} sources</span>
            </div>
            
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
            {(trend.source_distribution?.google_news || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <Newspaper className="h-2.5 w-2.5 mr-1" />
                {trend.source_distribution.google_news}
              </Badge>
            )}
            {(trend.source_distribution?.reddit || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <MessageSquare className="h-2.5 w-2.5 mr-1" />
                {trend.source_distribution.reddit}
              </Badge>
            )}
            {(trend.source_distribution?.bluesky || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <Hash className="h-2.5 w-2.5 mr-1" />
                {trend.source_distribution.bluesky}
              </Badge>
            )}
            {(trend.source_distribution?.rss || 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                📡 {trend.source_distribution.rss}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Velocity Badge */}
        {trend.velocity_score > 50 && (
          <Badge 
            variant="default" 
            className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs flex-shrink-0"
          >
            +{Math.round(trend.velocity_score)}%
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
  const { clusters, isLoading, error, stats } = useTrendClusters({
    limit: 15,
    trendingOnly: false,
    minCrossSources: 1
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
                {stats.trending} trending
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.multiSource} multi-source
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
        
        {!isLoading && !error && clusters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No trending topics detected. Data collection in progress...
          </div>
        )}
        
        {!isLoading && !error && clusters.length > 0 && (
          <div className="space-y-0">
            {clusters.map((trend, index) => (
              <TrendCard key={trend.id} trend={trend} rank={index + 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
