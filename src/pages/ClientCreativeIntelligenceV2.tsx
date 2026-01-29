import { useState, useEffect } from "react";
import { ClientShell } from "@/components/client/ClientShell";
import { ProductionGate } from "@/components/client/ProductionGate";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, FlaskConical } from "lucide-react";
import { V3LoadingState, V3Badge } from "@/components/v3";
import { CreativeIntelligenceDashboard } from "@/components/creative-intelligence";
import { toast } from "sonner";

/**
 * Creative Intelligence V2 - Test Page
 *
 * This is the new Creative Intelligence dashboard with:
 * - FDR-corrected statistical significance
 * - Effect size and statistical power calculations
 * - Correlation significance testing
 * - Political campaign features (donor segmentation, compliance, election countdown)
 * - Improved accessibility (WCAG 2.1 AA compliant)
 * - CSV export functionality
 *
 * Once approved, this will replace the existing ClientCreativeIntelligence page.
 */
const ClientCreativeIntelligenceV2 = () => {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Election settings - now fetched from database
  const [electionDate, setElectionDate] = useState<string | null>(null);
  const [electionName, setElectionName] = useState<string>("Election Day");

  // Fetch election settings from database when organizationId is available
  useEffect(() => {
    const fetchElectionSettings = async () => {
      if (!organizationId) return;

      try {
        const { data, error } = await supabase
          .from("client_organizations")
          .select("election_date, election_name")
          .eq("id", organizationId)
          .single();

        if (error) throw error;

        if (data) {
          setElectionDate(data.election_date);
          setElectionName(data.election_name || "Election Day");
        }
      } catch (error) {
        console.error("Error fetching election settings:", error);
        // Don't show error toast on initial load - columns may not exist yet
      }
    };

    fetchElectionSettings();
  }, [organizationId]);

  // Save election date changes to database
  const handleElectionDateChange = async (date: string) => {
    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("client_organizations")
        .update({
          election_date: date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (error) throw error;

      setElectionDate(date);
      toast.success("Election date updated");
    } catch (error) {
      console.error("Error updating election date:", error);
      toast.error("Failed to update election date");
    }
  };

  if (orgLoading) {
    return (
      <ClientShell pageTitle="Creative Intelligence V2" showDateControls={false}>
        <div className="space-y-6">
          <V3LoadingState variant="kpi-grid" count={4} />
          <V3LoadingState variant="table" />
        </div>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Creative Intelligence V2" showDateControls={false}>
      <ProductionGate
        title="Creative Intelligence V2"
        description="Advanced creative analysis with statistical significance testing, effect sizes, and political campaign features"
        icon={Sparkles}
      >
        {/* Test badge indicator */}
        <div className="mb-4 flex items-center gap-2">
          <V3Badge variant="warning" className="flex items-center gap-1">
            <FlaskConical className="h-3 w-3" />
            Test Version
          </V3Badge>
          <span className="text-sm text-muted-foreground">
            This is the new Creative Intelligence dashboard. Review and approve to replace the existing page.
          </span>
        </div>

        {organizationId && (
          <CreativeIntelligenceDashboard
            organizationId={organizationId}
            electionDate={electionDate}
            electionName={electionName}
            onElectionDateChange={handleElectionDateChange}
            canEditCampaignSettings={true}
          />
        )}
      </ProductionGate>
    </ClientShell>
  );
};

export default ClientCreativeIntelligenceV2;
