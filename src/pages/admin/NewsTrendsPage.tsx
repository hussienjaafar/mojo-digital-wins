import { useState, useCallback } from "react";
import { TrendingUp, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  TrendsConsole,
  AdminPageHeader,
  DeltaSinceLoginCard,
  RiskImpactSummary,
} from "@/components/admin/v3";
import { DataStatusBar } from "@/components/admin/v3/DataStatusBar";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { NewsInvestigationTable } from "@/components/admin/v3/NewsInvestigationTable";
import { ClusterDrilldownView } from "@/components/admin/v3/ClusterDrilldownView";

type ViewMode = "trends" | "feed" | "cluster";

export function NewsTrendsPage() {
  const [mode, setMode] = useState<ViewMode>("trends");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleClusterDrilldown = useCallback((clusterId: string) => {
    setSelectedCluster(clusterId);
    setMode("cluster");
  }, []);

  const handleBackFromCluster = useCallback(() => {
    setSelectedCluster(null);
    setMode("trends");
  }, []);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="News & Trends"
        description="Real-time political intelligence monitoring and trend analysis"
      />

      {/* Mode Switcher */}
      {mode !== "cluster" && (
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Button
            variant={mode === "trends" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("trends")}
            className={cn(
              "gap-2",
              mode === "trends" && "bg-primary text-primary-foreground"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Trends Console
          </Button>
          <Button
            variant={mode === "feed" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("feed")}
            className={cn(
              "gap-2",
              mode === "feed" && "bg-primary text-primary-foreground"
            )}
          >
            <Newspaper className="h-4 w-4" />
            News Feed
          </Button>
        </div>
      )}

      {/* Data Status Bar - Compact pipeline health indicator */}
      <DataStatusBar onOpenDetails={() => setDrawerOpen(true)} />

      {/* Executive Summary Cards */}
      {mode !== "cluster" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DeltaSinceLoginCard />
          <RiskImpactSummary />
        </div>
      )}

      {/* Content */}
      {mode === "trends" && (
        <TrendsConsole onDrilldown={handleClusterDrilldown} />
      )}
      
      {mode === "feed" && (
        <NewsInvestigationTable />
      )}
      
      {mode === "cluster" && selectedCluster && (
        <ClusterDrilldownView 
          clusterId={selectedCluster} 
          onBack={handleBackFromCluster} 
        />
      )}

      {/* Pipeline Health Drawer */}
      <PipelineHealthDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

export default NewsTrendsPage;
