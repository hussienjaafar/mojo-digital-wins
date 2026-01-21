import { useState } from "react";
import { format, subDays } from "date-fns";
import { MousePointerClick, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useCAPIStatus } from "@/hooks/useCAPIStatus";
import { useEnhancedRedirectClicksQuery } from "@/hooks/useEnhancedRedirectClicksQuery";
import { useCAPIEventsQuery } from "@/hooks/useCAPIEventsQuery";
import { V3LoadingState, V3PageContainer } from "@/components/v3";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { LinkTrackingKPIs } from "@/components/analytics/LinkTrackingKPIs";
import { LinkTrackingCharts } from "@/components/analytics/LinkTrackingCharts";
import { LinkTrackingTables } from "@/components/analytics/LinkTrackingTables";
import { CAPIHealthPanel } from "@/components/analytics/CAPIHealthPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ClientLinkTracking() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { data: capiStatus, isLoading: capiLoading } = useCAPIStatus(organizationId);
  
  // Date range state
  const [dateRange, setDateRange] = useState(() => ({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  }));

  // Data queries
  const {
    data: clicksData,
    isLoading: clicksLoading,
    isFetching: clicksFetching,
    refetch: refetchClicks,
  } = useEnhancedRedirectClicksQuery(organizationId ?? undefined, dateRange.start, dateRange.end);

  const {
    data: capiData,
    isLoading: capiEventsLoading,
    isFetching: capiEventsFetching,
    refetch: refetchCapi,
  } = useCAPIEventsQuery(organizationId ?? undefined, dateRange.start, dateRange.end);

  const handleDateChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  const handleRefresh = () => {
    refetchClicks();
    refetchCapi();
  };

  const isFetching = clicksFetching || capiEventsFetching;

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
  
  // CAPI configured - show full dashboard
  return (
    <ClientShell pageTitle="Link Tracking" showDateControls={false}>
      <div className="space-y-6 overflow-hidden">
        {/* Header with Date Selector */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 shrink-0">
              <MousePointerClick className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--portal-text-primary))] truncate">
                Campaign Link Performance
              </h1>
              <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-muted))] truncate">
                Track clicks, sessions, and conversions from your redirect URLs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeSelector
              startDate={dateRange.start}
              endDate={dateRange.end}
              onDateChange={handleDateChange}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isFetching}
              className="shrink-0"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <LinkTrackingKPIs
          summary={clicksData?.summary || {
            totalClicks: 0,
            uniqueSessions: 0,
            metaAdClicks: 0,
            cookieCaptureRate: 0,
            avgCaptureScore: 0,
            conversions: 0,
            attributedRevenue: 0,
            conversionRate: 0,
          }}
          trafficSource={clicksData?.byTrafficSource || { mobile: 0, desktop: 0, other: 0 }}
          isLoading={clicksLoading}
        />

        {/* Charts */}
        <LinkTrackingCharts
          dailyTrend={clicksData?.dailyTrend || []}
          hourlyTrend={clicksData?.hourlyTrend || []}
          isSingleDay={clicksData?.isSingleDay || false}
          isLoading={clicksLoading}
        />

        {/* Tables */}
        <LinkTrackingTables
          byRefcode={clicksData?.byRefcode || []}
          byCampaign={clicksData?.byCampaign || []}
          isLoading={clicksLoading}
        />

        {/* CAPI Panel - Full Width */}
        <CAPIHealthPanel
          data={capiData || {
            totalSent: 0,
            pending: 0,
            delivered: 0,
            failed: 0,
            matchQualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0 },
            recentEvents: [],
            avgMatchScore: 0,
          }}
          isLoading={capiEventsLoading}
        />
      </div>
    </ClientShell>
  );
}
