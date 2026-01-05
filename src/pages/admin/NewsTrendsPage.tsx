import { useState, useCallback } from "react";
import { TrendingUp, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  TrendsConsole,
  AdminPageHeader 
} from "@/components/admin/v3";
import { DataStatusBar } from "@/components/admin/v3/DataStatusBar";
import { PipelineHealthDrawer } from "@/components/admin/v3/PipelineHealthDrawer";
import { NewsInvestigationTable } from "@/components/admin/v3/NewsInvestigationTable";

type ViewMode = "trends" | "feed" | "cluster";

interface ClusterDrilldownProps {
  clusterId: string;
  onBack: () => void;
}

function ClusterDrilldown({ clusterId, onBack }: ClusterDrilldownProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          ← Back to Trends
        </Button>
        <h2 className="text-lg font-semibold">Cluster Details</h2>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">
          Cluster drilldown for: <code className="text-foreground">{clusterId}</code>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Timeline, top articles, entities, and action buttons coming soon.
        </p>
      </div>
    </div>
  );
}

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

      {/* Content */}
      {mode === "trends" && (
        <TrendsConsole onDrilldown={handleClusterDrilldown} />
      )}
      
      {mode === "feed" && (
        <NewsInvestigationTable />
      )}
      
      {mode === "cluster" && selectedCluster && (
        <ClusterDrilldown 
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
