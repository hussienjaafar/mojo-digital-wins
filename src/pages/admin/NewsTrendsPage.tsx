import { useState, useCallback } from "react";
import { Users, Globe, PanelLeftClose, PanelLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendsConsole,
  AdminPageHeader,
  BriefingStrip,
  BriefingDrawer,
  AlertsDrawer,
  PersonalizationBanner,
  TrendsFilterRail,
  type FilterState,
} from "@/components/admin/v3";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { TrendEventDrilldownView } from "@/components/admin/v3/TrendEventDrilldownView";

type ViewMode = "trends" | "feed" | "trend_detail";
type ClientMode = "for_you" | "global";
type TabMode = "for_you" | "explore";

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
  const [clientMode, setClientMode] = useState<ClientMode>("for_you");
  const [activeTab, setActiveTab] = useState<TabMode>("for_you");
  const [showPersonalizationBanner, setShowPersonalizationBanner] = useState(true);
  
  // Filter rail state
  const [filterRailCollapsed, setFilterRailCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');

  // Placeholder personalization data - in production from org profile
  const personalizationPriorities = ["Middle East policy", "Civil rights", "Michigan"];
  const availableTopics = ["Middle East", "Civil Rights", "Healthcare", "Education", "Climate", "Immigration"];

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
    if (value === "for_you" || value === "explore") {
      setActiveTab(value);
      setMode("trends");
      setSelectedTrendId(null);
    }
  }, []);

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <AdminPageHeader
        title="News & Trends"
        description="Real-time political intelligence monitoring and evidence-based trend analysis"
      />

      {/* Layer 1: Briefing Strip - Calm, minimal status bar */}
      <BriefingStrip
        onOpenBriefing={() => setBriefingDrawerOpen(true)}
        onOpenAlerts={() => setAlertsDrawerOpen(true)}
        onOpenDetails={() => setDetailsDrawerOpen(true)}
        alertCount={3}
        clientMode={clientMode}
        onClientModeChange={setClientMode}
      />

      {/* Layer 2: Main Workspace with Tabs */}
      {mode !== "trend_detail" ? (
        <>
          {/* For You / Explore Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-xs grid-cols-2 h-10">
                <TabsTrigger value="for_you" className="gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  For You
                </TabsTrigger>
                <TabsTrigger value="explore" className="gap-2 text-sm">
                  <Globe className="h-4 w-4" />
                  Explore
                </TabsTrigger>
              </TabsList>
              
              {/* Filter Rail Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setFilterRailCollapsed(!filterRailCollapsed)}
                  >
                    {filterRailCollapsed ? (
                      <PanelLeft className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {filterRailCollapsed ? "Show filters" : "Hide filters"}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Personalization Banner - Only in For You tab */}
            {activeTab === "for_you" && showPersonalizationBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <PersonalizationBanner
                  clientName="Democracy Forward"
                  priorities={personalizationPriorities}
                  onEditPreferences={() => console.log("Edit preferences")}
                  onDismiss={() => setShowPersonalizationBanner(false)}
                />
              </motion.div>
            )}

            {/* Main Content Area with Filter Rail */}
            <div className="flex gap-4 mt-4">
              {/* Filter Rail - Collapsible sidebar */}
              <TrendsFilterRail
                filters={filters}
                onFiltersChange={setFilters}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isCollapsed={filterRailCollapsed}
                onToggleCollapse={() => setFilterRailCollapsed(!filterRailCollapsed)}
                availableTopics={availableTopics}
              />

              {/* Trends Console - Main workspace */}
              <div className="flex-1 min-w-0">
                <TabsContent value="for_you" className="mt-0">
                  <TrendsConsole 
                    onDrilldown={handleTrendDrilldown}
                    viewMode="for_you"
                    filters={filters}
                    searchQuery={searchQuery}
                  />
                </TabsContent>
                
                <TabsContent value="explore" className="mt-0">
                  <TrendsConsole 
                    onDrilldown={handleTrendDrilldown}
                    viewMode="explore"
                    filters={filters}
                    searchQuery={searchQuery}
                  />
                </TabsContent>
              </div>
            </div>
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
