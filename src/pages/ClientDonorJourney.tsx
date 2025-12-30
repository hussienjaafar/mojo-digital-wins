import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  RefreshCw,
  Filter,
  ArrowRight,
  MessageSquare,
  Mail,
  MousePointerClick,
  Clock,
  Layers,
  Heart,
  Play,
  Database,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { DataPipelineStatus } from "@/components/client/DataPipelineStatus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDonorJourneyQuery,
  useRefreshJourneyData,
  type DonorJourneyRecord,
  type FunnelStage,
} from "@/queries/useDonorJourneyQuery";

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
  V3FilterPill,
} from "@/components/v3";
import { EChartsFunnelChart, EChartsBarChart } from "@/components/charts/echarts";

// ============================================================================
// Touchpoint Icon Helper
// ============================================================================

const getTouchpointIcon = (type: string): LucideIcon => {
  switch (type) {
    case "meta_ad_click":
    case "ad_click":
      return MousePointerClick;
    case "sms_send":
    case "sms_click":
      return MessageSquare;
    case "email_open":
    case "email_click":
      return Mail;
    default:
      return Target;
  }
};

const getTouchpointColor = (type: string): string => {
  switch (type) {
    case "meta_ad_click":
    case "ad_click":
      return "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.2)]";
    case "sms_send":
    case "sms_click":
      return "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]";
    case "email_open":
    case "email_click":
      return "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]";
    default:
      return "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]";
  }
};

// ============================================================================
// Funnel Stage Colors
// ============================================================================

const FUNNEL_STAGE_COLORS: Record<string, string> = {
  awareness: "hsl(var(--portal-accent-blue))",
  engagement: "hsl(var(--portal-accent-purple))",
  conversion: "hsl(var(--portal-success))",
  retention: "hsl(var(--portal-warning))",
  advocacy: "hsl(var(--portal-error))",
};

// ============================================================================
// Journey Detail Dialog
// ============================================================================

