import { ClientLayout } from "@/components/client/ClientLayout";
import { RecurringDonorHealth } from "@/components/client/RecurringDonorHealth";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeControl } from "@/components/ui/DateRangeControl";
import { useDashboardStore } from "@/stores/dashboardStore";

const ClientRecurringHealth = () => {
  const { organizationId, isLoading } = useClientOrganization();
  const dateRange = useDashboardStore((s) => s.dateRange);

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">Recurring Donor Health</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Monitor MRR, churn rates, and recurring donation performance
            </p>
          </div>
          <div className="shrink-0">
            <DateRangeControl pillPresets={["30d", "90d", "mtd"]} size="sm" />
          </div>
        </div>
        
        {organizationId && (
          <RecurringDonorHealth 
            organizationId={organizationId}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
          />
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientRecurringHealth;
