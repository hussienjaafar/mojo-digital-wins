import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { IntegrationSummary } from '@/types/integrations';

interface IntegrationSystemHealthProps {
  data: IntegrationSummary[];
  onTestAllFailing: () => Promise<void>;
  onSyncAll: () => Promise<void>;
  isTestingAll?: boolean;
  isSyncingAll?: boolean;
  className?: string;
}

interface HealthDistribution {
  healthy: number;
  failing: number;
  untested: number;
  disabled: number;
  noSetup: number;
  total: number;
  healthScore: number;
}

function calculateHealth(data: IntegrationSummary[]): HealthDistribution {
  const stats = data.reduce(
    (acc, org) => {
      acc.healthy += org.healthy_count;
      acc.failing += org.error_count;
      acc.untested += org.untested_count;
      acc.disabled += org.disabled_count;
      acc.total += org.total_count;
      if (org.total_count === 0) acc.noSetup++;
      return acc;
    },
    { healthy: 0, failing: 0, untested: 0, disabled: 0, noSetup: 0, total: 0 }
  );

  const activeIntegrations = stats.healthy + stats.failing + stats.untested;
  const healthScore = activeIntegrations > 0 
    ? Math.round((stats.healthy / activeIntegrations) * 100)
    : 100;

  return { ...stats, healthScore };
}

function HealthScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 90) return 'hsl(var(--portal-success))';
    if (score >= 70) return 'hsl(var(--portal-warning))';
    return 'hsl(var(--portal-error))';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--portal-border))"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-[hsl(var(--portal-text-primary))]"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}%
        </motion.span>
        <span className="text-xs text-[hsl(var(--portal-text-secondary))]">Health</span>
      </div>
    </div>
  );
}

interface DistributionBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
  icon: React.ReactNode;
}

function DistributionBar({ label, count, total, color, icon }: DistributionBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("opacity-70", color)}>{icon}</span>
          <span className="text-[hsl(var(--portal-text-secondary))]">{label}</span>
        </div>
        <span className="font-medium text-[hsl(var(--portal-text-primary))]">{count}</span>
      </div>
      <div className="h-2 bg-[hsl(var(--portal-bg-elevated))] rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function IntegrationSystemHealth({
  data,
  onTestAllFailing,
  onSyncAll,
  isTestingAll = false,
  isSyncingAll = false,
  className,
}: IntegrationSystemHealthProps) {
  const health = useMemo(() => calculateHealth(data), [data]);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const handleTestAllFailing = async () => {
    setTestDialogOpen(false);
    await onTestAllFailing();
  };

  const handleSyncAll = async () => {
    setSyncDialogOpen(false);
    await onSyncAll();
  };

  const totalOrgs = data.length;
  const orgsWithIssues = data.filter(d => d.health_status === 'needs_attention').length;

  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]",
        "p-6 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Health Score Section */}
        <div className="flex items-center gap-6">
          <HealthScoreRing score={health.healthScore} />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
              System Health
            </h3>
            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
              {totalOrgs} organizations • {health.total} integrations
            </p>
            {orgsWithIssues > 0 && (
              <p className="text-sm text-[hsl(var(--portal-warning))] flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {orgsWithIssues} org{orgsWithIssues !== 1 ? 's' : ''} need attention
              </p>
            )}
          </div>
        </div>

        {/* Distribution Bars */}
        <div className="flex-1 space-y-3 min-w-[200px]">
          <DistributionBar
            label="Healthy"
            count={health.healthy}
            total={health.total}
            color="text-[hsl(var(--portal-success))]"
            icon={<CheckCircle className="h-4 w-4" />}
          />
          <DistributionBar
            label="Failing"
            count={health.failing}
            total={health.total}
            color="text-[hsl(var(--portal-error))]"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <DistributionBar
            label="Untested"
            count={health.untested}
            total={health.total}
            color="text-[hsl(var(--portal-warning))]"
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-col gap-2 lg:border-l lg:border-[hsl(var(--portal-border))] lg:pl-6">
          <span className="text-xs font-medium text-[hsl(var(--portal-text-secondary))] uppercase tracking-wider mb-1">
            Bulk Actions
          </span>
          
          {health.failing > 0 && (
            <AlertDialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isTestingAll || isSyncingAll}
                  className="justify-start gap-2 border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-warning))] hover:bg-[hsl(var(--portal-warning)/0.1)]"
                >
                  {isTestingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Retest Failing ({health.failing})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retest All Failing Integrations?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will test {health.failing} failing integration{health.failing !== 1 ? 's' : ''} across all organizations. 
                    This may take a few minutes depending on API response times.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleTestAllFailing}>
                    Retest All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isTestingAll || isSyncingAll}
                className="justify-start gap-2 border-[hsl(var(--portal-border))]"
              >
                {isSyncingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Sync All Active
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sync All Active Integrations?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will trigger a sync for all {health.healthy + health.failing + health.untested} active integrations. 
                  This is a resource-intensive operation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSyncAll}>
                  Sync All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
