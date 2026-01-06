import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useTrendEvents, useTrendEvidence } from "@/hooks/useTrendEvents";
import { useUnifiedTrends } from "@/hooks/useUnifiedTrends";
import { useOrgTrendScores } from "@/hooks/useOrgRelevance";
import { useOrgTrendOutcomesMap, type OutcomeStats } from "@/hooks/useTrendOutcomes";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  V3Card,
  V3SectionHeader,
  V3Badge,
  V3EmptyState,
  V3LoadingState,
} from "@/components/v3";

import {
  Zap,
  TrendingUp,
  Eye,
  Target,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Newspaper,
  Radio,
  Users,
  BarChart3,
  ShieldAlert,
  Activity,
  Award,
} from "lucide-react";

import { TrendDrilldownPanel } from "@/components/client/TrendDrilldownPanel";
import { DataFreshnessBanner } from "@/components/client/DataFreshnessBanner";
import type { TrendEvent } from "@/hooks/useTrendEvents";

// ============================================================================
// Types
// ============================================================================

type IASection = "breaking" | "relevant" | "watchlist" | "trends" | "risk";

// ============================================================================
// Trend Card Component
// ============================================================================

interface TrendCardProps {
  trend: TrendEvent;
  isRelevant?: boolean;
  relevanceScore?: number;
  relevanceReasons?: string[];
  outcomeStats?: OutcomeStats | null;
  onSelect: (trend: TrendEvent) => void;
  showRank?: boolean;
  rank?: number;
}

function TrendCard({ 
  trend, 
  isRelevant, 
  relevanceScore, 
  relevanceReasons,
  outcomeStats,
  onSelect,
  showRank,
  rank 
}: TrendCardProps) {
  const hoursAgo = Math.floor(
    (Date.now() - new Date(trend.first_seen_at).getTime()) / (1000 * 60 * 60)
  );
  
  // Calculate last seen freshness
  const lastSeenMs = Date.now() - new Date(trend.last_seen_at).getTime();
  const lastSeenMinutes = Math.floor(lastSeenMs / (1000 * 60));
  const lastSeenHours = Math.floor(lastSeenMs / (1000 * 60 * 60));
  
  const getLastSeenLabel = () => {
    if (lastSeenMinutes < 60) return `${lastSeenMinutes}m`;
    if (lastSeenHours < 24) return `${lastSeenHours}h`;
    return `${Math.floor(lastSeenHours / 24)}d`;
  };
  
  const getFreshnessState = (): 'fresh' | 'recent' | 'aging' | 'stale' => {
    if (trend.freshness) return trend.freshness;
    if (lastSeenMinutes < 30) return 'fresh';
    if (lastSeenHours < 6) return 'recent';
    if (lastSeenHours < 24) return 'aging';
    return 'stale';
  };
  
  const freshnessState = getFreshnessState();
  const isStale = freshnessState === 'stale' || freshnessState === 'aging';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(trend)}
      className={cn(
        "w-full text-left p-4 rounded-xl",
        "bg-[hsl(var(--portal-bg-card))]",
        "border border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-border-hover))]",
        "hover:shadow-md transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue))]",
        trend.is_breaking && "border-l-4 border-l-[hsl(var(--portal-error))]"
      )}
    >
      <div className="flex items-start gap-3">
        {showRank && rank && (
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--portal-bg-elevated))] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[hsl(var(--portal-text-muted))]">
              {rank}
            </span>
          </div>
        )}
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {trend.is_breaking && (
              <Badge className="bg-[hsl(var(--portal-error))] text-white text-xs gap-1">
                <Zap className="h-3 w-3" />
                Breaking
              </Badge>
            )}
            {outcomeStats?.isHighPerforming && outcomeStats.confidenceLevel !== 'low' && (
              <Badge className="bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))] text-xs gap-1">
                <Award className="h-3 w-3" />
                High Performing
              </Badge>
            )}
            {isRelevant && relevanceScore && relevanceScore >= 70 && (
              <Badge className="bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))] text-xs gap-1">
                <Target className="h-3 w-3" />
                High Match
              </Badge>
            )}
          </div>

          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] truncate">
            {trend.event_title}
          </h3>

          <div className="flex items-center gap-4 text-xs text-[hsl(var(--portal-text-muted))]">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {Math.round(trend.velocity)}% velocity
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {trend.evidence_count} sources
            </span>
            <span className={cn(
              "flex items-center gap-1",
              isStale && "text-[hsl(var(--portal-warning))]"
            )}>
              <Clock className="h-3 w-3" />
              {getLastSeenLabel()} ago
              {isStale && <span className="text-[10px]">⚠</span>}
            </span>
          </div>

          {relevanceReasons && relevanceReasons.length > 0 && (
            <p className="text-xs text-[hsl(var(--portal-accent-blue))] line-clamp-1">
              <Sparkles className="h-3 w-3 inline mr-1" />
              {relevanceReasons[0]}
            </p>
          )}

          {trend.top_headline && (
            <p className="text-xs text-[hsl(var(--portal-text-secondary))] line-clamp-2 italic">
              "{trend.top_headline}"
            </p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-[hsl(var(--portal-text-muted))] shrink-0" />
      </div>
    </motion.button>
  );
}

