import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Flame, 
  Zap, 
  Eye,
  PlusCircle,
  Bell,
  ChevronRight,
  Rocket,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnifiedTrends, UnifiedTrend, getSpikeRatioColor } from '@/hooks/useUnifiedTrends';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { TrendExplainabilityCompact } from './TrendExplainability';
import { cn } from '@/lib/utils';

interface TrendsConsoleProps {
  onDrilldown?: (clusterId: string) => void;
  className?: string;
}

const STAGE_CONFIG = {
  emerging: { label: 'Emerging', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Rocket },
  surging: { label: 'Surging', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Flame },
  peaking: { label: 'Peaking', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingUp },
  declining: { label: 'Declining', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: TrendingDown },
  stable: { label: 'Stable', color: 'bg-muted text-muted-foreground border-border', icon: BarChart3 },
};

function TrendCard({ 
  trend, 
  rank, 
  onDrilldown,
  onAddToWatchlist,
  onCreateAlert 
}: { 
  trend: UnifiedTrend; 
  rank: number;
  onDrilldown?: () => void;
  onAddToWatchlist?: () => void;
  onCreateAlert?: () => void;
}) {
  const stageConfig = STAGE_CONFIG[trend.trend_stage || 'stable'];
  const StageIcon = stageConfig.icon;

  // Calculate source breakdown for visualization
  const totalSources = (trend.source_distribution?.google_news || 0) +
    (trend.source_distribution?.reddit || 0) +
    (trend.source_distribution?.bluesky || 0) +
    (trend.source_distribution?.rss || 0);

  const sourcePercentages = {
    google_news: totalSources > 0 ? ((trend.source_distribution?.google_news || 0) / totalSources) * 100 : 0,
    reddit: totalSources > 0 ? ((trend.source_distribution?.reddit || 0) / totalSources) * 100 : 0,
    bluesky: totalSources > 0 ? ((trend.source_distribution?.bluesky || 0) / totalSources) * 100 : 0,
    rss: totalSources > 0 ? ((trend.source_distribution?.rss || 0) / totalSources) * 100 : 0,
  };

  return (
    <div 
      className={cn(
        "group relative rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer",
        "bg-card hover:bg-card/80",
        trend.is_breaking && "ring-2 ring-destructive/50 bg-destructive/5",
        trend.is_breakthrough && !trend.is_breaking && "ring-1 ring-orange-500/30 bg-orange-500/5"
      )}
      onClick={onDrilldown}
    >
      {/* Rank Badge */}
      <div className={cn(
        "absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
        rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {rank}
      </div>

      <div className="flex items-start gap-3">
        {/* Stage Icon */}
        <div className={cn(
          "p-2 rounded-lg flex-shrink-0",
          stageConfig.color.split(' ')[0] // bg color only
        )}>
          {trend.is_breaking ? (
            <Zap className="h-5 w-5 text-destructive animate-pulse" />
          ) : (
            <StageIcon className={cn("h-5 w-5", stageConfig.color.split(' ')[1])} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground truncate">{trend.name}</h4>
            {trend.is_breaking && (
              <Badge variant="destructive" className="text-[10px]">BREAKING</Badge>
            )}
            {trend.trend_stage && trend.trend_stage !== 'stable' && !trend.is_breaking && (
              <Badge variant="outline" className={cn("text-[10px]", stageConfig.color)}>
                {stageConfig.label}
              </Badge>
            )}
            {trend.matchesWatchlist && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                Watchlist
              </Badge>
            )}
          </div>

          {/* Metrics Row */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="font-medium">{trend.total_mentions_24h.toLocaleString()} mentions</span>
            {trend.velocity > 0 && (
              <span className={cn("font-medium", getSpikeRatioColor(trend.spike_ratio))}>
                {trend.spike_ratio.toFixed(1)}x baseline
              </span>
            )}
            {trend.source_count >= 2 && (
              <span className="text-status-success font-medium">
                {trend.source_count} sources
              </span>
            )}
          </div>

          {/* Source Distribution Bar */}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden flex bg-muted">
            {sourcePercentages.google_news > 0 && (
              <div 
                className="bg-blue-500 h-full" 
                style={{ width: `${sourcePercentages.google_news}%` }}
                title={`Google News: ${trend.source_distribution?.google_news}`}
              />
            )}
            {sourcePercentages.rss > 0 && (
              <div 
                className="bg-purple-500 h-full" 
                style={{ width: `${sourcePercentages.rss}%` }}
                title={`RSS: ${trend.source_distribution?.rss}`}
              />
            )}
            {sourcePercentages.reddit > 0 && (
              <div 
                className="bg-orange-500 h-full" 
                style={{ width: `${sourcePercentages.reddit}%` }}
                title={`Reddit: ${trend.source_distribution?.reddit}`}
              />
            )}
            {sourcePercentages.bluesky > 0 && (
              <div 
                className="bg-sky-500 h-full" 
                style={{ width: `${sourcePercentages.bluesky}%` }}
                title={`Bluesky: ${trend.source_distribution?.bluesky}`}
              />
            )}
          </div>

          {/* Why Trending - using TrendExplainability */}
          <div className="mt-2">
            <TrendExplainabilityCompact trend={trend} />
          </div>

          {/* Sample headline if available */}
          {(trend.cluster_summary || trend.sampleHeadline) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">
                    {trend.cluster_summary || trend.sampleHeadline}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="font-medium mb-1">Context</p>
                <p className="text-xs">{trend.cluster_summary || trend.sampleHeadline}</p>
                {trend.related_topics && trend.related_topics.length > 0 && (
                  <p className="text-xs mt-2">
                    <span className="text-muted-foreground">Related: </span>
                    {trend.related_topics.slice(0, 3).join(', ')}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onAddToWatchlist?.(); }}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to Watchlist</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onCreateAlert?.(); }}
              >
                <Bell className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create Alert Rule</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onDrilldown?.(); }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Details</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export function TrendsConsole({ onDrilldown, className }: TrendsConsoleProps) {
  const { trends, isLoading, stats, refresh } = useUnifiedTrends({ limit: 50 });
  const [activeFilter, setActiveFilter] = useState<'all' | 'breaking' | 'watchlist'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredTrends = useMemo(() => {
    switch (activeFilter) {
      case 'breaking':
        return trends.filter(t => t.is_breaking || t.is_breakthrough);
      case 'watchlist':
        return trends.filter(t => t.matchesWatchlist);
      default:
        return trends;
    }
  }, [trends, activeFilter]);

  // Get latest update time from trends
  const latestUpdate = trends.length > 0 
    ? trends.reduce((latest, t) => {
        const tDate = new Date(t.last_updated);
        return tDate > latest ? tDate : latest;
      }, new Date(0)).toISOString()
    : null;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Trends Console</h2>
            <p className="text-xs text-muted-foreground">
              {stats.totalTrending} trending • {stats.breakthroughs} breakthroughs • {stats.watchlistMatches} watchlist matches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DataFreshnessIndicator 
            lastUpdated={latestUpdate}
            expectedMaxAgeMinutes={30}
            isLoading={isLoading}
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 py-3">
        <Button
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('all')}
        >
          All ({trends.length})
        </Button>
        <Button
          variant={activeFilter === 'breaking' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('breaking')}
        >
          <Zap className="h-3 w-3 mr-1" />
          Breaking ({trends.filter(t => t.is_breaking || t.is_breakthrough).length})
        </Button>
        <Button
          variant={activeFilter === 'watchlist' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('watchlist')}
        >
          <Eye className="h-3 w-3 mr-1" />
          Watchlist ({stats.watchlistMatches})
        </Button>
      </div>

      {/* Trends List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4 pb-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))
          ) : filteredTrends.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No trends match your filter</p>
              <p className="text-sm">Try adjusting your filters or check back later</p>
            </div>
          ) : (
            filteredTrends.map((trend, index) => (
              <TrendCard
                key={trend.normalized_name}
                trend={trend}
                rank={index + 1}
                onDrilldown={() => onDrilldown?.(trend.normalized_name)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}