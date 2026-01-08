import { useState, useCallback, useEffect, useMemo } from "react";
import { Users, Globe, Newspaper, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendsConsole,
  AdminPageHeader,
  BriefingDrawer,
  AlertsDrawer,
  TrendsFilterRail,
  SavedViewsSelector,
  ExecutiveSignalBar,
  ExecutiveSummary,
  PrimarySignalCard,
  SecondaryExplorer,
  CommandPaletteFilter,
  type FilterState,
} from "@/components/admin/v3";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { TrendEventDrilldownView } from "@/components/admin/v3/TrendEventDrilldownView";
import { NewsFeed } from "@/components/news/NewsFeed";
import { useSavedViews } from "@/hooks/useSavedViews";
import { useTrendEvents } from "@/hooks/useTrendEvents";

type ViewMode = "trends" | "feed" | "trend_detail";
type ClientMode = "for_you" | "global";
type TabMode = "for_you" | "explore" | "feed";

const DEFAULT_FILTERS: FilterState = {
  timeWindow: '24h',
  sources: { news: true, social: true },
  highConfidenceOnly: false,
  geography: 'all',
  topics: [],
};

export function NewsTrendsPage() {
  const [mode, setMode] = useState<ViewMode>("trends");
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [briefingDrawerOpen, setBriefingDrawerOpen] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [clientMode, setClientMode] = useState<ClientMode>("for_you");
  const [activeTab, setActiveTab] = useState<TabMode>("for_you");
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  
  // Filter rail state - collapsed by default per Phase 1
  const [filterRailCollapsed, setFilterRailCollapsed] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Saved views
  const { views, activeView, activeViewId, selectView, createView, deleteView } = useSavedViews();
  
  // Fetch trends for primary signals
  const { events: trends, isLoading: trendsLoading, stats } = useTrendEvents({ limit: 50, minConfidence: 30 });
  
  // Sync filters when saved view changes
  useEffect(() => {
    if (activeView) {
      setFilters(activeView.filters);
    }
  }, [activeView]);

  // Available topics for filtering
  const availableTopics = ["Middle East", "Civil Rights", "Healthcare", "Education", "Climate", "Immigration"];

  // Compute primary signals (top 5 for "Monitor Mode")
  const primarySignals = useMemo(() => {
    if (!trends) return [];
    
    // Filter for high-confidence or breaking trends
    const actionable = trends.filter(t => 
      t.is_breaking || 
      t.confidence_score >= 70 ||
      (t.z_score_velocity && t.z_score_velocity >= 2)
    );
    
    // Sort by importance (breaking first, then by confidence)
    return actionable
      .sort((a, b) => {
        if (a.is_breaking && !b.is_breaking) return -1;
        if (!a.is_breaking && b.is_breaking) return 1;
        return b.confidence_score - a.confidence_score;
      })
      .slice(0, 5);
  }, [trends]);

  // Executive summary data
  const executiveSummaryData = useMemo(() => {
    const opportunities = primarySignals.filter(t => 
      t.trend_stage === 'emerging' || t.trend_stage === 'surging'
    ).length;
    
    const risks = primarySignals.filter(t => 
      t.is_breaking || t.trend_stage === 'peaking'
    ).length;
    
    const keyTakeaways = primarySignals.slice(0, 2).map(t => ({
      text: t.context_summary || `${t.canonical_label || t.event_title} is ${t.trend_stage || 'trending'} with ${t.current_24h} mentions`,
      type: (t.is_breaking ? 'risk' : t.trend_stage === 'emerging' ? 'opportunity' : 'neutral') as 'opportunity' | 'risk' | 'neutral',
      trendId: t.id,
    }));
    
    return { opportunities, risks, keyTakeaways };
  }, [primarySignals]);

  // Handle drilldown to trend_events detail view
  const handleTrendDrilldown = useCallback((trendId: string) => {
    setSelectedTrendId(trendId);
    setMode("trend_detail");
  }, []);

  const handleBackFromTrendDetail = useCallback(() => {
    setSelectedTrendId(null);
    setMode("trends");
  }, []);

  const handleTabChange = useCallback((value: string) => {
    if (value === "for_you" || value === "explore" || value === "feed") {
      setActiveTab(value);
      setMode("trends");
      setSelectedTrendId(null);
    }
  }, []);

  const handleSearchFromPalette = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <AdminPageHeader
        title="Political Intelligence"
        description="Decision support for high-stakes moments"
      />

      {/* Layer 1: Executive Signal Bar */}
      <ExecutiveSignalBar
        actionableSignalCount={primarySignals.length}
        onOpenBriefing={() => setBriefingDrawerOpen(true)}
        onOpenAlerts={() => setAlertsDrawerOpen(true)}
        onOpenDetails={() => setDetailsDrawerOpen(true)}
        alertCount={3}
      />

      {/* Layer 2: Executive Summary (collapsible) */}
      {activeTab === "for_you" && (
        <ExecutiveSummary
          opportunities={executiveSummaryData.opportunities}
          risks={executiveSummaryData.risks}
          keyTakeaways={executiveSummaryData.keyTakeaways}
          lastLoginAt={new Date(Date.now() - 1000 * 60 * 60 * 4)} // Mock: 4 hours ago
          onViewTrend={handleTrendDrilldown}
        />
      )}

      {/* Main Content Area */}
      {mode !== "trend_detail" ? (
        <>
          {/* Tabs for view switching */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TabsList className="grid w-full max-w-md grid-cols-3 h-10">
                  <TabsTrigger value="for_you" className="gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    For You
                  </TabsTrigger>
                  <TabsTrigger value="explore" className="gap-2 text-sm">
                    <Globe className="h-4 w-4" />
                    Explore
                  </TabsTrigger>
                  <TabsTrigger value="feed" className="gap-2 text-sm">
                    <Newspaper className="h-4 w-4" />
                    News Feed
                  </TabsTrigger>
                </TabsList>
                
                {/* Saved Views Selector */}
                {activeTab === "for_you" && (
                  <SavedViewsSelector
                    views={views}
                    activeViewId={activeViewId}
                    onSelectView={selectView}
                    onCreateView={createView}
                    onDeleteView={deleteView}
                    currentFilters={filters}
                  />
                )}
              </div>
              
              {/* Command Palette Trigger */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs"
                    onClick={() => setCommandPaletteOpen(true)}
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Search & Filter</span>
                    <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Search trends and apply filters
                </TooltipContent>
              </Tooltip>
            </div>

            {/* For You Tab - Primary Signals */}
            <TabsContent value="for_you" className="mt-4 space-y-4">
              {/* Layer 3: Primary Signal List (3-5 max) */}
              <div className="space-y-3">
                {primarySignals.map((trend, index) => (
                  <PrimarySignalCard
                    key={trend.id}
                    trend={trend}
                    rank={index + 1}
                    whyItMatters={trend.context_summary || `This trend is ${trend.trend_stage || 'active'} and may affect your organization's priorities.`}
                    matchedReasons={trend.context_terms?.slice(0, 3) || []}
                    evidencePreview={trend.top_headline ? [
                      { headline: trend.top_headline, source: 'News' }
                    ] : []}
                    onInvestigate={() => handleTrendDrilldown(trend.id)}
                    onAct={() => handleTrendDrilldown(trend.id)}
                    onCreateAlert={() => console.log('Create alert for', trend.id)}
                  />
                ))}
                
                {primarySignals.length === 0 && !trendsLoading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No actionable signals at this time.</p>
                    <p className="text-sm mt-1">Check back soon or explore all trends below.</p>
                  </div>
                )}
              </div>

              {/* Layer 4: Secondary Exploration (collapsed by default) */}
              <SecondaryExplorer
                isCollapsed={!secondaryExpanded}
                onToggleCollapse={() => setSecondaryExpanded(!secondaryExpanded)}
                onOpenFilters={() => setCommandPaletteOpen(true)}
                newsFeedContent={<NewsFeed />}
              >
                <TrendsConsole 
                  onDrilldown={handleTrendDrilldown}
                  viewMode="for_you"
                  filters={filters}
                  searchQuery={searchQuery}
                />
              </SecondaryExplorer>
            </TabsContent>
            
            {/* Explore Tab - Full Trends Console */}
            <TabsContent value="explore" className="mt-4">
              <div className="flex gap-4">
                {/* Filter Rail - Still available but collapsed by default */}
                <TrendsFilterRail
                  filters={filters}
                  onFiltersChange={setFilters}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  isCollapsed={filterRailCollapsed}
                  onToggleCollapse={() => setFilterRailCollapsed(!filterRailCollapsed)}
                  availableTopics={availableTopics}
                />

                <div className="flex-1 min-w-0">
                  <TrendsConsole 
                    onDrilldown={handleTrendDrilldown}
                    viewMode="explore"
                    filters={filters}
                    searchQuery={searchQuery}
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* News Feed Tab */}
            <TabsContent value="feed" className="mt-4">
              <NewsFeed />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="drilldown"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {selectedTrendId && (
              <TrendEventDrilldownView 
                trendId={selectedTrendId} 
                onBack={handleBackFromTrendDetail} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Command Palette Filter */}
      <CommandPaletteFilter
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={handleSearchFromPalette}
        availableTopics={availableTopics}
      />

      {/* Drawers */}
      <PipelineHealthDrawer open={detailsDrawerOpen} onOpenChange={setDetailsDrawerOpen} />
      <BriefingDrawer 
        open={briefingDrawerOpen} 
        onOpenChange={setBriefingDrawerOpen}
        onViewTrend={(trendId) => {
          setBriefingDrawerOpen(false);
          handleTrendDrilldown(trendId);
        }}
      />
      <AlertsDrawer 
        open={alertsDrawerOpen} 
        onOpenChange={setAlertsDrawerOpen}
        onViewTrend={(trendId) => {
          setAlertsDrawerOpen(false);
          handleTrendDrilldown(trendId);
        }}
      />
    </motion.div>
  );
}

export default NewsTrendsPage;
