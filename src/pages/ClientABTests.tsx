import { ClientShell } from "@/components/client/ClientShell";
import { ABTestAnalytics } from "@/components/client/ABTestAnalytics";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { V3LoadingState } from "@/components/v3";

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
      {organizationId && <ABTestAnalytics organizationId={organizationId} />}
    </ClientShell>
  );
};

export default ClientABTests;
