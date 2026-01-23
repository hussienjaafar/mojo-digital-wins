import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Activity,
  Database,
  Webhook,
  Key,
  ArrowRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { IntegrationHealth, useOrganizationIntegrationHealth } from '@/hooks/useIntegrationHealth';

interface IntegrationHealthPanelProps {
  organizationId: string;
  platform?: string;
  onUpdateCredentials?: (credentialId: string) => void;
  onBackfillData?: (organizationId: string, platform: string, dateRange: { start: string; end: string }) => void;
  className?: string;
}

function StatusIcon({ status }: { status: 'success' | 'error' | 'warning' | 'pending' }) {
  const icons = {
    success: <CheckCircle className="h-4 w-4 text-[hsl(var(--portal-success))]" />,
    error: <XCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />,
    warning: <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />,
    pending: <Clock className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />,
  };
  return icons[status];
}

function HealthCheckRow({
  label,
  status,
  value,
  hint,
  tooltip,
}: {
  label: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  value: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]/50 last:border-b-0">
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="text-sm text-[hsl(var(--portal-text-secondary))]">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">{value}</span>
        {hint && (
          <code className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] font-mono">
            ****{hint}
          </code>
        )}
      </div>
    </div>
  );
}

function HealthScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'portal-success' : score >= 50 ? 'portal-warning' : 'portal-error';
  
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle
            className="text-[hsl(var(--portal-bg-tertiary))]"
            strokeWidth="3"
            stroke="currentColor"
            fill="none"
            r="16"
            cx="18"
            cy="18"
          />
          <circle
            className={`text-[hsl(var(--${color}))]`}
            strokeWidth="3"
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            r="16"
            cx="18"
            cy="18"
            strokeDasharray={`${score} 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold text-[hsl(var(--${color}))]`}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</span>
    </div>
  );
}

