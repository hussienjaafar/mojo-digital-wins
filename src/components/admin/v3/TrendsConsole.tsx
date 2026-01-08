import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  TrendingUp, 
  Flame, 
  Zap, 
  PlusCircle,
  Bell,
  ChevronRight,
  Rocket,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Info,
  Target,
  X,
  LayoutGrid,
  LayoutList
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { V3Card, V3CardContent } from '@/components/v3';
import { useTrendEvents, getConfidenceColor, type TrendEvent } from '@/hooks/useTrendEvents';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { TrendExplainabilityCompact } from './TrendEventExplainability';
import { TrendFeedback } from './TrendFeedback';
import { TrendsQuickFilters, type TrendFilter, type TrendSort } from './TrendsQuickFilters';
import { TrendCardCompact } from './TrendCardCompact';
import { cn } from '@/lib/utils';

interface TrendsConsoleProps {
  onDrilldown?: (trendId: string) => void;
  viewMode?: 'for_you' | 'explore';
  className?: string;
}

// Semantic stage configuration using design tokens
const STAGE_CONFIG = {
  emerging: { 
    label: 'Emerging', 
    accent: 'green' as const,
    icon: Rocket,
    classes: 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/30'
  },
  surging: { 
    label: 'Surging', 
    accent: 'amber' as const,
    icon: Flame,
    classes: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/30'
  },
  peaking: { 
    label: 'Peaking', 
    accent: 'red' as const,
    icon: TrendingUp,
    classes: 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/30'
  },
  declining: { 
    label: 'Declining', 
    accent: 'default' as const,
    icon: TrendingDown,
    classes: 'bg-muted text-muted-foreground border-border'
  },
  stable: { 
    label: 'Stable', 
    accent: 'default' as const,
    icon: BarChart3,
    classes: 'bg-muted text-muted-foreground border-border'
  },
};

const MAX_BREAKING_BADGES = 5;

function isFreshTrend(trend: TrendEvent): boolean {
  return trend.freshness === 'fresh' || trend.freshness === 'recent';
}

function getBaselineDeltaLabel(trend: TrendEvent): string | null {
  if (typeof trend.baseline_delta_pct === 'number') {
    const sign = trend.baseline_delta_pct >= 0 ? '+' : '';
    return `${sign}${trend.baseline_delta_pct.toFixed(1)}% vs baseline`;
  }
  if (typeof trend.z_score_velocity === 'number') {
    const sign = trend.z_score_velocity >= 0 ? '+' : '';
    return `${sign}${trend.z_score_velocity.toFixed(1)}σ spike`;
  }
  return null;
}

function getCardAccent(trend: TrendEvent): 'red' | 'amber' | 'green' | 'default' {
  if (trend.is_breaking) return 'red';
  const stage = trend.trend_stage || 'stable';
  return STAGE_CONFIG[stage]?.accent || 'default';
}

interface TrendEventCardProps {
  trend: TrendEvent;
  rank: number;
  showBreakingBadge: boolean;
  isSelected?: boolean;
  onDrilldown?: () => void;
  onAddToWatchlist?: () => void;
  onCreateAlert?: () => void;
  onDismiss?: () => void;
}

