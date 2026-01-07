import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3CardDescription } from "@/components/v3/V3Card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertTriangle
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <V3Card accent="red">
        <V3CardContent className="pt-6">
          <p className="text-destructive">Error loading recurring health data: {error.message}</p>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-[hsl(var(--portal-accent-blue))]" />
          <h2 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">Recurring Donor Health</h2>
        </div>
        <Badge 
          variant={healthStatus === 'excellent' ? 'default' : healthStatus === 'good' ? 'secondary' : 'destructive'}
          className="text-sm px-3 py-1"
        >
          Health Score: {healthScore}%
        </Badge>
      </div>

      {/* Current State Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
          <h3 className="text-sm font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Current State</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <V3Card accent="green">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Current Active MRR</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-success))]">
                    {formatCurrency(healthData.current_active_mrr || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Expected monthly revenue</p>
                </div>
                <DollarSign className="h-10 w-10 text-[hsl(var(--portal-success)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>

          <V3Card accent="blue">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Active Recurring Donors</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {formatNumber(healthData.current_active_donors || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Currently active subscriptions</p>
                </div>
                <Users className="h-10 w-10 text-[hsl(var(--portal-accent-blue)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>

          <V3Card accent="purple">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Avg Recurring Amount</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {formatCurrency(healthData.avg_recurring_amount || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Per active donor</p>
                </div>
                <TrendingUp className="h-10 w-10 text-[hsl(var(--portal-accent-purple)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>
        </div>
      </div>

      {/* Period Performance Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
          <h3 className="text-sm font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Period Performance</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <V3Card accent="green">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">New MRR Added</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-success))]">
                    {formatCurrency(healthData.new_recurring_mrr || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">From new recurring donors</p>
                </div>
                <PlusCircle className="h-10 w-10 text-[hsl(var(--portal-success)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>

          <V3Card accent="blue">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">New Recurring Donors</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {formatNumber(healthData.new_recurring_donors || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">First recurring in period</p>
                </div>
                <Users className="h-10 w-10 text-[hsl(var(--portal-accent-blue)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>

          <V3Card accent="amber">
            <V3CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Period Recurring Revenue</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {formatCurrency(healthData.period_recurring_revenue || 0)}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">{formatNumber(healthData.period_recurring_transactions || 0)} transactions</p>
                </div>
                <DollarSign className="h-10 w-10 text-[hsl(var(--portal-accent-amber)/0.2)]" />
              </div>
            </V3CardContent>
          </V3Card>
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
