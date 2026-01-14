import { ClientShell } from "@/components/client/ClientShell";
import { RecurringDonorHealth } from "@/components/client/RecurringDonorHealth";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { V3LoadingState } from "@/components/v3";
import { V3PageContainer } from "@/components/v3/V3PageContainer";
import { useDashboardStore } from "@/stores/dashboardStore";
import { RefreshCw } from "lucide-react";

const ClientRecurringHealth = () => {
  const { organizationId, isLoading } = useClientOrganization();
  const dateRange = useDashboardStore((s) => s.dateRange);

  if (isLoading) {
    return (
      <ClientShell pageTitle="Recurring Donor Health" showDateControls={true}>
        <V3PageContainer
          icon={RefreshCw}
          title="Recurring Donor Health"
          description="Monitor MRR, churn rates, and recurring donation performance"
        >
          <V3LoadingState variant="kpi-grid" count={6} />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Recurring Donor Health" showDateControls={true}>
      <V3PageContainer
        icon={RefreshCw}
        title="Recurring Donor Health"
        description="Monitor MRR, churn rates, and recurring donation performance"
      >
        {organizationId && (
          <RecurringDonorHealth 
            organizationId={organizationId}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
          />
        )}
      </V3PageContainer>
    </ClientShell>
  );
};

export default ClientRecurringHealth;