function TrendEventCard({ 
  trend, 
  rank, 
  showBreakingBadge,
  isSelected,
  onDrilldown,
  onAddToWatchlist,
  onCreateAlert,
  onDismiss,
}: TrendEventCardProps) {
  const stageConfig = STAGE_CONFIG[trend.trend_stage || 'stable'];
  const StageIcon = stageConfig.icon;
  const baselineDeltaLabel = getBaselineDeltaLabel(trend);

  // Calculate source breakdown for visualization
  const newsCount = trend.news_source_count || 0;
  const socialCount = trend.social_source_count || 0;
  const totalSources = newsCount + socialCount;

  const sourcePercentages = {
    news: totalSources > 0 ? (newsCount / totalSources) * 100 : 0,
    social: totalSources > 0 ? (socialCount / totalSources) * 100 : 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.02 }}
    >
      <V3Card 
        accent={getCardAccent(trend)}
        interactive
        className={cn(
          "relative transition-all duration-200",
          isSelected && "ring-2 ring-primary shadow-lg",
          showBreakingBadge && "ring-2 ring-destructive/50"
        )}
      >
        <V3CardContent className="p-4">
          {/* Rank Badge */}
          <div className={cn(
            "absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10",
            rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {rank}
          </div>

          <div className="flex items-start gap-3 cursor-pointer" onClick={onDrilldown}>
            {/* Stage Icon */}
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0",
              stageConfig.classes.split(' ')[0]
            )}>
              {showBreakingBadge ? (
                <Zap className="h-5 w-5 text-destructive animate-pulse" />
              ) : (
                <StageIcon className={cn("h-5 w-5", stageConfig.classes.split(' ')[1])} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h4 className="font-semibold text-foreground truncate max-w-[280px]">
                      {trend.canonical_label || trend.event_title}
                    </h4>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    {trend.canonical_label || trend.event_title}
                  </TooltipContent>
                </Tooltip>
                
                {showBreakingBadge && (
                  <Badge variant="destructive" className="text-[10px] animate-pulse">BREAKING</Badge>
                )}
                {trend.trend_stage && trend.trend_stage !== 'stable' && !trend.is_breaking && (
                  <Badge variant="outline" className={cn("text-[10px]", stageConfig.classes)}>
                    {stageConfig.label}
                  </Badge>
                )}
              </div>
              
              {/* Context summary as subtitle */}
              {trend.context_summary && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {trend.context_summary}
                </p>
              )}
              
              {/* Context chips */}
              {trend.context_terms && trend.context_terms.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {trend.context_terms.slice(0, 3).map((term, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 bg-muted/50 hover:bg-muted cursor-pointer">
                      {term}
                    </Badge>
                  ))}
                  {trend.context_terms.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{trend.context_terms.length - 3}</span>
                  )}
                </div>
              )}

              {/* Primary Metrics Row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium cursor-help">{trend.current_24h.toLocaleString()} mentions</span>
                  </TooltipTrigger>
                  <TooltipContent>Total mentions in the last 24 hours</TooltipContent>
                </Tooltip>
                
                {baselineDeltaLabel && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium text-primary cursor-help">
                        {baselineDeltaLabel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {trend.z_score_velocity 
                        ? `This topic is ${trend.z_score_velocity.toFixed(1)} standard deviations above its normal activity level`
                        : `Activity compared to the 7-day baseline average`
                      }
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {trend.source_count >= 2 && (
                  <span className="text-[hsl(var(--portal-success))] font-medium">
                    {trend.source_count} sources
                  </span>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] py-0 gap-1 cursor-help", getConfidenceColor(trend.confidence_score))}
                    >
                      <Target className="h-2.5 w-2.5" />
                      {trend.confidence_score}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Confidence score based on source diversity, velocity, and evidence quality
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Source Distribution Bar with Mini Legend */}
              <div className="mt-3 space-y-1">
                <div className="h-1.5 rounded-full overflow-hidden flex bg-muted">
                  {sourcePercentages.news > 0 && (
                    <div 
                      className="bg-[hsl(var(--portal-info))] h-full transition-all" 
                      style={{ width: `${sourcePercentages.news}%` }}
                    />
                  )}
                  {sourcePercentages.social > 0 && (
                    <div 
                      className="bg-[hsl(var(--portal-accent-sky))] h-full transition-all" 
                      style={{ width: `${sourcePercentages.social}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--portal-info))]" />
                    News: {newsCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--portal-accent-sky))]" />
                    Social: {socialCount}
                  </span>
                </div>
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

            {/* Actions column - Always visible */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-60 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onAddToWatchlist?.(); }}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to Watchlist (w)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-60 hover:opacity-100"
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
                      className="h-7 w-7 opacity-60 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dismiss</TooltipContent>
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
                  <TooltipContent>View Details (Enter)</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Feedback controls */}
              <TrendFeedback 
                trendId={trend.event_key}
                trendName={trend.event_title}
                size="sm"
              />
            </div>
          </div>
        </V3CardContent>
      </V3Card>
    </motion.div>
  );
}

export function TrendsConsole({ onDrilldown, viewMode = 'for_you', className }: TrendsConsoleProps) {
  const { events, isLoading, stats, refresh } = useTrendEvents({ limit: 50, minConfidence: 30 });
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [activeSort, setActiveSort] = useState<TrendSort>(viewMode === 'for_you' ? 'confidence' : 'velocity');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const scrollRef = useRef<HTMLDivElement>(null);

  const freshBreaking = useMemo(
    () => events.filter((t) => t.is_breaking && isFreshTrend(t)),
    [events]
  );
  const breakingBadgeIds = useMemo(
    () => new Set(freshBreaking.slice(0, MAX_BREAKING_BADGES).map((t) => t.id)),
    [freshBreaking]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleDismiss = (trendId: string) => {
    setDismissedIds(prev => new Set([...prev, trendId]));
  };

  // Filter and sort trends
  const filteredTrends = useMemo(() => {
    let filtered = events.filter(t => !dismissedIds.has(t.id));
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.event_title.toLowerCase().includes(query) ||
        t.canonical_label?.toLowerCase().includes(query) ||
        t.context_summary?.toLowerCase().includes(query) ||
        t.context_terms?.some(term => term.toLowerCase().includes(query))
      );
    }
    
    // Apply filter
    switch (activeFilter) {
      case 'breaking':
        filtered = filtered.filter(t => t.is_breaking && isFreshTrend(t));
        break;
      case 'high_confidence':
        filtered = filtered.filter(t => t.confidence_score >= 70 && t.source_count >= 2);
        break;
    }
    
    // Apply sort
    switch (activeSort) {
      case 'confidence':
        filtered.sort((a, b) => b.confidence_score - a.confidence_score);
        break;
      case 'velocity':
        filtered.sort((a, b) => b.velocity - a.velocity);
        break;
      case 'recency':
        filtered.sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
        break;
      case 'sources':
        filtered.sort((a, b) => b.source_count - a.source_count);
        break;
    }
    
    return filtered;
  }, [events, activeFilter, activeSort, searchQuery, dismissedIds]);

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
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-foreground">
              {viewMode === 'for_you' ? 'Trends For You' : 'Explore All Trends'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'for_you' 
                ? `Ranked by relevance • ${stats.totalEvents} trending`
                : `Ranked by momentum • ${stats.totalEvents} trending`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Density Toggle */}
          <div className="flex items-center bg-muted/50 rounded-md p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={density === 'comfortable' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDensity('comfortable')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Comfortable view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={density === 'compact' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDensity('compact')}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Compact view</TooltipContent>
            </Tooltip>
          </div>
          
          <DataFreshnessIndicator 
            lastUpdated={latestUpdate}
            expectedMaxAgeMinutes={30}
            isLoading={isLoading}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh trends</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Quick Filters with Sort and Search */}
      <div className="py-3 border-b border-border/50">
        <TrendsQuickFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          activeSort={activeSort}
          onSortChange={setActiveSort}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          counts={{
            all: events.filter(t => !dismissedIds.has(t.id)).length,
            breaking: freshBreaking.filter(t => !dismissedIds.has(t.id)).length,
            highConfidence: events.filter(t => !dismissedIds.has(t.id) && t.confidence_score >= 70 && t.source_count >= 2).length,
          }}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="py-2 text-[10px] text-muted-foreground/60">
        <span className="hidden sm:inline">
          Keyboard: <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">j</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">k</kbd> navigate • <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> view details • <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Esc</kbd> go back
        </span>
      </div>

      {/* Trends List */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-3 pr-4 pb-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))
          ) : filteredTrends.length === 0 ? (
            <motion.div 
              className="text-center py-12 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No trends match your filter</p>
              <p className="text-sm">Try adjusting your filters or check back later</p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </Button>
              )}
            </motion.div>
          ) : (
            filteredTrends.map((trend, index) => (
              <TrendCardCompact
                key={trend.id}
                trend={trend}
                rank={index + 1}
                isBreaking={breakingBadgeIds.has(trend.id)}
                density={density}
                onOpen={() => onDrilldown?.(trend.id)}
                onDismiss={() => handleDismiss(trend.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