function PlatformHealthCard({
  health,
  onUpdateCredentials,
  onBackfillData,
}: {
  health: IntegrationHealth;
  onUpdateCredentials?: (credentialId: string) => void;
  onBackfillData?: (organizationId: string, platform: string, dateRange: { start: string; end: string }) => void;
}) {
  const hasWebhookIssues = health.webhookHealth && health.webhookHealth.failureRate > 0.1;
  const hasDataGap = health.dataFreshness && health.dataFreshness.isStale;
  const hasCriticalIssues = hasWebhookIssues || hasDataGap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-[hsl(var(--portal-bg-card))] overflow-hidden',
        hasCriticalIssues 
          ? 'border-[hsl(var(--portal-error))]/50' 
          : 'border-[hsl(var(--portal-border))]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--portal-border))]">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            hasCriticalIssues 
              ? 'bg-[hsl(var(--portal-error))]/10' 
              : 'bg-[hsl(var(--portal-accent-blue))]/10'
          )}>
            <Activity className={cn(
              'h-5 w-5',
              hasCriticalIssues 
                ? 'text-[hsl(var(--portal-error))]' 
                : 'text-[hsl(var(--portal-accent-blue))]'
            )} />
          </div>
          <div>
            <h3 className="font-medium text-[hsl(var(--portal-text-primary))] capitalize">
              {health.platform} Integration
            </h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              {health.isActive ? 'Active' : 'Disabled'}
            </p>
          </div>
        </div>
        <HealthScoreGauge score={health.healthScore} label="Health" />
      </div>

      {/* Critical Alerts */}
      {hasCriticalIssues && (
        <div className="p-3 bg-[hsl(var(--portal-error))]/5 border-b border-[hsl(var(--portal-error))]/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-error))] mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {hasWebhookIssues && (
                <p className="text-sm text-[hsl(var(--portal-error))]">
                  Webhook authentication is failing ({health.webhookHealth!.recentFailureCount} failed events)
                </p>
              )}
              {hasDataGap && (
                <p className="text-sm text-[hsl(var(--portal-error))]">
                  Data is {health.dataFreshness!.daysStale} days stale
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credential Status */}
      <div className="p-4 border-b border-[hsl(var(--portal-border))]">
        <div className="flex items-center gap-2 mb-3">
          <Key className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
            Credential Configuration
          </span>
        </div>
        <div className="space-y-0.5">
          {health.credentialStatus.map((cred, idx) => (
            <HealthCheckRow
              key={idx}
              label={cred.field}
              status={cred.configured ? 'success' : 'warning'}
              value={cred.configured ? 'Configured' : 'Not configured'}
              hint={cred.hint}
            />
          ))}
          {health.lastTestedAt && (
            <HealthCheckRow
              label="Last tested"
              status={health.lastTestStatus === 'success' ? 'success' : health.lastTestStatus === 'error' ? 'error' : 'pending'}
              value={formatDistanceToNow(new Date(health.lastTestedAt), { addSuffix: true })}
              tooltip={health.lastTestError || undefined}
            />
          )}
        </div>
      </div>

      {/* Webhook Health (if applicable) */}
      {health.webhookHealth && (
        <div className="p-4 border-b border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-3">
            <Webhook className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Webhook Status
            </span>
          </div>
          <div className="space-y-0.5">
            <HealthCheckRow
              label="Recent success"
              status={health.webhookHealth.recentSuccessCount > 0 ? 'success' : 'warning'}
              value={`${health.webhookHealth.recentSuccessCount} events`}
            />
            <HealthCheckRow
              label="Recent failures"
              status={health.webhookHealth.recentFailureCount === 0 ? 'success' : 'error'}
              value={`${health.webhookHealth.recentFailureCount} events`}
            />
            {health.webhookHealth.recentErrors.length > 0 && (
              <div className="mt-2 p-2 rounded bg-[hsl(var(--portal-error))]/5">
                <p className="text-xs text-[hsl(var(--portal-error))]">
                  Error: {health.webhookHealth.recentErrors[0]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Health (if applicable) */}
      {health.syncHealth && (
        <div className="p-4 border-b border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Sync Status
            </span>
          </div>
          <div className="space-y-0.5">
            <HealthCheckRow
              label="Last sync"
              status={health.syncHealth.lastSyncStatus === 'success' ? 'success' : 'error'}
              value={health.syncHealth.lastSyncAt 
                ? formatDistanceToNow(new Date(health.syncHealth.lastSyncAt), { addSuffix: true })
                : 'Never'
              }
            />
            <HealthCheckRow
              label="Success rate"
              status={health.syncHealth.syncSuccessRate >= 0.9 ? 'success' : 'warning'}
              value={`${Math.round(health.syncHealth.syncSuccessRate * 100)}%`}
            />
          </div>
        </div>
      )}

      {/* Data Freshness */}
      {health.dataFreshness && (
        <div className="p-4 border-b border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Data Freshness
            </span>
          </div>
          <div className="space-y-0.5">
            <HealthCheckRow
              label="Last transaction"
              status={health.dataFreshness.isStale ? 'warning' : 'success'}
              value={health.dataFreshness.lastTransactionAt 
                ? formatDistanceToNow(new Date(health.dataFreshness.lastTransactionAt), { addSuffix: true })
                : 'None'
              }
            />
            <HealthCheckRow
              label="Last 7 days"
              status={health.dataFreshness.transactionsLast7Days > 0 ? 'success' : 'warning'}
              value={`${health.dataFreshness.transactionsLast7Days} transactions`}
            />
          </div>
        </div>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Recommended Actions
            </span>
          </div>
          <ul className="space-y-2">
            {health.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-accent-blue))] mt-1.5 flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--portal-text-secondary))]">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 bg-[hsl(var(--portal-bg-tertiary))]/50 flex gap-2">
        {onUpdateCredentials && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onUpdateCredentials(health.credentialId)}
          >
            <Key className="h-4 w-4 mr-2" />
            Update Credentials
          </Button>
        )}
        {onBackfillData && health.dataFreshness?.isStale && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const start = new Date();
              start.setDate(start.getDate() - health.dataFreshness!.daysStale);
              onBackfillData(health.organizationId, health.platform, {
                start: start.toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0],
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Backfill Missing Data
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function IntegrationHealthPanel({
  organizationId,
  platform,
  onUpdateCredentials,
  onBackfillData,
  className,
}: IntegrationHealthPanelProps) {
  const { data: healthData, isLoading, error, refetch } = useOrganizationIntegrationHealth(organizationId);

  const filteredHealth = platform 
    ? healthData?.filter(h => h.platform === platform) 
    : healthData;

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-[hsl(var(--portal-border))] p-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-xl border border-[hsl(var(--portal-border))] p-6 text-center', className)}>
        <AlertTriangle className="h-8 w-8 text-[hsl(var(--portal-error))] mx-auto mb-2" />
        <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-4">
          Failed to load integration health
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!filteredHealth || filteredHealth.length === 0) {
    return (
      <div className={cn('rounded-xl border border-[hsl(var(--portal-border))] p-6 text-center', className)}>
        <Activity className="h-8 w-8 text-[hsl(var(--portal-text-muted))] mx-auto mb-2" />
        <p className="text-sm text-[hsl(var(--portal-text-muted))]">
          No integration health data available
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[hsl(var(--portal-text-primary))]">
          Integration Health
        </h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      <AnimatePresence mode="popLayout">
        {filteredHealth.map((health) => (
          <PlatformHealthCard
            key={`${health.organizationId}-${health.platform}`}
            health={health}
            onUpdateCredentials={onUpdateCredentials}
            onBackfillData={onBackfillData}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
