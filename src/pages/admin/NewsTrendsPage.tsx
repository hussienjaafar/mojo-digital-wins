import { useState, useCallback } from "react";
import { TrendingUp, Newspaper, Users, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendsConsole,
  AdminPageHeader,
  BriefingStrip,
  BriefingDrawer,
  AlertsDrawer,
  PersonalizationBanner,
} from "@/components/admin/v3";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { NewsInvestigationTable } from "@/components/admin/v3/NewsInvestigationTable";
import { TrendEventDrilldownView } from "@/components/admin/v3/TrendEventDrilldownView";

type ViewMode = "trends" | "feed" | "trend_detail";
type ClientMode = "for_you" | "global";
type TabMode = "for_you" | "explore";

export function NewsTrendsPage() {
  const [mode, setMode] = useState<ViewMode>("trends");
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [briefingDrawerOpen, setBriefingDrawerOpen] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [clientMode, setClientMode] = useState<ClientMode>("for_you");
  const [activeTab, setActiveTab] = useState<TabMode>("for_you");
  const [showPersonalizationBanner, setShowPersonalizationBanner] = useState(true);

  // Placeholder personalization data - in production from org profile
  const personalizationPriorities = ["Middle East policy", "Civil rights", "Michigan"];

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

            <TabsContent value="for_you" className="mt-4">
              <TrendsConsole 
                onDrilldown={handleTrendDrilldown}
                viewMode="for_you"
              />
            </TabsContent>
            
            <TabsContent value="explore" className="mt-4">
              <TrendsConsole 
                onDrilldown={handleTrendDrilldown}
                viewMode="explore"
              />
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
