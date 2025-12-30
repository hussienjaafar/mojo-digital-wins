import { useState } from "react";
import { ClientShell } from "@/components/client/ClientShell";
import { DonorIntelligence } from "@/components/client/DonorIntelligence";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useDateRange } from "@/stores/dashboardStore";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientDonorIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { startDate, endDate } = useDateRange();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefreshData = async () => {
    if (!organizationId) return;
    
    setIsRefreshing(true);
    try {
      // Call refcode-reconcile to update attribution mappings
      const { error } = await supabase.functions.invoke('refcode-reconcile', {
        body: { organization_id: organizationId, limit: 500 }
      });
      
      if (error) {
        console.error('Refresh error:', error);
        toast.error('Failed to refresh attribution data');
      } else {
        // Invalidate queries to refetch fresh data
        await queryClient.invalidateQueries({ queryKey: ['donor-intelligence'] });
        toast.success('Intelligence data refreshed');
      }
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

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
      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Attribution, segments, RFM scoring, and donor lifecycle analysis
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {/* Main content */}
        <DonorIntelligence 
          organizationId={organizationId} 
          startDate={startDate} 
          endDate={endDate} 
        />
      </div>
    </ClientShell>
  );
}
