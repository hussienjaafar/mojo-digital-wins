import { ClientShell } from "@/components/client/ClientShell";
import { RecurringDonorHealth } from "@/components/client/RecurringDonorHealth";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { V3LoadingState } from "@/components/v3";
import { useDashboardStore } from "@/stores/dashboardStore";

const ClientRecurringHealth = () => {
  const { organizationId, isLoading } = useClientOrganization();
  const dateRange = useDashboardStore((s) => s.dateRange);

  if (isLoading) {
    return (
      <ClientShell pageTitle="Recurring Donor Health" showDateControls={true}>
        <div className="space-y-6">
          <V3LoadingState variant="kpi-grid" count={6} />
        </div>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Recurring Donor Health" showDateControls={true}>
      {organizationId && (
        <RecurringDonorHealth 
          organizationId={organizationId}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
        />
      )}
    </ClientShell>
  );
};

export default ClientRecurringHealth;
