import { ClientShell } from "@/components/client/ClientShell";
import { ProductionGate } from "@/components/client/ProductionGate";
import { ABTestAnalytics } from "@/components/client/ABTestAnalytics";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { V3LoadingState } from "@/components/v3";
import { BarChart3 } from "lucide-react";

const ClientABTests = () => {
  const { organizationId, isLoading } = useClientOrganization();

  if (isLoading) {
    return (
      <ClientShell pageTitle="A/B Test Analytics" showDateControls={false}>
        <div className="space-y-6">
          <V3LoadingState variant="kpi-grid" count={3} />
        </div>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="A/B Test Analytics" showDateControls={false}>
      <ProductionGate
        title="A/B Test Analytics"
        description="Comprehensive A/B testing analytics to optimize your campaigns and maximize conversion rates."
        icon={BarChart3}
      >
        {organizationId && <ABTestAnalytics organizationId={organizationId} />}
      </ProductionGate>
    </ClientShell>
  );
};

export default ClientABTests;
