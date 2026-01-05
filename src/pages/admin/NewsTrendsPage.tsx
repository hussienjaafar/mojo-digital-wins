import { useState, useCallback } from "react";
import { TrendingUp, Newspaper, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  PipelineHealthPanel, 
  TrendsConsole,
  DataFreshnessIndicator 
} from "@/components/admin/v3";
import { NewsInvestigationTable } from "@/components/admin/v3/NewsInvestigationTable";
import { AdminPageHeader } from "@/components/admin/v3";

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
  const [isForceRunning, setIsForceRunning] = useState(false);

  const handleForceRun = useCallback(async (jobType?: string) => {
    setIsForceRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-scheduled-jobs", {
        body: { force: true, job_type: jobType },
      });
      
      if (error) throw error;
      
      toast.success("Pipeline jobs triggered successfully", {
        description: `Processed ${data?.jobs_run || 0} jobs`,
      });
    } catch (error: any) {
      console.error("Force run failed:", error);
      toast.error("Failed to trigger pipeline", {
        description: error.message,
      });
    } finally {
      setIsForceRunning(false);
    }
  }, []);

  const handleBackfill = useCallback(async (hours: number) => {
    setIsForceRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-scheduled-jobs", {
        body: { force: true, backfill_hours: hours },
      });
      
      if (error) throw error;
      
      toast.success(`Backfill started for last ${hours} hours`, {
        description: `Processing ${data?.estimated_records || 'unknown'} records`,
      });
    } catch (error: any) {
      console.error("Backfill failed:", error);
      toast.error("Failed to start backfill", {
        description: error.message,
      });
    } finally {
      setIsForceRunning(false);
    }
  }, []);

  const handleClusterDrilldown = useCallback((clusterId: string) => {
    setSelectedCluster(clusterId);
    setMode("cluster");
  }, []);

  const handleBackFromCluster = useCallback(() => {
    setSelectedCluster(null);
    setMode("trends");
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="News & Trends"
        description="Real-time political intelligence monitoring and trend analysis"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleForceRun()}
            disabled={isForceRunning}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isForceRunning && "animate-spin")} />
            Force Refresh
          </Button>
        }
      />

      {/* Pipeline Health Panel */}
      <PipelineHealthPanel />

      {/* Mode Switcher */}
      {mode !== "cluster" && (
        <div className="flex items-center gap-2 border-b border-border pb-4">
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
    </div>
  );
}

export default NewsTrendsPage;
