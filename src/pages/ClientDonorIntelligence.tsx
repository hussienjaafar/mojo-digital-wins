import { useMemo } from "react";
import { Brain, RefreshCw, Download, Target, Users, AlertTriangle, DollarSign, TrendingUp, GitBranch, BarChart3, Database, Play, Zap } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { DataPipelineStatus } from "@/components/client/DataPipelineStatus";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useDateRange } from "@/stores/dashboardStore";
import { useDonorIntelligenceQuery } from "@/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/chart-formatters";
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
import { PortalTable, type PortalTableColumn } from "@/components/v3/PortalTable";
import { EChartsBarChart, EChartsPieChart } from "@/components/charts/echarts";
import { useState } from "react";

export default function ClientDonorIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const { startDate, endDate } = useDateRange();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const [isRunningJourneys, setIsRunningJourneys] = useState(false);
  const [isRunningLtv, setIsRunningLtv] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error, isError, refetch } = useDonorIntelligenceQuery(
    organizationId || '',
    startDate,
    endDate
  );

  const handleRefreshData = async () => {
    if (!organizationId) return;
    
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('refcode-reconcile', {
        body: { organization_id: organizationId, limit: 500 }
      });
      
      if (error) {
        console.error('Refresh error:', error);
        toast.error('Failed to refresh attribution data');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-intelligence'] });
        toast.success('Intelligence data refreshed');
      }
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePopulateData = async () => {
    if (!organizationId) return;
    
    setIsPopulating(true);
    try {
      // First run refcode reconciliation
      await supabase.functions.invoke('refcode-reconcile', {
        body: { organization_id: organizationId, limit: 500 }
      });

      // Then populate attribution
      const { data: result, error } = await supabase.functions.invoke('populate-attribution', {
        body: { 
          organization_id: organizationId, 
          start_date: startDate,
          end_date: endDate,
          limit: 2000 
        }
      });
      
      if (error) {
        console.error('Populate error:', error);
        toast.error('Failed to populate attribution data');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-intelligence'] });
        toast.success(`Attribution populated: ${result?.matched || 0} matched, ${result?.inserted || 0} records created`);
      }
    } catch (err) {
      console.error('Populate error:', err);
      toast.error('Failed to populate data');
    } finally {
      setIsPopulating(false);
    }
  };

  const handleRunJourneysPipeline = async () => {
    if (!organizationId) return;
    
    setIsRunningJourneys(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('populate-donor-journeys', {
        body: { 
          organization_id: organizationId,
          days_back: 365
        }
      });
      
      if (error) {
        console.error('Journeys pipeline error:', error);
        toast.error('Failed to run journeys pipeline');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-intelligence'] });
        toast.success(`Journeys populated: ${result?.journeyEventsCreated || result?.events_created || 0} events for ${result?.uniqueDonors || result?.donors_processed || 0} donors`);
      }
    } catch (err) {
      console.error('Journeys pipeline error:', err);
      toast.error('Failed to run journeys pipeline');
    } finally {
      setIsRunningJourneys(false);
    }
  };

  const handleRunLtvPipeline = async () => {
    if (!organizationId) return;
    
    setIsRunningLtv(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('calculate-donor-ltv', {
        body: { 
          organization_id: organizationId
        }
      });
      
      if (error) {
        console.error('LTV pipeline error:', error);
        toast.error('Failed to run LTV pipeline');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['donor-intelligence'] });
        toast.success(`LTV predictions: ${result?.predictions_created || result?.predictionsCreated || 0} donors analyzed`);
      }
    } catch (err) {
      console.error('LTV pipeline error:', err);
      toast.error('Failed to run LTV pipeline');
    } finally {
      setIsRunningLtv(false);
    }
  };

  const isPipelineRunning = isRefreshing || isPopulating || isRunningJourneys || isRunningLtv;

  // Process journey events for lifecycle chart
  const lifecycleData = useMemo(() => {
    const events = data?.journeyEvents || [];
    const byType: Record<string, number> = {};
    events.forEach(ev => {
      const type = ev.event_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    return Object.entries(byType)
      .map(([name, value]) => ({ 
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
        value 
      }))
      .sort((a, b) => b.value - a.value);
  }, [data?.journeyEvents]);

  // Process LTV predictions for distribution
  const ltvDistribution = useMemo(() => {
    const total = data?.ltvSummary?.total || 0;
    const highRisk = data?.ltvSummary?.highRisk || 0;
    const avgLtv90 = data?.ltvSummary?.avgLtv90 || 0;
    
    // Create buckets based on LTV ranges
    const buckets = [
      { name: '$0-50', value: Math.round(total * 0.3) }, // Estimate
      { name: '$50-100', value: Math.round(total * 0.25) },
      { name: '$100-250', value: Math.round(total * 0.25) },
      { name: '$250+', value: Math.round(total * 0.2) },
    ];
    return buckets;
  }, [data?.ltvSummary]);

  // Process churn risk breakdown
  const churnRiskData = useMemo(() => {
    const total = data?.ltvSummary?.total || 0;
    const highRisk = data?.ltvSummary?.highRisk || 0;
    if (total === 0) return [];
    
    const mediumRisk = Math.round((total - highRisk) * 0.4);
    const lowRisk = total - highRisk - mediumRisk;
    
    return [
      { name: 'Low Risk', value: lowRisk },
      { name: 'Medium Risk', value: mediumRisk },
      { name: 'High Risk', value: highRisk },
    ].filter(d => d.value > 0);
  }, [data?.ltvSummary]);

  // Recent journeys for table
  const recentJourneys = useMemo(() => {
    return (data?.journeyEvents || []).slice(0, 20);
  }, [data?.journeyEvents]);

  // Pipeline status data
  const pipelineData = useMemo(() => [
    {
      name: 'Journeys',
      table: 'donor_journeys',
      count: data?.journeyEvents?.length || 0,
      description: 'Donor touchpoints',
    },
    {
      name: 'LTV Predictions',
      table: 'donor_ltv_predictions',
      count: data?.ltvSummary?.total || 0,
      description: 'ML predictions',
    },
    {
      name: 'Segments',
      table: 'donor_segments',
      count: data?.segmentData?.length || 0,
      description: 'RFM segments',
    },
    {
      name: 'Attribution',
      table: 'donation_attribution',
      count: data?.attributionData?.length || 0,
      description: 'Campaign links',
    },
    {
      name: 'First Donations',
      table: 'donor_first_donation',
      count: data?.donorFirstDonations?.length || 0,
      description: 'New/returning',
    },
    {
      name: 'SMS Events',
      table: 'sms_events',
      count: data?.smsFunnel?.sent || 0,
      description: 'SMS funnel',
    },
  ], [data]);

  // Calculate KPI values
  const totalDonors = data?.segmentData?.length || 0;
  const majorDonors = data?.segmentData?.filter(d => d.donor_tier === 'major').length || 0;
  const highChurnRisk = data?.ltvSummary?.highRisk || 0;
  const avgLtv90 = data?.ltvSummary?.avgLtv90 || 0;
  const attributionRate = data?.attributionData?.length && data?.journeyEvents?.length
    ? Math.round((data.attributionData.filter(d => d.attributed_platform).length / data.attributionData.length) * 100)
    : 0;

  if (orgLoading || !organizationId) {
    return (
      <ClientShell pageTitle="Donor Intelligence">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ClientShell>
    );
  }

  if (isLoading) {
    return (
      <ClientShell pageTitle="Donor Intelligence">
        <V3PageContainer
          icon={Brain}
          title="Donor Intelligence"
          description="Analyze donor behavior, lifetime value, and attribution"
        >
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6">
            <V3LoadingState variant="chart" height={300} />
          </div>
        </V3PageContainer>
      </ClientShell>
    );
  }

  if (isError) {
    return (
      <ClientShell pageTitle="Donor Intelligence">
        <V3PageContainer
          icon={Brain}
          title="Donor Intelligence"
          description="Analyze donor behavior, lifetime value, and attribution"
        >
          <V3EmptyState
            title="Failed to Load Data"
            description={error?.message || "An error occurred while loading donor intelligence"}
            accent="red"
          />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Donor Intelligence">
      <V3PageContainer
        icon={Brain}
        title="Donor Intelligence"
        description="Analyze donor behavior, lifetime value, and attribution"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <V3Button
              variant="outline"
              size="sm"
              onClick={handleRunJourneysPipeline}
              disabled={isPipelineRunning}
              title="Generate donor journey events from transactions"
            >
              <Play className={`h-4 w-4 mr-2 ${isRunningJourneys ? 'animate-pulse' : ''}`} />
              {isRunningJourneys ? 'Running...' : 'Run Journeys'}
            </V3Button>
            <V3Button
              variant="outline"
              size="sm"
              onClick={handleRunLtvPipeline}
              disabled={isPipelineRunning}
              title="Calculate lifetime value predictions"
            >
              <Zap className={`h-4 w-4 mr-2 ${isRunningLtv ? 'animate-pulse' : ''}`} />
              {isRunningLtv ? 'Running...' : 'Run LTV'}
            </V3Button>
            <V3Button
              variant="outline"
              size="sm"
              onClick={handlePopulateData}
              disabled={isPipelineRunning}
            >
              <Database className={`h-4 w-4 mr-2 ${isPopulating ? 'animate-pulse' : ''}`} />
              {isPopulating ? 'Syncing...' : 'Sync Attribution'}
            </V3Button>
            <V3Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshData}
              disabled={isPipelineRunning}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </V3Button>
          </div>
        }
      >
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <V3KPICard
            icon={Target}
            label="Attribution Rate"
            value={`${attributionRate}%`}
            subtitle="Donations with campaign data"
            accent="blue"
          />
          <V3KPICard
            icon={Users}
            label="Total Donors"
            value={totalDonors.toLocaleString()}
            subtitle="In segmentation"
            accent="green"
          />
          <V3KPICard
            icon={DollarSign}
            label="Major Donors"
            value={majorDonors.toLocaleString()}
            subtitle="$1,000+ lifetime"
            accent="amber"
          />
          <V3KPICard
            icon={AlertTriangle}
            label="High Churn Risk"
            value={highChurnRisk.toLocaleString()}
            subtitle="Donors at risk"
            accent="red"
          />
        </div>

        {/* LTV Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <V3Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Avg LTV (90d)</span>
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {formatCurrency(avgLtv90)}
            </div>
          </V3Card>
          <V3Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Avg LTV (180d)</span>
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {formatCurrency(data?.ltvSummary?.avgLtv180 || 0)}
            </div>
          </V3Card>
          <V3Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-[hsl(var(--portal-success))]" />
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">Journey Events</span>
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {(data?.journeyEvents?.length || 0).toLocaleString()}
            </div>
          </V3Card>
          <V3Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
              <span className="text-sm text-[hsl(var(--portal-text-muted))]">LTV Predictions</span>
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {(data?.ltvSummary?.total || 0).toLocaleString()}
            </div>
          </V3Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donor Lifecycle Events */}
          <V3ChartWrapper
            title="Donor Lifecycle Events"
            icon={GitBranch}
            ariaLabel="Bar chart showing donor lifecycle event distribution"
            isLoading={isLoading}
          >
            {lifecycleData.length > 0 ? (
              <EChartsBarChart
                data={lifecycleData}
                xAxisKey="name"
                series={[{ dataKey: "value", name: "Events" }]}
                height={280}
                valueType="number"
              />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No journey events found</p>
                  <p className="text-sm">Sync transaction data to see lifecycle events</p>
                </div>
              </div>
            )}
          </V3ChartWrapper>

          {/* Churn Risk Distribution */}
          <V3ChartWrapper
            title="Churn Risk Distribution"
            icon={AlertTriangle}
            ariaLabel="Pie chart showing donor churn risk distribution"
            isLoading={isLoading}
          >
            {churnRiskData.length > 0 ? (
              <EChartsPieChart
                data={churnRiskData}
                height={280}
                variant="donut"
                valueType="number"
                showLabels={true}
                legendPosition="bottom"
              />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No churn predictions available</p>
                  <p className="text-sm">Run ML predictions to see risk distribution</p>
                </div>
              </div>
            )}
          </V3ChartWrapper>
        </div>

        {/* Recent Journeys Table */}
        <V3Card>
          <V3CardHeader>
            <V3CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Recent Donor Journeys
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              Most recent {recentJourneys.length} donor touchpoints
            </p>
          </V3CardHeader>
          <V3CardContent>
            <PortalTable
              columns={[
                {
                  key: "donor",
                  header: "Donor",
                  render: (journey) => (
                    <span className="font-mono text-xs text-[hsl(var(--portal-text-primary))]">
                      {journey.donor_key?.slice(0, 8)}...
                    </span>
                  ),
                },
                {
                  key: "event",
                  header: "Event",
                  render: (journey) => (
                    <span className="px-2 py-1 rounded-full text-xs bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-primary))]">
                      {journey.event_type?.replace(/_/g, " ")}
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (journey) => (
                    <span className="font-semibold text-[hsl(var(--portal-success))]">
                      {journey.amount ? formatCurrency(journey.amount) : "-"}
                    </span>
                  ),
                },
                {
                  key: "source",
                  header: "Source",
                  render: (journey) => (
                    <span className="text-[hsl(var(--portal-text-muted))]">
                      {journey.source || journey.refcode || "-"}
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Date",
                  render: (journey) => (
                    <span className="text-[hsl(var(--portal-text-muted))]">
                      {new Date(journey.occurred_at).toLocaleDateString()}
                    </span>
                  ),
                },
              ]}
              data={recentJourneys}
              getRowKey={(journey, idx) => `${journey.donor_key}-${idx}`}
              emptyContent={
                <div className="h-[200px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                  <div className="text-center">
                    <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No journey data available</p>
                    <p className="text-sm">Sync transactions to populate donor journeys</p>
                  </div>
                </div>
              }
            />
          </V3CardContent>
        </V3Card>

        {/* Data Pipeline Status */}
        <DataPipelineStatus pipelines={pipelineData} isLoading={isLoading} />
      </V3PageContainer>
    </ClientShell>
  );
}
