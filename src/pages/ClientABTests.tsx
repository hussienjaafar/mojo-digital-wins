import { ClientLayout } from "@/components/client/ClientLayout";
import { ABTestAnalytics } from "@/components/client/ABTestAnalytics";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { Skeleton } from "@/components/ui/skeleton";

const ClientABTests = () => {
  const { organizationId, isLoading } = useClientOrganization();

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
        <div>
          <h1 className="text-3xl font-bold">A/B Test Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Compare performance across ActBlue A/B test variations
          </p>
        </div>
        
        {organizationId && <ABTestAnalytics organizationId={organizationId} />}
      </div>
    </ClientLayout>
  );
};

export default ClientABTests;
