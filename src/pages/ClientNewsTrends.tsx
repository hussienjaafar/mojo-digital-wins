import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useTrendEvents, useTrendEvidence } from "@/hooks/useTrendEvents";
import { useUnifiedTrends } from "@/hooks/useUnifiedTrends";
import { useOrgTrendScores } from "@/hooks/useOrgRelevance";
import { useOrgTrendOutcomesMap, type OutcomeStats } from "@/hooks/useTrendOutcomes";
import { useSourceFreshness } from "@/hooks/useSourceFreshness";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  V3Card,
  V3CardHeader,
  V3CardContent,
  V3SectionHeader,
  V3Badge,
  V3EmptyState,
  V3LoadingState,
  V3Button,
} from "@/components/v3";

import {
  Zap,
  TrendingUp,
  Eye,
  Target,
  RefreshCw,
  ChevronRight,
  Activity,
  Award,
  BarChart3,
  Settings,
} from "lucide-react";

import { TrendDrilldownPanel } from "@/components/client/TrendDrilldownPanel";
import { DataFreshnessBanner } from "@/components/client/DataFreshnessBanner";
import type { TrendEvent } from "@/hooks/useTrendEvents";

// ============================================================================
// Types
// ============================================================================

type IASection = "primary" | "explore";

// ============================================================================
// Trend Card Component (Simplified V3)
// ============================================================================

interface TrendCardProps {
  trend: TrendEvent;
  isRelevant?: boolean;
  relevanceScore?: number;
  relevanceReasons?: string[];
  relevanceExplanation?: string;
  outcomeStats?: OutcomeStats | null;
  onSelect: (trend: TrendEvent) => void;
  showRank?: boolean;
  rank?: number;
  isDataStale?: boolean;
}

