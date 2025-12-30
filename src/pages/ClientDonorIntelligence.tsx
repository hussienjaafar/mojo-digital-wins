import { ClientShell } from "@/components/client/ClientShell";
import { DonorIntelligence } from "@/components/client/DonorIntelligence";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useDateRange } from "@/stores/dashboardStore";

export default function ClientDonorIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { startDate, endDate } = useDateRange();

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
      <DonorIntelligence 
        organizationId={organizationId} 
        startDate={startDate} 
        endDate={endDate} 
      />
    </ClientShell>
  );
}
