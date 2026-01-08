import { useState, useCallback } from "react";
import { TrendingUp, Newspaper, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendsConsole,
  AdminPageHeader,
  DeltaSinceLoginCard,
  RiskImpactSummary,
} from "@/components/admin/v3";
import { DataStatusBar } from "@/components/admin/v3/DataStatusBar";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { NewsInvestigationTable } from "@/components/admin/v3/NewsInvestigationTable";
import { TrendEventDrilldownView } from "@/components/admin/v3/TrendEventDrilldownView";
import { useTrendsKeyboard } from "@/hooks/useTrendsKeyboard";

type ViewMode = "trends" | "feed" | "trend_detail";

export function NewsTrendsPage() {
  const [mode, setMode] = useState<ViewMode>("trends");
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
    if (value === "trends" || value === "feed") {
      setMode(value);
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

      {/* Data Status Bar - Compact pipeline health indicator */}
      <DataStatusBar onOpenDetails={() => setDrawerOpen(true)} />

      {/* Collapsible Executive Summary */}
      {mode !== "trend_detail" && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between h-9 px-3 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">Executive Summary</span>
                <span className="text-muted-foreground/70">• Activity since last login & risk overview</span>
              </span>
              {summaryOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DeltaSinceLoginCard />
              <RiskImpactSummary />
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Mode Tabs - V3 styled */}
      {mode !== "trend_detail" ? (
        <Tabs value={mode} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-10">
            <TabsTrigger value="trends" className="gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Trends Console
            </TabsTrigger>
            <TabsTrigger value="feed" className="gap-2 text-sm">
              <Newspaper className="h-4 w-4" />
              News Feed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="mt-4">
            <TrendsConsole onDrilldown={handleTrendDrilldown} />
          </TabsContent>
          
          <TabsContent value="feed" className="mt-4">
            <NewsInvestigationTable />
          </TabsContent>
        </Tabs>
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

      {/* Pipeline Health Drawer */}
      <PipelineHealthDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </motion.div>
  );
}

export default NewsTrendsPage;
