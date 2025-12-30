import { useState } from "react";
import { ClientLayout } from "@/components/client/ClientLayout";
import { RecurringDonorHealth } from "@/components/client/RecurringDonorHealth";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { Skeleton } from "@/components/ui/skeleton";
import { V3DateRangePicker } from "@/components/v3/V3DateRangePicker";
import { subDays, format } from "date-fns";

const ClientRecurringHealth = () => {
  const { organizationId, isLoading } = useClientOrganization();
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 90),
    end: new Date(),
  });

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Recurring Donor Health</h1>
            <p className="text-muted-foreground mt-1">
              Monitor MRR, churn rates, and recurring donation performance
            </p>
          </div>
          <V3DateRangePicker />
        </div>
        
        {organizationId && (
          <RecurringDonorHealth 
            organizationId={organizationId}
            startDate={format(dateRange.start, 'yyyy-MM-dd')}
            endDate={format(dateRange.end, 'yyyy-MM-dd')}
          />
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientRecurringHealth;
