import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3CardDescription } from "@/components/v3/V3Card";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import { V3KPICard } from "@/components/v3/V3KPICard";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { V3DonutChart } from "@/components/charts/echarts";
import { 
  RefreshCw, 
  TrendingUp, 
  DollarSign,
  Users,
  ArrowUpCircle,
  Calendar,
  PlusCircle,
  AlertTriangle,
  Activity
} from "lucide-react";

interface RecurringHealthData {
  // Current state (point-in-time)
  current_active_mrr: number;
  current_active_donors: number;
  current_paused_donors: number;
  current_cancelled_donors: number;
  current_failed_donors: number;
  current_churned_donors: number;
  
  // Period metrics
  new_recurring_mrr: number;
  new_recurring_donors: number;
  period_recurring_revenue: number;
  period_recurring_transactions: number;
  
  // Derived
  avg_recurring_amount: number;
  upsell_shown: number;
  upsell_succeeded: number;
  upsell_rate: number;
}

interface RecurringDonorHealthProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export function RecurringDonorHealth({ organizationId, startDate, endDate }: RecurringDonorHealthProps) {
  const { data: healthData, isLoading, error } = useQuery({
    queryKey: ['recurring-health-v2', organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recurring_health_v2', {
        _organization_id: organizationId,
        _start_date: startDate,
        _end_date: endDate,
      });
      
      if (error) throw error;
      return data?.[0] as RecurringHealthData | undefined;
    },
    enabled: !!organizationId && !!startDate && !!endDate,
  });

  if (isLoading) {
    return <V3LoadingState variant="kpi-grid" count={6} />;
  }

  if (error) {
    return (
      <V3Card accent="red">
        <V3CardContent className="pt-6">
          <p className="text-[hsl(var(--portal-error))]">Error loading recurring health data: {error.message}</p>
        </V3CardContent>
      </V3Card>
    );
  }

  if (!healthData) {
    return (
      <V3EmptyState
        title="No Recurring Donor Data"
        description="Recurring donor health metrics will appear here when ActBlue transactions include recurring donation data."
        icon={RefreshCw}
      />
    );
  }

  const totalDonors = 
    healthData.current_active_donors + 
    healthData.current_paused_donors + 
    healthData.current_cancelled_donors + 
    healthData.current_failed_donors +
    healthData.current_churned_donors;

  const activeRate = totalDonors > 0 ? healthData.current_active_donors / totalDonors : 0;
  const churnRate = totalDonors > 0 ? (healthData.current_cancelled_donors + healthData.current_failed_donors + healthData.current_churned_donors) / totalDonors : 0;

  // Health score based on active rate and churn
  const healthScore = Math.round((activeRate * 0.7 + (1 - churnRate) * 0.3) * 100);
  const healthStatus = healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'fair' : 'poor';

  // Pie chart data for status breakdown with colors embedded
  const statusBreakdownData = [
    { name: 'Active', value: healthData.current_active_donors, color: 'hsl(var(--portal-success))' },
    { name: 'Paused', value: healthData.current_paused_donors, color: 'hsl(var(--portal-warning))' },
    { name: 'Cancelled', value: healthData.current_cancelled_donors, color: 'hsl(var(--portal-error))' },
    { name: 'Failed', value: healthData.current_failed_donors, color: 'hsl(var(--portal-accent-amber))' },
    { name: 'Churned', value: healthData.current_churned_donors, color: 'hsl(var(--portal-text-muted))' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <V3KPICard
          icon={Activity}
          label="Health Score"
          value={`${healthScore}%`}
          accent={healthStatus === 'excellent' ? 'green' : healthStatus === 'good' ? 'blue' : healthStatus === 'fair' ? 'amber' : 'red'}
          subtitle={healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
        />
        <V3KPICard
          icon={DollarSign}
          label="Active MRR"
          value={formatCurrency(healthData.current_active_mrr || 0)}
          accent="green"
          subtitle="Expected monthly"
        />
        <V3KPICard
          icon={Users}
          label="Active Donors"
          value={formatNumber(healthData.current_active_donors || 0)}
          accent="blue"
          subtitle={`${formatPercent(activeRate)} of total`}
        />
        <V3KPICard
          icon={TrendingUp}
          label="Avg Amount"
          value={formatCurrency(healthData.avg_recurring_amount || 0)}
          accent="purple"
          subtitle="Per active donor"
        />
      </div>

      {/* Period Performance Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
          <h3 className="text-sm font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Period Performance</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <V3KPICard
            icon={PlusCircle}
            label="New MRR Added"
            value={formatCurrency(healthData.new_recurring_mrr || 0)}
            accent="green"
            subtitle="From new recurring donors"
          />
          <V3KPICard
            icon={Users}
            label="New Recurring Donors"
            value={formatNumber(healthData.new_recurring_donors || 0)}
            accent="blue"
            subtitle="First recurring in period"
          />
          <V3KPICard
            icon={DollarSign}
            label="Period Recurring Revenue"
            value={formatCurrency(healthData.period_recurring_revenue || 0)}
            accent="amber"
            subtitle={`${formatNumber(healthData.period_recurring_transactions || 0)} transactions`}
          />
        </div>
      </div>

      {/* Status Breakdown with ECharts Pie */}
      <V3Card>
        <V3CardHeader>
          <V3CardTitle>Donor Status Breakdown</V3CardTitle>
          <V3CardDescription>Current distribution of all recurring donors by status</V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-[280px]">
              <V3DonutChart
                data={statusBreakdownData}
                height={280}
                valueType="number"
                centerLabel="Total Donors"
                showLegend={true}
                legendPosition="bottom"
              />
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.3)]">
                <span className="font-medium text-[hsl(var(--portal-success))]">Active</span>
                <p className="text-2xl font-bold text-[hsl(var(--portal-success))] mt-1">
                  {formatNumber(healthData.current_active_donors)}
                </p>
                <p className="text-sm text-[hsl(var(--portal-success)/0.8)] mt-1">
                  {formatPercent(activeRate)} of total
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.3)]">
                <span className="font-medium text-[hsl(var(--portal-warning))]">Paused</span>
                <p className="text-2xl font-bold text-[hsl(var(--portal-warning))] mt-1">
                  {formatNumber(healthData.current_paused_donors)}
                </p>
                <p className="text-sm text-[hsl(var(--portal-warning)/0.8)] mt-1">
                  {totalDonors > 0 ? formatPercent(healthData.current_paused_donors / totalDonors) : '0%'} of total
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.3)]">
                <span className="font-medium text-[hsl(var(--portal-error))]">Cancelled</span>
                <p className="text-2xl font-bold text-[hsl(var(--portal-error))] mt-1">
                  {formatNumber(healthData.current_cancelled_donors)}
                </p>
                <p className="text-sm text-[hsl(var(--portal-error)/0.8)] mt-1">
                  {totalDonors > 0 ? formatPercent(healthData.current_cancelled_donors / totalDonors) : '0%'} of total
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[hsl(var(--portal-text-muted))]">Churned</span>
                  <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--portal-text-muted))]" />
                </div>
                <p className="text-2xl font-bold text-[hsl(var(--portal-text-muted))] mt-1">
                  {formatNumber(healthData.current_churned_donors)}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted)/0.8)] mt-1">
                  Inactive 35+ days
                </p>
              </div>
            </div>
          </div>

          {/* Health Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--portal-text-muted))]">Overall Health</span>
              <span className={`font-medium ${
                healthStatus === 'excellent' ? 'text-[hsl(var(--portal-success))]' :
                healthStatus === 'good' ? 'text-[hsl(var(--portal-accent-blue))]' :
                healthStatus === 'fair' ? 'text-[hsl(var(--portal-warning))]' : 'text-[hsl(var(--portal-error))]'
              }`}>
                {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
              </span>
            </div>
            <Progress 
              value={healthScore} 
              className={`h-3 ${
                healthStatus === 'excellent' ? '[&>div]:bg-[hsl(var(--portal-success))]' :
                healthStatus === 'good' ? '[&>div]:bg-[hsl(var(--portal-accent-blue))]' :
                healthStatus === 'fair' ? '[&>div]:bg-[hsl(var(--portal-warning))]' : '[&>div]:bg-[hsl(var(--portal-error))]'
              }`}
            />
          </div>
        </V3CardContent>
      </V3Card>

      {/* Upsell Performance */}
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            Recurring Upsell Performance
          </V3CardTitle>
          <V3CardDescription>
            Conversion rate for recurring donation upsell prompts (in selected period)
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Upsells Shown</p>
              <p className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]">{formatNumber(healthData.upsell_shown)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Upsells Accepted</p>
              <p className="text-3xl font-bold text-[hsl(var(--portal-success))]">{formatNumber(healthData.upsell_succeeded)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold text-[hsl(var(--portal-accent-blue))]">
                {formatPercent(healthData.upsell_rate)}
              </p>
            </div>
          </div>

          {/* Upsell Progress */}
          {healthData.upsell_shown > 0 && (
            <div className="mt-4">
              <Progress 
                value={healthData.upsell_rate * 100} 
                className="h-2"
              />
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1 text-center">
                {formatNumber(healthData.upsell_succeeded)} of {formatNumber(healthData.upsell_shown)} donors accepted the upsell
              </p>
            </div>
          )}
        </V3CardContent>
      </V3Card>
    </div>
  );
}
