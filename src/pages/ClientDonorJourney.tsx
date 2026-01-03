import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Trophy,
  Heart,
} from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { toast } from "sonner";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useRefcodePerformance } from "@/hooks/useRefcodePerformance";
import {
  V3PageContainer,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3EmptyState,
  V3Button,
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardContent,
} from "@/components/v3";
import { RefcodePerformanceTable } from "@/components/analytics/RefcodePerformanceTable";
import { RevenueByChannelChart } from "@/components/analytics/RevenueByChannelChart";
import { RetentionMetricsCard } from "@/components/analytics/RetentionMetricsCard";
import { TopRefcodesByLTVCard } from "@/components/analytics/TopRefcodesByLTVCard";

// ============================================================================
// Main Page Component
// ============================================================================

const ClientDonorJourney = () => {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Query refcode performance data
  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useRefcodePerformance(organizationId);

  // Derived stats
  const stats = useMemo(() => {
    if (!data) return null;
    
    const totalRevenue = data.refcodes.reduce((sum, r) => sum + r.totalRevenue, 0);
    const totalDonations = data.refcodes.reduce((sum, r) => sum + r.donationCount, 0);
    const avgGift = totalDonations > 0 ? totalRevenue / totalDonations : 0;
    
    return {
      totalRevenue,
      totalDonations,
      avgGift,
      totalDonors: data.retention.totalDonors,
      repeatRate: data.retention.repeatRate,
      recurringRate: data.retention.recurringRate,
    };
  }, [data]);

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    }
  };

  // Loading state
  if (orgLoading || !organizationId) {
    return (
      <ClientShell pageTitle="Attribution & Retention">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ClientShell>
    );
  }

  if (isLoading) {
    return (
      <ClientShell pageTitle="Attribution & Retention">
        <V3PageContainer
          icon={BarChart3}
          title="Attribution & Retention Analytics"
          description="Refcode performance and donor retention insights"
        >
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6">
            <V3LoadingState variant="chart" height={300} />
          </div>
        </V3PageContainer>
      </ClientShell>
    );
  }

  if (error) {
    return (
      <ClientShell pageTitle="Attribution & Retention">
        <V3PageContainer
          icon={BarChart3}
          title="Attribution & Retention Analytics"
          description="Refcode performance and donor retention insights"
        >
          <V3EmptyState
            title="Failed to Load Data"
            description={error?.message || "An error occurred while loading data"}
            accent="red"
          />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Attribution & Retention">
      <V3PageContainer
        icon={BarChart3}
        title="Attribution & Retention Analytics"
        description="See which campaigns drive donations and which donors stick around"
        actions={
          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </V3Button>
        }
      >
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <V3KPICard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${(stats?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subtitle="All attributed donations"
            accent="green"
          />
          <V3KPICard
            icon={Users}
            label="Unique Donors"
            value={(stats?.totalDonors || 0).toLocaleString()}
            subtitle="Across all refcodes"
            accent="blue"
          />
          <V3KPICard
            icon={TrendingUp}
            label="Repeat Rate"
            value={`${(stats?.repeatRate || 0).toFixed(0)}%`}
            subtitle="Donors who gave again"
            accent={(stats?.repeatRate || 0) >= 20 ? "green" : "amber"}
          />
          <V3KPICard
            icon={Heart}
            label="Recurring Rate"
            value={`${(stats?.recurringRate || 0).toFixed(0)}%`}
            subtitle="Monthly/sustaining donors"
            accent={(stats?.recurringRate || 0) >= 15 ? "green" : "purple"}
          />
        </div>

        {/* Retention Metrics */}
        <V3Card>
          <V3CardHeader>
            <V3CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Donor Retention Overview
            </V3CardTitle>
          </V3CardHeader>
          <V3CardContent>
            {data && (
              <RetentionMetricsCard data={data.retention} isLoading={isLoading} />
            )}
          </V3CardContent>
        </V3Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Channel */}
          <V3ChartWrapper
            title="Revenue by Channel"
            description="Total revenue grouped by acquisition channel"
            icon={BarChart3}
            isLoading={isLoading}
            ariaLabel="Bar chart showing revenue by channel"
          >
            {data && (
              <RevenueByChannelChart data={data.channels} isLoading={isLoading} />
            )}
          </V3ChartWrapper>

          {/* Top Refcodes by LTV */}
          <V3ChartWrapper
            title="Top Sources by Recurring Rate"
            description="Which refcodes produce donors that keep giving"
            icon={Trophy}
            isLoading={isLoading}
            ariaLabel="List of top refcodes by lifetime value"
          >
            {data && (
              <TopRefcodesByLTVCard data={data.topRefcodesByLTV} isLoading={isLoading} />
            )}
          </V3ChartWrapper>
        </div>

        {/* Refcode Performance Table */}
        <V3Card>
          <V3CardHeader>
            <V3CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Refcode Performance
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              {data?.refcodes.length || 0} refcodes tracked • Sortable by any column
            </p>
          </V3CardHeader>
          <V3CardContent>
            {data && (
              <RefcodePerformanceTable data={data.refcodes} isLoading={isLoading} />
            )}
          </V3CardContent>
        </V3Card>

        {/* Data Freshness */}
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
            Data updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </p>
        )}
      </V3PageContainer>
    </ClientShell>
  );
};

export default ClientDonorJourney;