interface JourneyDetailDialogProps {
  journey: DonorJourneyRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JourneyDetailDialog = ({ journey, open, onOpenChange }: JourneyDetailDialogProps) => {
  if (!journey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))]">
            Donor Journey
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
            {journey.donor_email} - {format(new Date(journey.transaction_date), "MMM d, yyyy h:mm a")}
          </DialogDescription>
        </DialogHeader>

        {/* Donation Summary */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.2)]">
          <div>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">Total Donation</p>
            <p className="text-2xl font-bold text-[hsl(var(--portal-success))]">
              ${journey.amount.toFixed(2)}
            </p>
          </div>
          <Badge className="bg-[hsl(var(--portal-success))] text-white">
            {journey.touchpoints.length} Touchpoints
          </Badge>
        </div>

        {/* Attribution Model */}
        <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">
            Attribution Model (40/20/40)
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">40%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">First Touch</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${journey.attribution_weights.first_touch.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-success))]">20%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Middle Touches</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${(journey.attribution_weights.middle_touch * Math.max(0, journey.touchpoints.length - 2)).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-accent-purple))]">40%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Last Touch</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${journey.attribution_weights.last_touch.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="relative">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-4">
            Journey Timeline
          </h4>
          <div className="absolute left-6 top-10 bottom-4 w-0.5 bg-[hsl(var(--portal-border))]" />
          <div className="space-y-4">
            {journey.touchpoints.map((touchpoint, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === journey.touchpoints.length - 1;
              const Icon = getTouchpointIcon(touchpoint.touchpoint_type);
              const weight = isFirst
                ? journey.attribution_weights.first_touch
                : isLast
                ? journey.attribution_weights.last_touch
                : journey.attribution_weights.middle_touch;

              return (
                <div key={touchpoint.id} className="relative flex items-start gap-4">
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--portal-bg-elevated))] border-2 border-[hsl(var(--portal-accent-blue))]">
                    <Icon className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getTouchpointColor(touchpoint.touchpoint_type)}>
                        {touchpoint.touchpoint_type.replace(/_/g, " ")}
                      </Badge>
                      {isFirst && (
                        <Badge className="bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border border-[hsl(var(--portal-accent-blue)/0.2)]">
                          First Touch (40%)
                        </Badge>
                      )}
                      {isLast && (
                        <Badge className="bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border border-[hsl(var(--portal-accent-purple)/0.2)]">
                          Last Touch (40%)
                        </Badge>
                      )}
                      {!isFirst && !isLast && (
                        <Badge variant="secondary">Middle (20%)</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                      {format(new Date(touchpoint.occurred_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {(touchpoint.utm_source || touchpoint.utm_campaign) && (
                      <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5">
                        {touchpoint.utm_source && `Source: ${touchpoint.utm_source}`}
                        {touchpoint.utm_campaign && ` • Campaign: ${touchpoint.utm_campaign}`}
                      </p>
                    )}
                    <p className="text-sm font-medium text-[hsl(var(--portal-accent-blue))] mt-1">
                      Attribution: ${weight.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Final Conversion */}
            <div className="relative flex items-start gap-4">
              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--portal-success))]">
                <DollarSign className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 pt-1">
                <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                  Donation
                </Badge>
                <p className="text-lg font-bold text-[hsl(var(--portal-success))] mt-1">
                  ${journey.amount.toFixed(2)}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {format(new Date(journey.transaction_date), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

const ClientDonorJourney = () => {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const queryClient = useQueryClient();

  // State
  const [minAmount, setMinAmount] = useState(0);
  const [selectedJourney, setSelectedJourney] = useState<DonorJourneyRecord | null>(null);
  const [isRunningJourneys, setIsRunningJourneys] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query
  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useDonorJourneyQuery(organizationId, minAmount);

  const refreshMutation = useRefreshJourneyData(organizationId);

  // Derived data
  const stats = data?.stats;
  const journeys = data?.journeys || [];
  const segments = data?.segments || [];
  const funnel = data?.funnel || [];
  const touchpointSummary = data?.touchpointSummary || [];

  // Pipeline status data
  const pipelineData = useMemo(() => [
    {
      name: 'Journeys',
      table: 'donor_journeys',
      count: (data?.meta?.journeyEvents as any)?.actualCount || 0,
      description: 'Journey events',
    },
    {
      name: 'Touchpoints',
      table: 'attribution_touchpoints',
      count: (data?.meta?.touchpoints as any)?.actualCount || 0,
      description: 'Attribution data',
    },
    {
      name: 'Transactions',
      table: 'actblue_transactions',
      count: (data?.meta?.transactions as any)?.actualCount || 0,
      description: 'Donation records',
    },
    {
      name: 'Segments',
      table: 'donor_demographics',
      count: segments.reduce((sum, s) => sum + s.count, 0),
      description: 'Donor tiers',
    },
  ], [data, segments]);

  // Touchpoint distribution for chart
  const touchpointChartData = useMemo(() => {
    return touchpointSummary
      .map(tp => ({
        name: tp.touchpoint_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: tp.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [touchpointSummary]);

  // Handlers
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
        await queryClient.invalidateQueries({ queryKey: ['donorJourney'] });
        toast.success(`Journeys populated: ${result?.events_created || 0} events for ${result?.unique_donors || 0} donors`);
      }
    } catch (err) {
      console.error('Journeys pipeline error:', err);
      toast.error('Failed to run journeys pipeline');
    } finally {
      setIsRunningJourneys(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
      toast.success('Journey data refreshed');
    } catch {
      toast.error('Unable to refresh journey data');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMutation]);

  const isPipelineRunning = isRunningJourneys || isRefreshing;

  // Amount filter options
  const amountFilters = [
    { label: "All", value: 0 },
    { label: "$25+", value: 25 },
    { label: "$50+", value: 50 },
    { label: "$100+", value: 100 },
    { label: "$250+", value: 250 },
  ];

  if (orgLoading || !organizationId) {
    return (
      <ClientShell pageTitle="Donor Journey">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ClientShell>
    );
  }

  if (isLoading) {
    return (
      <ClientShell pageTitle="Donor Journey">
        <V3PageContainer
          icon={GitBranch}
          title="Donor Journey"
          description="Multi-touch attribution and conversion funnel analytics"
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
      <ClientShell pageTitle="Donor Journey">
        <V3PageContainer
          icon={GitBranch}
          title="Donor Journey"
          description="Multi-touch attribution and conversion funnel analytics"
        >
          <V3EmptyState
            title="Failed to Load Data"
            description={error?.message || "An error occurred while loading journey data"}
            accent="red"
          />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Donor Journey">
      <V3PageContainer
        icon={GitBranch}
        title="Donor Journey"
        description="Multi-touch attribution and conversion funnel analytics"
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
              {isRunningJourneys ? 'Running...' : 'Run Pipeline'}
            </V3Button>
            <V3Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
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
            icon={Users}
            label="Total Donors"
            value={(stats?.totalDonors || 0).toLocaleString()}
            subtitle="Unique donors analyzed"
            accent="blue"
          />
          <V3KPICard
            icon={TrendingUp}
            label="Avg Touchpoints"
            value={(stats?.avgTouchpointsBeforeConversion || 0).toFixed(1)}
            subtitle="Before conversion"
            accent="purple"
          />
          <V3KPICard
            icon={Heart}
            label="Retention Rate"
            value={`${(stats?.retentionMetrics.retentionRate || 0).toFixed(0)}%`}
            subtitle="Repeat donors"
            accent={(stats?.retentionMetrics.retentionRate || 0) >= 50 ? "green" : "amber"}
          />
          <V3KPICard
            icon={DollarSign}
            label="Avg Donation"
            value={`$${(stats?.avgDonation || 0).toFixed(0)}`}
            subtitle="Per transaction"
            accent="green"
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
            <Filter className="h-4 w-4" />
            <span>Min Amount:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {amountFilters.map((filter) => (
              <V3FilterPill
                key={filter.value}
                label={filter.label}
                isActive={minAmount === filter.value}
                onClick={() => setMinAmount(filter.value)}
              />
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <V3ChartWrapper
            title="Conversion Funnel"
            description="Donor progression through acquisition stages"
            icon={Target}
            isLoading={isLoading}
            ariaLabel="Funnel chart showing donor conversion stages"
          >
            {funnel.length === 0 || funnel.every(f => f.count === 0) ? (
              <div className="h-[280px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No funnel data available</p>
                  <p className="text-sm">Run the pipeline to generate journey events</p>
                </div>
              </div>
            ) : (
              <EChartsFunnelChart
                data={funnel.map(stage => ({
                  name: stage.label,
                  value: stage.count,
                  color: FUNNEL_STAGE_COLORS[stage.stage],
                }))}
                height={280}
                showConversionRates
                valueType="number"
              />
            )}
          </V3ChartWrapper>

          {/* Touchpoint Distribution */}
          <V3ChartWrapper
            title="Touchpoint Distribution"
            description="Types of interactions before conversion"
            icon={Layers}
            isLoading={isLoading}
            ariaLabel="Bar chart showing touchpoint types"
          >
            {touchpointChartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No touchpoint data available</p>
                  <p className="text-sm">Run the pipeline to generate touchpoint data</p>
                </div>
              </div>
            ) : (
              <EChartsBarChart
                data={touchpointChartData}
                xAxisKey="name"
                series={[{ dataKey: "value", name: "Touchpoints" }]}
                height={280}
                valueType="number"
              />
            )}
          </V3ChartWrapper>
        </div>

        {/* Attribution Model */}
        <V3Card>
          <V3CardHeader>
            <V3CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Multi-Touch Attribution Model
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              40% First Touch • 20% Middle Touches • 40% Last Touch
            </p>
          </V3CardHeader>
          <V3CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                <div className="text-3xl font-bold text-[hsl(var(--portal-accent-blue))]">40%</div>
                <div className="text-sm text-[hsl(var(--portal-text-muted))]">First Touch</div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Initial awareness</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
                <div className="text-3xl font-bold text-[hsl(var(--portal-success))]">20%</div>
                <div className="text-sm text-[hsl(var(--portal-text-muted))]">Middle Touches</div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Nurturing phase</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
                <div className="text-3xl font-bold text-[hsl(var(--portal-accent-purple))]">40%</div>
                <div className="text-sm text-[hsl(var(--portal-text-muted))]">Last Touch</div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Final conversion</p>
              </div>
            </div>
          </V3CardContent>
        </V3Card>

        {/* Recent Journeys Table */}
        <V3Card>
          <V3CardHeader>
            <V3CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Recent Donor Journeys
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              {journeys.length} journeys with attribution paths
            </p>
          </V3CardHeader>
          <V3CardContent>
            {journeys.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--portal-border))]">
                      <th className="text-left py-3 px-4 font-medium text-[hsl(var(--portal-text-muted))]">Donor</th>
                      <th className="text-right py-3 px-4 font-medium text-[hsl(var(--portal-text-muted))]">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-[hsl(var(--portal-text-muted))]">Touchpoints</th>
                      <th className="text-left py-3 px-4 font-medium text-[hsl(var(--portal-text-muted))]">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-[hsl(var(--portal-text-muted))]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.slice(0, 10).map((journey, idx) => (
                      <tr 
                        key={journey.id || idx}
                        className="border-b border-[hsl(var(--portal-border)/0.5)] hover:bg-[hsl(var(--portal-bg-elevated))]"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-[hsl(var(--portal-text-primary))]">
                            {journey.donor_email?.slice(0, 20)}...
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[hsl(var(--portal-success))]">
                          ${journey.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {journey.touchpoints.slice(0, 3).map((tp, tpIdx) => {
                              const Icon = getTouchpointIcon(tp.touchpoint_type);
                              return (
                                <div
                                  key={tpIdx}
                                  className="w-6 h-6 rounded-full bg-[hsl(var(--portal-bg-elevated))] flex items-center justify-center"
                                  title={tp.touchpoint_type}
                                >
                                  <Icon className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" />
                                </div>
                              );
                            })}
                            {journey.touchpoints.length > 3 && (
                              <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                                +{journey.touchpoints.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[hsl(var(--portal-text-muted))]">
                          {formatDistanceToNow(new Date(journey.transaction_date), { addSuffix: true })}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedJourney(journey)}
                            className="text-[hsl(var(--portal-accent-blue))]"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No journey data available</p>
                  <p className="text-sm">Run the pipeline to generate donor journeys</p>
                </div>
              </div>
            )}
          </V3CardContent>
        </V3Card>

        {/* Data Pipeline Status */}
        <DataPipelineStatus pipelines={pipelineData} isLoading={isLoading} />

        {/* Data Freshness */}
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
            Data updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </p>
        )}
      </V3PageContainer>

      {/* Journey Detail Dialog */}
      <JourneyDetailDialog
        journey={selectedJourney}
        open={!!selectedJourney}
        onOpenChange={(open) => !open && setSelectedJourney(null)}
      />
    </ClientShell>
  );
};

export default ClientDonorJourney;
