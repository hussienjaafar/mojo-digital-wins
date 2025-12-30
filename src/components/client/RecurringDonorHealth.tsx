import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  PauseCircle,
  XCircle,
  DollarSign,
  Users,
  ArrowUpCircle
} from "lucide-react";

interface RecurringHealthData {
  active_recurring: number;
  paused_recurring: number;
  cancelled_recurring: number;
  failed_recurring: number;
  mrr: number;
  upsell_shown: number;
  upsell_succeeded: number;
  upsell_rate: number;
  avg_recurring_amount: number;
  recurring_donor_count: number;
  total_recurring_revenue: number;
}

interface RecurringDonorHealthProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export function RecurringDonorHealth({ organizationId, startDate, endDate }: RecurringDonorHealthProps) {
  const { data: healthData, isLoading, error } = useQuery({
    queryKey: ['recurring-health', organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recurring_health', {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading recurring health data: {error.message}</p>
        </CardContent>
      </Card>
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

  const totalRecurring = 
    healthData.active_recurring + 
    healthData.paused_recurring + 
    healthData.cancelled_recurring + 
    healthData.failed_recurring;

  const activeRate = totalRecurring > 0 ? healthData.active_recurring / totalRecurring : 0;
  const churnRate = totalRecurring > 0 ? (healthData.cancelled_recurring + healthData.failed_recurring) / totalRecurring : 0;
  const pausedRate = totalRecurring > 0 ? healthData.paused_recurring / totalRecurring : 0;

  // Health score based on active rate and churn
  const healthScore = Math.round((activeRate * 0.7 + (1 - churnRate) * 0.3) * 100);
  const healthStatus = healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'fair' : 'poor';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Recurring Donor Health</h2>
        </div>
        <Badge 
          variant={healthStatus === 'excellent' ? 'default' : healthStatus === 'good' ? 'secondary' : 'destructive'}
          className="text-sm px-3 py-1"
        >
          Health Score: {healthScore}%
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(healthData.mrr || 0)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-600/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recurring Donors</p>
                <p className="text-2xl font-bold">
                  {formatNumber(healthData.recurring_donor_count || 0)}
                </p>
              </div>
              <Users className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Recurring Amount</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(healthData.avg_recurring_amount || 0)}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-600/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recurring Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(healthData.total_recurring_revenue || 0)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-purple-600/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recurring Status Breakdown</CardTitle>
          <CardDescription>Distribution of recurring donations by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">Active</span>
              </div>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                {formatNumber(healthData.active_recurring)}
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                {formatPercent(activeRate)} of total
              </p>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
              <div className="flex items-center gap-2 mb-2">
                <PauseCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-700 dark:text-yellow-400">Paused</span>
              </div>
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                {formatNumber(healthData.paused_recurring)}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                {formatPercent(pausedRate)} of total
              </p>
            </div>

            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-700 dark:text-red-400">Cancelled</span>
              </div>
              <p className="text-3xl font-bold text-red-700 dark:text-red-400">
                {formatNumber(healthData.cancelled_recurring)}
              </p>
              <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                {formatPercent(healthData.cancelled_recurring / totalRecurring)} of total
              </p>
            </div>

            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-700 dark:text-orange-400">Failed</span>
              </div>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                {formatNumber(healthData.failed_recurring)}
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-500 mt-1">
                {formatPercent(healthData.failed_recurring / totalRecurring)} of total
              </p>
            </div>
          </div>

          {/* Health Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Health</span>
              <span className={`font-medium ${
                healthStatus === 'excellent' ? 'text-green-600' :
                healthStatus === 'good' ? 'text-blue-600' :
                healthStatus === 'fair' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
              </span>
            </div>
            <Progress 
              value={healthScore} 
              className={`h-3 ${
                healthStatus === 'excellent' ? '[&>div]:bg-green-600' :
                healthStatus === 'good' ? '[&>div]:bg-blue-600' :
                healthStatus === 'fair' ? '[&>div]:bg-yellow-600' : '[&>div]:bg-red-600'
              }`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upsell Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            Recurring Upsell Performance
          </CardTitle>
          <CardDescription>
            Conversion rate for recurring donation upsell prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Upsells Shown</p>
              <p className="text-3xl font-bold">{formatNumber(healthData.upsell_shown)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Upsells Accepted</p>
              <p className="text-3xl font-bold text-green-600">{formatNumber(healthData.upsell_succeeded)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <p className="text-sm text-muted-foreground mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold text-primary">
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
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {formatNumber(healthData.upsell_succeeded)} of {formatNumber(healthData.upsell_shown)} donors accepted the upsell
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