function TrendCard({ 
  trend, 
  isRelevant, 
  relevanceScore, 
  relevanceReasons,
  relevanceExplanation,
  outcomeStats,
  onSelect,
  showRank,
  rank,
  isDataStale = false
}: TrendCardProps) {
  // Calculate freshness
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

  // Single priority badge (Breaking > High Performing > High Match)
  // Tone down Breaking badge when data is stale
  const getPriorityBadge = () => {
    if (trend.is_breaking) {
      // When data is stale, show muted version
      if (isDataStale) {
        return <V3Badge variant="muted" icon={<Zap className="h-3 w-3" />}>Breaking</V3Badge>;
      }
      return <V3Badge variant="red" icon={<Zap className="h-3 w-3" />}>Breaking</V3Badge>;
    }
    if (outcomeStats?.isHighPerforming && outcomeStats.confidenceLevel !== 'low') {
      return <V3Badge variant="success" icon={<Award className="h-3 w-3" />}>High Performing</V3Badge>;
    }
    if (isRelevant && relevanceScore && relevanceScore >= 70) {
      return <V3Badge variant="blue" icon={<Target className="h-3 w-3" />}>High Match</V3Badge>;
    }
    return null;
  };

  const priorityBadge = getPriorityBadge();
  
  // Build single-line relevance explanation
  const getRelevanceHint = () => {
    if (relevanceExplanation) return relevanceExplanation;
    if (relevanceReasons && relevanceReasons.length > 0) {
      return relevanceReasons[0];
    }
    return null;
  };
  
  const relevanceHint = getRelevanceHint();

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(trend)}
      className={cn(
        "w-full text-left p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-border-hover))] hover:bg-[hsl(var(--portal-bg-secondary))]",
        "transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.5)]",
        trend.is_breaking && "border-l-2 border-l-[hsl(var(--portal-error))]"
      )}
    >
      <div className="flex items-center gap-3">
        {showRank && rank && (
          <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))] tabular-nums w-5 shrink-0">
            {rank}
          </span>
        )}
        
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] truncate">
            {trend.canonical_label || trend.event_title}
          </h3>

          {/* Relevance hint (1 line max) */}
          {relevanceHint && (
            <p className="text-xs text-[hsl(var(--portal-accent-blue))] truncate">
              {relevanceHint}
            </p>
          )}

          {/* Context terms for entity-only trends */}
          {trend.context_terms && trend.context_terms.length > 0 && (
            <p className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
              {trend.context_terms.slice(0, 3).join(' · ')}
            </p>
          )}

          {/* Compact meta line: velocity · sources · freshness · badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-1">
              {Math.round(trend.velocity)}% · {trend.evidence_count} src ·
              <span className={cn(isStale && "text-[hsl(var(--portal-warning))]")}>
                {getLastSeenLabel()}
              </span>
            </span>
            {priorityBadge}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))] shrink-0" />
      </div>
    </motion.button>
  );
}

// ============================================================================
// Section Card (V3 Styled)
// ============================================================================

interface SectionCardProps {
  title: string;
  subtitle: string;
  icon: typeof Zap;
  iconColor: string;
  count: number;
  accent?: "blue" | "green" | "purple" | "amber" | "red";
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  maxHeight?: string;
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  count,
  accent = "blue",
  children,
  isLoading,
  isEmpty,
  emptyTitle,
  emptyMessage,
  emptyAction,
  maxHeight = "320px",
}: SectionCardProps) {
  return (
    <V3Card accent={accent} className="h-full">
      <V3CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                {title}
              </h3>
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                {subtitle}
              </p>
            </div>
          </div>
          <V3Badge variant="muted" size="sm">{count}</V3Badge>
        </div>
      </V3CardHeader>
      <V3CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <V3EmptyState
            title={emptyTitle || "No items"}
            description={emptyMessage}
            action={emptyAction}
            variant="compact"
            accent={accent}
            icon={Icon}
          />
        ) : (
          <ScrollArea style={{ height: maxHeight }}>
            <div className="space-y-2 pr-3">
              {children}
            </div>
          </ScrollArea>
        )}
      </V3CardContent>
    </V3Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ClientNewsTrends() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  
  // Fetch data freshness state
  const { data: freshness } = useSourceFreshness();
  const isDataStale = freshness?.overallStatus === 'stale' || freshness?.overallStatus === 'critical';
  
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
  const [activeTab, setActiveTab] = useState<IASection>("primary");

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Breaking trends
  const breakingTrends = trendEvents.filter(t => t.is_breaking).slice(0, 5);

  // Relevant to org (with explanation for card display)
  const relevantTrends = orgScores
    ?.filter(s => s.relevance_score >= 50)
    ?.map(score => {
      const trend = trendEvents.find(t => t.id === score.trend_event_id);
      const reasons = score.explanation?.reasons || [];
      return trend ? { 
        ...trend, 
        relevanceScore: score.relevance_score,
        relevanceReasons: reasons,
        // Generate 1-line explanation
        relevanceExplanation: reasons.length > 0 ? reasons[0] : undefined
      } : null;
    })
    .filter(Boolean)
    .slice(0, 8) as (TrendEvent & { relevanceScore: number; relevanceReasons: string[]; relevanceExplanation?: string })[];

  // Watchlist mentions (with entity as explanation)
  const watchlistTrends = orgScores
    ?.filter(s => s.matched_entities?.length > 0)
    ?.map(score => {
      const trend = trendEvents.find(t => t.id === score.trend_event_id);
      const entities = score.matched_entities || [];
      return trend ? { 
        ...trend, 
        matchedEntities: entities,
        relevanceScore: score.relevance_score,
        relevanceExplanation: entities.length > 0 ? `Mentions: ${entities.slice(0, 2).join(', ')}` : undefined
      } : null;
    })
    .filter(Boolean)
    .slice(0, 6) as (TrendEvent & { matchedEntities: string[]; relevanceScore: number; relevanceExplanation?: string })[];

  // Top general trends
  const topTrends = trendEvents
    .filter(t => t.is_trending && t.confidence_score >= 50)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 10);

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
      <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
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
          <V3Button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
          >
            Refresh
          </V3Button>
        </header>

        {/* Data Freshness Banner */}
        <DataFreshnessBanner />

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as IASection)}>
          <TabsList className="bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))] p-1 gap-1">
            <TabsTrigger 
              value="primary" 
              className="data-[state=active]:bg-[hsl(var(--portal-bg-card))] data-[state=active]:shadow-sm text-sm"
            >
              Priority Feed
            </TabsTrigger>
            <TabsTrigger 
              value="explore" 
              className="data-[state=active]:bg-[hsl(var(--portal-bg-card))] data-[state=active]:shadow-sm text-sm"
            >
              Explore Trends
            </TabsTrigger>
          </TabsList>

          {/* Primary Tab: Relevant first, then Breaking, then Watchlist */}
          <TabsContent value="primary" className="mt-4 space-y-5">
            {/* Relevant to You - prioritized at top */}
            <SectionCard
              title="Relevant to You"
              subtitle="Topics matching your mission"
              icon={Target}
              iconColor="bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]"
              count={relevantTrends?.length || 0}
              accent="blue"
              isLoading={trendsLoading || scoresLoading}
              isEmpty={!relevantTrends || relevantTrends.length === 0}
              emptyTitle="No matching trends yet"
              emptyMessage="Update your organization profile to see trends relevant to your mission."
              emptyAction={
                <V3Button variant="outline" size="sm" leftIcon={<Settings className="h-3 w-3" />}>
                  Update Profile
                </V3Button>
              }
            >
              {relevantTrends?.map((trend, index) => (
                <TrendCard
                  key={trend.id}
                  trend={trend}
                  isRelevant
                  relevanceScore={trend.relevanceScore}
                  relevanceReasons={trend.relevanceReasons}
                  relevanceExplanation={trend.relevanceExplanation}
                  outcomeStats={getOutcome(trend.id)}
                  onSelect={handleSelectTrend}
                  showRank
                  rank={index + 1}
                  isDataStale={isDataStale}
                />
              ))}
            </SectionCard>

            {/* Two Column Layout: Breaking + Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Breaking Now */}
              <SectionCard
                title="Breaking Now"
                subtitle="High-velocity stories"
                icon={Zap}
                iconColor="bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]"
                count={breakingTrends.length}
                accent="red"
                maxHeight="280px"
                isLoading={trendsLoading}
                isEmpty={breakingTrends.length === 0}
                emptyTitle="No breaking news"
                emptyMessage="When major stories spike, they'll appear here."
              >
                {breakingTrends.map((trend, index) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    outcomeStats={getOutcome(trend.id)}
                    onSelect={handleSelectTrend}
                    showRank
                    rank={index + 1}
                    isDataStale={isDataStale}
                  />
                ))}
              </SectionCard>

              {/* Watchlist Mentions */}
              <SectionCard
                title="Watchlist Mentions"
                subtitle="Your monitored entities"
                icon={Eye}
                iconColor="bg-[hsl(var(--portal-accent-purple)/0.15)] text-[hsl(var(--portal-accent-purple))]"
                count={watchlistTrends?.length || 0}
                accent="purple"
                isLoading={trendsLoading || scoresLoading}
                isEmpty={!watchlistTrends || watchlistTrends.length === 0}
                emptyTitle="No watchlist activity"
                emptyMessage="Add entities to your watchlist to track mentions."
                emptyAction={
                  <V3Button variant="outline" size="sm" leftIcon={<Eye className="h-3 w-3" />}>
                    Manage Watchlist
                  </V3Button>
                }
              >
                {watchlistTrends?.map((trend) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    isRelevant
                    relevanceScore={trend.relevanceScore}
                    relevanceExplanation={trend.relevanceExplanation}
                    outcomeStats={getOutcome(trend.id)}
                    onSelect={handleSelectTrend}
                    isDataStale={isDataStale}
                  />
                ))}
              </SectionCard>
            </div>
          </TabsContent>

          {/* Explore Tab: Top Trends */}
          <TabsContent value="explore" className="mt-4">
            <V3Card accent="green">
              <V3CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                        Top Trends
                      </h3>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                        Highest confidence trending topics
                      </p>
                    </div>
                  </div>
                  <V3Badge variant="muted" size="sm">{topTrends.length}</V3Badge>
                </div>
              </V3CardHeader>
              <V3CardContent>
                {trendsLoading ? (
                  <V3LoadingState variant="kpi-grid" count={6} />
                ) : topTrends.length === 0 ? (
                  <V3EmptyState
                    title="No trending topics"
                    description="When topics surge in the news, they'll appear here."
                    icon={TrendingUp}
                    accent="green"
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topTrends.map((trend, index) => (
                      <TrendCard
                        key={trend.id}
                        trend={trend}
                        outcomeStats={getOutcome(trend.id)}
                        onSelect={handleSelectTrend}
                        showRank
                        rank={index + 1}
                        isDataStale={isDataStale}
                      />
                    ))}
                  </div>
                )}
              </V3CardContent>
            </V3Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Drilldown Sheet */}
      <Sheet open={!!selectedTrend} onOpenChange={() => setSelectedTrend(null)}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl overflow-y-auto !bg-[hsl(var(--portal-bg-secondary))]"
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
