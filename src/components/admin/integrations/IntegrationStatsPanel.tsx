import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, Clock, Plug } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { IntegrationSummary } from '@/types/integrations';

interface IntegrationStatsPanelProps {
  data: IntegrationSummary[];
  className?: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  variant?: 'default' | 'success' | 'warning' | 'error';
}

function StatCard({ label, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900',
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card className={cn('border', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs',
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{trend.value}% this week</span>
              </div>
            )}
          </div>
          <div className={cn('p-2.5 rounded-lg bg-background/50', iconStyles[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationStatsPanel({ data, className }: IntegrationStatsPanelProps) {
  const stats = useMemo(() => {
    const totalClients = data.length;
    const totalIntegrations = data.reduce((sum, d) => sum + d.total_count, 0);
    const healthyIntegrations = data.reduce((sum, d) => sum + d.healthy_count, 0);
    const failingIntegrations = data.reduce((sum, d) => sum + d.error_count, 0);
    const untestedIntegrations = data.reduce((sum, d) => sum + d.untested_count, 0);
    
    const healthRate = totalIntegrations > 0 
      ? Math.round((healthyIntegrations / totalIntegrations) * 100) 
      : 0;

    return {
      totalClients,
      totalIntegrations,
      healthyIntegrations,
      failingIntegrations,
      untestedIntegrations,
      healthRate,
    };
  }, [data]);

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      <StatCard
        label="Total Clients"
        value={stats.totalClients}
        icon={<Activity className="h-5 w-5" />}
      />
      <StatCard
        label="Integrations"
        value={stats.totalIntegrations}
        icon={<Plug className="h-5 w-5" />}
      />
      <StatCard
        label="Healthy"
        value={`${stats.healthRate}%`}
        icon={<CheckCircle className="h-5 w-5" />}
        variant={stats.healthRate >= 90 ? 'success' : stats.healthRate >= 70 ? 'warning' : 'error'}
      />
      <StatCard
        label="Needs Attention"
        value={stats.failingIntegrations + stats.untestedIntegrations}
        icon={stats.failingIntegrations > 0 ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        variant={stats.failingIntegrations > 0 ? 'error' : stats.untestedIntegrations > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}