// ============================================================================
// Section Cards
// ============================================================================

interface SectionCardProps {
  title: string;
  subtitle: string;
  icon: typeof Zap;
  iconColor: string;
  count: number;
  countLabel: string;
  accent?: "blue" | "red" | "amber" | "green" | "purple";
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  count,
  countLabel,
  accent = "default" as any,
  children,
  isLoading,
  isEmpty,
  emptyMessage,
  onRefresh,
  isRefreshing,
}: SectionCardProps) {
  return (
    <V3Card accent={accent} className="h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", iconColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                {title}
              </h2>
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {count} {countLabel}
            </Badge>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              {emptyMessage || "No items to display"}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </V3Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ClientNewsTrends() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  
  // Fetch trends data with org context
  const { 
    events: trendEvents, 
    isLoading: trendsLoading, 
    stats: trendStats,
    refresh: refreshTrends 
  } = useTrendEvents({ limit: 50 });

  // Fetch org-scoped relevance
  const { 
    data: orgScores, 
    isLoading: scoresLoading,
    refetch: refreshScores
  } = useOrgTrendScores(organizationId, { limit: 50 });

  // Fetch outcome correlations for "High Performing" badges
  const { getByEventId: getOutcome } = useOrgTrendOutcomesMap(organizationId);

  // UI State
  const [selectedTrend, setSelectedTrend] = useState<TrendEvent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Breaking trends (high confidence, is_breaking flag)
  const breakingTrends = trendEvents.filter(t => t.is_breaking).slice(0, 5);

  // Relevant to org (from org_trend_scores with high relevance)
  const relevantTrends = orgScores
    ?.filter(s => s.relevance_score >= 50)
    ?.map(score => {
      const trend = trendEvents.find(t => t.id === score.trend_event_id);
      return trend ? { 
        ...trend, 
        relevanceScore: score.relevance_score,
        relevanceReasons: score.explanation?.reasons || []
      } : null;
    })
    .filter(Boolean)
    .slice(0, 8) as (TrendEvent & { relevanceScore: number; relevanceReasons: string[] })[];

  // Watchlist mentions (trends matching watchlist - check matched_entities)
  const watchlistTrends = orgScores
    ?.filter(s => s.matched_entities?.length > 0)
    ?.map(score => {
      const trend = trendEvents.find(t => t.id === score.trend_event_id);
      return trend ? { 
        ...trend, 
        matchedEntities: score.matched_entities,
        relevanceScore: score.relevance_score
      } : null;
    })
    .filter(Boolean)
    .slice(0, 6) as (TrendEvent & { matchedEntities: string[]; relevanceScore: number })[];

  // Top general trends (by confidence)
  const topTrends = trendEvents
    .filter(t => t.is_trending && t.confidence_score >= 50)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 10);

  // Risk/Opposition (trends with negative sentiment or matching opposition keywords)
  const riskTrends = trendEvents
    .filter(t => {
      // Simple heuristic: low velocity with high volume or negative indicators
      return t.is_trending && t.velocity < 30 && t.evidence_count >= 3;
    })
    .slice(0, 5);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshTrends(), refreshScores()]);
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshTrends, refreshScores]);

  const handleSelectTrend = (trend: TrendEvent) => {
    setSelectedTrend(trend);
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (orgLoading) {
    return (
      <ClientShell pageTitle="News & Trends">
        <div className="p-6">
          <V3LoadingState variant="card" height={400} />
        </div>
      </ClientShell>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <ClientShell pageTitle="News & Trends" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <V3SectionHeader
            title="News & Trends"
            subtitle="Real-time intelligence tailored to your organization"
            icon={Activity}
            variant="premium"
            isLive
            lastUpdated={lastRefresh}
          />
          <Button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="gap-2"
            variant="outline"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </header>

        {/* Data Freshness Banner - SLA-driven from pipeline_freshness */}
        <DataFreshnessBanner />

        {/* Breaking Now - Full Width */}
        {breakingTrends.length > 0 && (
          <SectionCard
            title="Breaking Now"
            subtitle="High-velocity stories requiring immediate attention"
            icon={Zap}
            iconColor="bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]"
            count={breakingTrends.length}
            countLabel="breaking"
            accent="red"
            isLoading={trendsLoading}
            isEmpty={breakingTrends.length === 0}
            emptyMessage="No breaking stories right now"
          >
            <ScrollArea className="h-[200px]">
              <div className="space-y-3 pr-4">
                {breakingTrends.map((trend, index) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    outcomeStats={getOutcome(trend.id)}
                    onSelect={handleSelectTrend}
                    showRank
                    rank={index + 1}
                  />
                ))}
              </div>
            </ScrollArea>
          </SectionCard>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Relevant to You */}
          <SectionCard
            title="Relevant to You"
            subtitle="Topics matching your mission and interests"
            icon={Target}
            iconColor="bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]"
            count={relevantTrends?.length || 0}
            countLabel="matches"
            accent="blue"
            isLoading={trendsLoading || scoresLoading}
            isEmpty={!relevantTrends || relevantTrends.length === 0}
            emptyMessage="No relevant trends found. Update your profile to improve matching."
          >
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {relevantTrends?.map((trend, index) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    isRelevant
                    relevanceScore={trend.relevanceScore}
                    relevanceReasons={trend.relevanceReasons}
                    outcomeStats={getOutcome(trend.id)}
                    onSelect={handleSelectTrend}
                    showRank
                    rank={index + 1}
                  />
                ))}
              </div>
            </ScrollArea>
          </SectionCard>

          {/* Watchlist Mentions */}
          <SectionCard
            title="Watchlist Mentions"
            subtitle="Your monitored entities in the news"
            icon={Eye}
            iconColor="bg-[hsl(var(--portal-accent-purple)/0.15)] text-[hsl(var(--portal-accent-purple))]"
            count={watchlistTrends?.length || 0}
            countLabel="mentions"
            accent="purple"
            isLoading={trendsLoading || scoresLoading}
            isEmpty={!watchlistTrends || watchlistTrends.length === 0}
            emptyMessage="No watchlist mentions. Add entities to your watchlist to track them."
          >
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {watchlistTrends?.map((trend) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    isRelevant
                    relevanceScore={trend.relevanceScore}
                    outcomeStats={getOutcome(trend.id)}
                    onSelect={handleSelectTrend}
                  />
                ))}
              </div>
            </ScrollArea>
          </SectionCard>
        </div>

        {/* Top Trends - Full Width */}
        <SectionCard
          title="Top Trends"
          subtitle="Highest confidence trending topics across all sources"
          icon={TrendingUp}
          iconColor="bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]"
          count={topTrends.length}
          countLabel="trending"
          accent="green"
          isLoading={trendsLoading}
          isEmpty={topTrends.length === 0}
          emptyMessage="No trending topics detected"
          onRefresh={handleRefreshAll}
          isRefreshing={isRefreshing}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topTrends.map((trend, index) => (
              <TrendCard
                key={trend.id}
                trend={trend}
                outcomeStats={getOutcome(trend.id)}
                onSelect={handleSelectTrend}
                showRank
                rank={index + 1}
              />
            ))}
          </div>
        </SectionCard>

        {/* Opposition/Risk Monitoring */}
        {riskTrends.length > 0 && (
          <SectionCard
            title="Opposition & Risk"
            subtitle="Stories requiring defensive monitoring"
            icon={ShieldAlert}
            iconColor="bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))]"
            count={riskTrends.length}
            countLabel="flagged"
            accent="amber"
            isLoading={trendsLoading}
            isEmpty={riskTrends.length === 0}
            emptyMessage="No risk items flagged"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {riskTrends.map((trend) => (
                <TrendCard
                  key={trend.id}
                  trend={trend}
                  outcomeStats={getOutcome(trend.id)}
                  onSelect={handleSelectTrend}
                />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Drilldown Sheet */}
      <Sheet open={!!selectedTrend} onOpenChange={() => setSelectedTrend(null)}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl overflow-y-auto portal-bg"
        >
          {selectedTrend && (
            <TrendDrilldownPanel
              trend={selectedTrend}
              organizationId={organizationId}
              onClose={() => setSelectedTrend(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </ClientShell>
  );
}
