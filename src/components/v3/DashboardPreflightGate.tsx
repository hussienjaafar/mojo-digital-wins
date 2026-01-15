import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle2, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useClientDashboardHealth, 
  DashboardHealthStatus, 
  DashboardHealthIssue,
  DataSource 
} from '@/hooks/useClientDashboardHealth';
import { V3LoadingState } from './V3LoadingState';

interface DashboardPreflightGateProps {
  organizationId: string | undefined;
  requiredSources?: DataSource[];
  children: React.ReactNode;
  /** Show warnings banner but still render children */
  allowDegraded?: boolean;
  /** Completely block rendering on critical issues */
  blockOnCritical?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Section name for context */
  sectionName?: string;
  /** Compact mode - minimal UI */
  compact?: boolean;
  className?: string;
}

/**
 * Health status badge component
 */
function HealthStatusBadge({ status, score }: { status: DashboardHealthStatus['overallStatus']; score: number }) {
  const config = {
    healthy: {
      icon: CheckCircle2,
      label: 'All Systems Go',
      className: 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/20',
    },
    degraded: {
      icon: AlertTriangle,
      label: 'Some Issues',
      className: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/20',
    },
    critical: {
      icon: AlertCircle,
      label: 'Critical Issues',
      className: 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/20',
    },
    loading: {
      icon: Loader2,
      label: 'Checking...',
      className: 'bg-muted text-muted-foreground border-border',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'loading' && 'animate-spin')} />
      <span>{label}</span>
      {status !== 'loading' && (
        <span className="opacity-70">({score}%)</span>
      )}
    </Badge>
  );
}

/**
 * Issue display component
 */
function IssueCard({ issue, compact }: { issue: DashboardHealthIssue; compact?: boolean }) {
  const severityConfig = {
    info: {
      icon: CheckCircle2,
      className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-[hsl(var(--portal-warning))]/30 bg-[hsl(var(--portal-warning))]/5 text-[hsl(var(--portal-warning))]',
    },
    critical: {
      icon: AlertCircle,
      className: 'border-[hsl(var(--portal-error))]/30 bg-[hsl(var(--portal-error))]/5 text-[hsl(var(--portal-error))]',
    },
  };

  const { icon: Icon, className } = severityConfig[issue.severity];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border', className)}>
              <Icon className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{issue.title}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">{issue.title}</p>
            <p className="text-xs opacity-80 mt-1">{issue.message}</p>
            {issue.recommendation && (
              <p className="text-xs opacity-60 mt-1">💡 {issue.recommendation}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', className)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{issue.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{issue.message}</p>
        {issue.recommendation && (
          <p className="text-xs opacity-60 mt-1">💡 {issue.recommendation}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Data source status pills
 */
function DataSourcePills({ health }: { health: DashboardHealthStatus }) {
  const statusConfig = {
    healthy: { color: 'bg-[hsl(var(--portal-success))]', label: '●' },
    stale: { color: 'bg-[hsl(var(--portal-warning))]', label: '●' },
    critical: { color: 'bg-[hsl(var(--portal-error))]', label: '●' },
    never_synced: { color: 'bg-muted-foreground', label: '○' },
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {health.dataSources.map(ds => (
        <TooltipProvider key={ds.source}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs">
                <span className={cn('w-2 h-2 rounded-full', statusConfig[ds.status].color)} />
                <span className="text-muted-foreground">{ds.displayName}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">{ds.displayName}</p>
                <p className="text-xs">
                  {ds.status === 'never_synced' 
                    ? 'Never synced'
                    : `${Math.round(ds.dataLagHours)}h old (SLA: ${ds.slaHours}h)`
                  }
                </p>
                {ds.integrationStatus && (
                  <p className="text-xs opacity-80">
                    Integration: {ds.integrationStatus}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

/**
 * Dashboard Preflight Gate Component
 * 
 * Wraps dashboard sections and validates data availability before rendering.
 * Shows appropriate loading, warning, or error states based on data health.
 */
export function DashboardPreflightGate({
  organizationId,
  requiredSources,
  children,
  allowDegraded = true,
  blockOnCritical = false,
  loadingComponent,
  errorComponent,
  sectionName,
  compact = false,
  className,
}: DashboardPreflightGateProps) {
  const health = useClientDashboardHealth(organizationId, requiredSources);

  // Loading state
  if (health.isLoading) {
    return (
      <div className={className}>
        {loadingComponent ?? (
          <V3LoadingState 
            variant="kpi" 
            message={sectionName ? `Loading ${sectionName}...` : 'Checking data availability...'} 
          />
        )}
      </div>
    );
  }

  // Critical state - block if requested
  if (health.overallStatus === 'critical' && blockOnCritical) {
    return (
      <div className={cn('space-y-4', className)}>
        {errorComponent ?? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Dashboard Unavailable</AlertTitle>
            <AlertDescription>
              {sectionName ? `${sectionName} cannot be displayed due to critical data issues.` : 'Critical data issues are preventing the dashboard from loading.'}
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          {health.issues
            .filter(i => i.severity === 'critical')
            .map(issue => (
              <IssueCard key={issue.id} issue={issue} compact={compact} />
            ))}
        </div>
        {health.recommendations.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Recommendations:</p>
            <ul className="list-disc list-inside space-y-1">
              {health.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Can render (possibly with warnings)
  const criticalIssues = health.issues.filter(i => i.severity === 'critical');
  const warningIssues = health.issues.filter(i => i.severity === 'warning');
  const showWarningBanner = (criticalIssues.length > 0 || warningIssues.length > 0) && allowDegraded;

  return (
    <div className={className}>
      {/* Warning banner for degraded state */}
      {showWarningBanner && !compact && (
        <Alert 
          variant={criticalIssues.length > 0 ? 'destructive' : 'default'}
          className="mb-4 border-[hsl(var(--portal-warning))]/30 bg-[hsl(var(--portal-warning))]/5"
        >
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
          <AlertTitle className="text-[hsl(var(--portal-warning))]">
            Data Warning
          </AlertTitle>
          <AlertDescription className="text-[hsl(var(--portal-text-secondary))]">
            {health.degradedSources.length > 0 && (
              <span>
                Some data sources are stale: {health.degradedSources.map(s => 
                  health.dataSources.find(ds => ds.source === s)?.displayName
                ).join(', ')}. 
              </span>
            )}
            {' '}Metrics may not reflect the latest data.
          </AlertDescription>
        </Alert>
      )}

      {/* Compact warning pills */}
      {showWarningBanner && compact && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {[...criticalIssues, ...warningIssues].slice(0, 3).map(issue => (
            <IssueCard key={issue.id} issue={issue} compact />
          ))}
          {health.issues.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{health.issues.length - 3} more
            </Badge>
          )}
        </div>
      )}

      {/* Render children */}
      {children}
    </div>
  );
}

/**
 * Dashboard health header component
 * 
 * Shows overall health status and data source pills at the top of a dashboard
 */
export function DashboardHealthHeader({
  organizationId,
  requiredSources,
  showDetails = false,
  className,
}: {
  organizationId: string | undefined;
  requiredSources?: DataSource[];
  showDetails?: boolean;
  className?: string;
}) {
  const health = useClientDashboardHealth(organizationId, requiredSources);

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      <HealthStatusBadge status={health.overallStatus} score={health.healthScore} />
      {showDetails && <DataSourcePills health={health} />}
    </div>
  );
}

export default DashboardPreflightGate;
