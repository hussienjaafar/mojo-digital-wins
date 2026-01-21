import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useCAPIStatus } from "@/hooks/useCAPIStatus";
import { RedirectLinkAnalytics } from "@/components/analytics/RedirectLinkAnalytics";
import { V3LoadingState, V3PageContainer } from "@/components/v3";
import { MousePointerClick, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientLinkTracking() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { data: capiStatus, isLoading: capiLoading } = useCAPIStatus(organizationId);
  
  if (orgLoading || capiLoading) {
    return (
      <ClientShell pageTitle="Link Tracking" showDateControls={false}>
        <V3LoadingState variant="card" />
      </ClientShell>
    );
  }
  
  // CAPI not configured - show integration CTA
  if (!capiStatus?.isConfigured || !capiStatus?.isEnabled) {
    return (
      <ClientShell pageTitle="Link Tracking" showDateControls={false}>
        <V3PageContainer
          icon={MousePointerClick}
          title="Link Tracking"
          description="Track clicks and sessions from your campaign URLs"
        >
          <Card className="max-w-2xl mx-auto mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                Meta CAPI Integration Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Link tracking requires Meta Conversions API (CAPI) integration to be 
                configured for your organization. This allows us to capture click data 
                from your Meta ad campaigns.
              </p>
              <p className="text-muted-foreground">
                Please contact your account manager to enable CAPI integration.
              </p>
              <Button variant="outline" className="gap-2" asChild>
                <a href="mailto:support@mojodigitalwins.com">
                  <ExternalLink className="h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </CardContent>
          </Card>
        </V3PageContainer>
      </ClientShell>
    );
  }
  
  // CAPI configured - show analytics
  return (
    <ClientShell pageTitle="Link Tracking" showDateControls={false}>
      <V3PageContainer
        icon={MousePointerClick}
        title="Link Tracking"
        description="Track clicks and sessions from your campaign redirect URLs"
      >
        <RedirectLinkAnalytics
          organizationId={organizationId ?? undefined}
          title="Campaign Link Performance"
        />
      </V3PageContainer>
    </ClientShell>
  );
}
