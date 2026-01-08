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
  Info,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrendEvents, getConfidenceColor, getTrendStageInfo, type TrendEvent } from '@/hooks/useTrendEvents';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { TrendExplainabilityCompact } from './TrendEventExplainability';
import { TrendFeedback } from './TrendFeedback';
import { cn } from '@/lib/utils';

interface TrendsConsoleProps {
  onDrilldown?: (trendId: string) => void;
  className?: string;
}

const STAGE_CONFIG = {
  emerging: { label: 'Emerging', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Rocket },
  surging: { label: 'Surging', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Flame },
  peaking: { label: 'Peaking', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingUp },
  declining: { label: 'Declining', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: TrendingDown },
  stable: { label: 'Stable', color: 'bg-muted text-muted-foreground border-border', icon: BarChart3 },
};

/**
 * Calculate spike ratio from baseline comparison
 */
function getSpikeRatio(trend: TrendEvent): number {
  if (trend.baseline_7d <= 0) return 1;
  return Math.min(5, Math.max(1, trend.current_1h / trend.baseline_7d));
}

/**
 * Get color for spike ratio display
 */
function getSpikeRatioColor(spikeRatio: number): string {
  if (spikeRatio >= 4) return 'text-destructive';
  if (spikeRatio >= 3) return 'text-orange-500';
  if (spikeRatio >= 2) return 'text-yellow-500';
  return 'text-muted-foreground';
}

function TrendEventCard({ 
  trend, 
  rank, 
  onDrilldown,
  onAddToWatchlist,
  onCreateAlert 
}: { 
  trend: TrendEvent; 
  rank: number;
  onDrilldown?: () => void;
  onAddToWatchlist?: () => void;
  onCreateAlert?: () => void;
}) {
  const stageConfig = STAGE_CONFIG[trend.trend_stage || 'stable'];
  const StageIcon = stageConfig.icon;
  const spikeRatio = getSpikeRatio(trend);

  // Calculate source breakdown for visualization
  const newsCount = trend.news_source_count || 0;
  const socialCount = trend.social_source_count || 0;
  const totalSources = newsCount + socialCount;

  const sourcePercentages = {
    news: totalSources > 0 ? (newsCount / totalSources) * 100 : 0,
    social: totalSources > 0 ? (socialCount / totalSources) * 100 : 0,
  };

  return (
    <div 
      className={cn(
        "group relative rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer",
        "bg-card hover:bg-card/80",
        trend.is_breaking && "ring-2 ring-destructive/50 bg-destructive/5",
        !trend.is_breaking && trend.confidence_score >= 70 && "ring-1 ring-orange-500/30 bg-orange-500/5"
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
            <h4 className="font-semibold text-foreground truncate">{trend.event_title}</h4>
            {trend.is_breaking && (
              <Badge variant="destructive" className="text-[10px]">BREAKING</Badge>
            )}
            {trend.trend_stage && trend.trend_stage !== 'stable' && !trend.is_breaking && (
              <Badge variant="outline" className={cn("text-[10px]", stageConfig.color)}>
                {stageConfig.label}
              </Badge>
            )}
          </div>
          
          {/* NEW: Context chips for entity-only trends */}
          {trend.label_quality === 'entity_only' && trend.context_terms && trend.context_terms.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {trend.context_terms.slice(0, 4).map((term, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 bg-muted/50">
                  {term}
                </Badge>
              ))}
              {trend.context_phrases && trend.context_phrases.length > 0 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-primary border-primary/30">
                  {trend.context_phrases[0]}
                </Badge>
              )}
            </div>
          )}
          
          {/* Why Trending summary for entity-only trends */}
          {trend.label_quality === 'entity_only' && trend.context_summary && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
              "{trend.context_summary}"
            </p>
          )}

          {/* Metrics Row with Confidence */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="font-medium">{trend.current_24h.toLocaleString()} mentions</span>
            {spikeRatio > 1 && (
              <span className={cn("font-medium", getSpikeRatioColor(spikeRatio))}>
                {spikeRatio.toFixed(1)}x baseline
              </span>
            )}
            {trend.source_count >= 2 && (
              <span className="text-status-success font-medium">
                {trend.source_count} sources
              </span>
            )}
            <Badge 
              variant="outline" 
              className={cn("text-[10px] py-0 gap-1", getConfidenceColor(trend.confidence_score))}
            >
              <Target className="h-2.5 w-2.5" />
              {trend.confidence_score}%
            </Badge>
          </div>

          {/* Source Distribution Bar - Evidence-based */}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden flex bg-muted">
            {sourcePercentages.news > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="bg-blue-500 h-full" 
                    style={{ width: `${sourcePercentages.news}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>News: {newsCount} sources</TooltipContent>
              </Tooltip>
            )}
            {sourcePercentages.social > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="bg-sky-400 h-full" 
                    style={{ width: `${sourcePercentages.social}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>Social: {socialCount} sources</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Why Trending - Evidence-based explainability */}
          <div className="mt-2">
            <TrendExplainabilityCompact trend={trend} />
          </div>

          {/* Top headline if available */}
          {trend.top_headline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">{trend.top_headline}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="font-medium mb-1">Top Headline</p>
                <p className="text-xs">{trend.top_headline}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Actions column */}
        <div className="flex flex-col items-end gap-2">
          {/* Action buttons - visible on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          
          {/* Feedback controls - always visible */}
          <TrendFeedback 
            trendId={trend.event_key}
            trendName={trend.event_title}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

export function TrendsConsole({ onDrilldown, className }: TrendsConsoleProps) {
  // Use the new evidence-based trend events hook
  const { events, isLoading, stats, refresh } = useTrendEvents({ limit: 50, minConfidence: 30 });
  const [activeFilter, setActiveFilter] = useState<'all' | 'breaking' | 'high_confidence'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredTrends = useMemo(() => {
    switch (activeFilter) {
      case 'breaking':
        return events.filter(t => t.is_breaking);
      case 'high_confidence':
        return events.filter(t => t.confidence_score >= 70);
      default:
        return events;
    }
  }, [events, activeFilter]);

  // Get latest update time from events
  const latestUpdate = events.length > 0 
    ? events.reduce((latest, t) => {
        const tDate = new Date(t.last_seen_at);
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
              {stats.totalEvents} trending • {stats.breakingCount} breaking • {stats.highConfidenceCount} high confidence
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
          All ({events.length})
        </Button>
        <Button
          variant={activeFilter === 'breaking' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('breaking')}
        >
          <Zap className="h-3 w-3 mr-1" />
          Breaking ({stats.breakingCount})
        </Button>
        <Button
          variant={activeFilter === 'high_confidence' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('high_confidence')}
        >
          <Target className="h-3 w-3 mr-1" />
          High Confidence ({stats.highConfidenceCount})
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
              <TrendEventCard
                key={trend.id}
                trend={trend}
                rank={index + 1}
                onDrilldown={() => onDrilldown?.(trend.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
