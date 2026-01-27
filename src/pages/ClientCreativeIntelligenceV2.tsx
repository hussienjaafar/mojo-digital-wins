import { useState, useEffect } from "react";
import { ClientShell } from "@/components/client/ClientShell";
import { ProductionGate } from "@/components/client/ProductionGate";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, FlaskConical } from "lucide-react";
import { V3LoadingState, V3Badge } from "@/components/v3";
import { CreativeIntelligenceDashboard } from "@/components/creative-intelligence";

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
  // Election settings - stored locally for now since columns don't exist yet
  const [electionDate] = useState<string | null>(null);
  const [electionName] = useState<string>("Election Day");

  // Handle election date changes (no-op until columns are added)
  const handleElectionDateChange = (date: string) => {
    console.log("Election date change requested:", date);
    // TODO: Save to database once election_date column is added to client_organizations
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
