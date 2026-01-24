import { useState } from "react";
import { Brain, RefreshCw, Play, Zap, Database, LayoutGrid, List, BookMarked } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  V3PageContainer,
  V3LoadingState,
  V3Button,
  V3Card,
} from "@/components/v3";
import { DonorSegmentBuilder } from "@/components/client/DonorSegmentBuilder";
import { SavedSegmentsList } from "@/components/client/SavedSegmentsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";

export default function ClientDonorIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const [isRunningJourneys, setIsRunningJourneys] = useState(false);
  const [isRunningLtv, setIsRunningLtv] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");
  const queryClient = useQueryClient();

  // Smart refresh hook
  const { 
    handleSmartRefresh, 
    isRefreshing,
    syncingSources 
  } = useSmartRefresh({
    organizationId: organizationId || '',
    onComplete: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-segment'] });
    }
  });

  const handleRunJourneysPipeline = async () => {
    if (!organizationId) return;
    
    setIsRunningJourneys(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('populate-donor-journeys', {
        body: { 
          organization_id: organizationId,
          days_back: 365
        }
      });
      
      if (error) {
        console.error('Journeys pipeline error:', error);
        toast.error('Failed to run journeys pipeline');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-segment'] });
        toast.success(`Journeys populated: ${result?.journeyEventsCreated || result?.events_created || 0} events for ${result?.uniqueDonors || result?.donors_processed || 0} donors`);
      }
    } catch (err) {
      console.error('Journeys pipeline error:', err);
      toast.error('Failed to run journeys pipeline');
    } finally {
      setIsRunningJourneys(false);
    }
  };

  const handleRunLtvPipeline = async () => {
    if (!organizationId) return;
    
    setIsRunningLtv(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('calculate-donor-ltv', {
        body: { 
          organization_id: organizationId
        }
      });
      
      if (error) {
        console.error('LTV pipeline error:', error);
        toast.error('Failed to run LTV pipeline');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-segment'] });
        toast.success(`LTV predictions: ${result?.predictions_created || result?.predictionsCreated || 0} donors analyzed`);
      }
    } catch (err) {
      console.error('LTV pipeline error:', err);
      toast.error('Failed to run LTV pipeline');
    } finally {
      setIsRunningLtv(false);
    }
  };

  const isPipelineRunning = isRefreshing || isRunningJourneys || isRunningLtv;

  if (orgLoading || !organizationId) {
    return (
      <ClientShell pageTitle="Donor Intelligence">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Donor Intelligence">
      <V3PageContainer
        icon={Brain}
        title="Donor Segmentation"
        description="Build custom donor segments, analyze behavior, and export for campaigns"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <V3Button
              variant="ghost"
              size="sm"
              onClick={handleRunJourneysPipeline}
              disabled={isPipelineRunning}
              title="Generate donor journey events from transactions"
            >
              <Play className={cn("h-4 w-4 mr-2", isRunningJourneys && "animate-pulse")} />
              {isRunningJourneys ? 'Running...' : 'Journeys'}
            </V3Button>
            <V3Button
              variant="ghost"
              size="sm"
              onClick={handleRunLtvPipeline}
              disabled={isPipelineRunning}
              title="Calculate lifetime value predictions"
            >
              <Zap className={cn("h-4 w-4 mr-2", isRunningLtv && "animate-pulse")} />
              {isRunningLtv ? 'Running...' : 'LTV'}
            </V3Button>
            <V3Button
              variant="outline"
              size="sm"
              onClick={() => handleSmartRefresh()}
              disabled={isPipelineRunning}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              {isRefreshing ? (syncingSources.length > 0 ? 'Syncing...' : 'Checking...') : 'Refresh'}
            </V3Button>
          </div>
        }
      >
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "builder" | "saved")} className="w-full">
          <TabsList className="bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))] p-1 mb-6">
            <TabsTrigger 
              value="builder"
              className={cn(
                "gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))]",
                "data-[state=active]:text-[hsl(var(--portal-text-primary))]"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Segment Builder
            </TabsTrigger>
            <TabsTrigger 
              value="saved"
              className={cn(
                "gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))]",
                "data-[state=active]:text-[hsl(var(--portal-text-primary))]"
              )}
            >
              <BookMarked className="h-4 w-4" />
              Saved Segments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-0">
            <DonorSegmentBuilder organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="saved" className="mt-0">
            <SavedSegmentsList 
              organizationId={organizationId} 
              onLoadSegment={(filters) => {
                // Switch to builder tab and load filters
                setActiveTab("builder");
                // The segment builder will need to accept initial filters
              }}
            />
          </TabsContent>
        </Tabs>
      </V3PageContainer>
    </ClientShell>
  );
}
