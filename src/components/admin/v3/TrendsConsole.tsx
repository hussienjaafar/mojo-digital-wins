import { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  RefreshCw,
  LayoutGrid,
  LayoutList
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrendEvents, type TrendEvent } from '@/hooks/useTrendEvents';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { TrendsQuickFilters, type TrendFilter, type TrendSort } from './TrendsQuickFilters';
import { TrendCardCompact } from './TrendCardCompact';
import { cn } from '@/lib/utils';
import type { FilterState } from './TrendsFilterRail';

interface TrendsConsoleProps {
  onDrilldown?: (trendId: string) => void;
  viewMode?: 'for_you' | 'explore';
  filters?: FilterState;
  searchQuery?: string;
  className?: string;
}

const MAX_BREAKING_BADGES = 5;

function isFreshTrend(trend: TrendEvent): boolean {
  return trend.freshness === 'fresh' || trend.freshness === 'recent';
}

// Note: TrendEventCard, getBaselineDeltaLabel, getCardAccent removed as dead code
// TrendCardCompact is now the only card component used

export function TrendsConsole({ 
  onDrilldown, 
  viewMode = 'for_you', 
  filters: externalFilters,
  searchQuery: externalSearchQuery,
  className 
}: TrendsConsoleProps) {
  const { events, isLoading, stats, refresh } = useTrendEvents({ limit: 50, minConfidence: 30 });
  const [activeFilter, setActiveFilter] = useState<TrendFilter>('all');
  const [activeSort, setActiveSort] = useState<TrendSort>(viewMode === 'for_you' ? 'confidence' : 'velocity');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use external search query if provided, otherwise use internal
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = externalSearchQuery !== undefined ? () => {} : setInternalSearchQuery;

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
    
    // Apply external filters from filter rail
    if (externalFilters) {
      // High confidence filter
      if (externalFilters.highConfidenceOnly) {
        filtered = filtered.filter(t => t.confidence_score >= 70);
      }
      
      // Source type filter
      if (!externalFilters.sources.news || !externalFilters.sources.social) {
        filtered = filtered.filter(t => {
          if (externalFilters.sources.news && !externalFilters.sources.social) {
            return (t.news_source_count || 0) > 0;
          }
          if (externalFilters.sources.social && !externalFilters.sources.news) {
            return (t.social_source_count || 0) > 0;
          }
          return true;
        });
      }
      
      // Topic filter
      if (externalFilters.topics.length > 0) {
        filtered = filtered.filter(t => {
          const trendTopics = t.context_terms || [];
          return externalFilters.topics.some(topic => 
            trendTopics.some(tt => tt.toLowerCase().includes(topic.toLowerCase()))
          );
        });
      }
    }
    
    // Apply quick filter
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
  }, [events, activeFilter, activeSort, searchQuery, dismissedIds, externalFilters]);

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
