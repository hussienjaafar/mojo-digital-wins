import { ClientLayout } from "@/components/client/ClientLayout";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { IntelligenceHubRedesigned } from "@/components/client/IntelligenceHubRedesigned";
import { Activity } from "lucide-react";

export default function ClientIntelligence() {
  const { organizationId, isLoading } = useClientOrganization();

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Intelligence Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time alerts, trending topics, and strategic insights
          </p>
        </div>
        
        {organizationId ? (
          <IntelligenceHubRedesigned organizationId={organizationId} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Unable to load organization data</p>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
