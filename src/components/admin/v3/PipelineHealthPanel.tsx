import { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle, 
  RefreshCw, 
  Play, 
  ChevronDown,
  ChevronUp,
  Activity,
  Database,
  Zap,
  TrendingUp,
  Bell,
  Mail,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminPipelineHealth, getJobDisplayName, getJobCategory, formatDuration, formatTimeAgo, type PipelineJobHealth } from '@/hooks/useAdminPipelineHealth';
import { cn } from '@/lib/utils';

interface PipelineHealthPanelProps {
  className?: string;
  compact?: boolean;
}

const STATUS_CONFIG = {
  ok: { 
    icon: CheckCircle, 
    color: 'text-status-success', 
    bgColor: 'bg-status-success/10',
    borderColor: 'border-status-success/30',
    label: 'Healthy' 
  },
  warning: { 
    icon: Clock, 
    color: 'text-status-warning', 
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    label: 'Warning' 
  },
  stale: { 
    icon: AlertTriangle, 
    color: 'text-status-warning', 
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    label: 'Stale' 
  },
  error: { 
    icon: XCircle, 
    color: 'text-status-error', 
    bgColor: 'bg-status-error/10',
    borderColor: 'border-status-error/30',
    label: 'Error' 
  },
};

const CATEGORY_CONFIG = {
  ingestion: { icon: Database, label: 'Data Ingestion', color: 'text-blue-400' },
  processing: { icon: Zap, label: 'AI Processing', color: 'text-purple-400' },
  trends: { icon: TrendingUp, label: 'Trend Analysis', color: 'text-green-400' },
  alerting: { icon: Bell, label: 'Smart Alerting', color: 'text-orange-400' },
  notifications: { icon: Mail, label: 'Notifications', color: 'text-pink-400' },
  other: { icon: Activity, label: 'Other', color: 'text-muted-foreground' },
};

function JobStatusBadge({ status }: { status: PipelineJobHealth['freshness_status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-[10px] font-medium",
        config.bgColor,
        config.borderColor,
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function JobRow({ job }: { job: PipelineJobHealth }) {
  const category = getJobCategory(job.job_type);
  const categoryConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other;
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg",
      "bg-card/50 hover:bg-card/80 transition-colors",
      "border",
      STATUS_CONFIG[job.freshness_status].borderColor
    )}>
      <div className={cn("p-1.5 rounded", categoryConfig.color, "bg-current/10")}>
        <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {getJobDisplayName(job.job_type)}
          </span>
          <JobStatusBadge status={job.freshness_status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>Last: {formatTimeAgo(job.last_run_at)}</span>
          {job.last_duration_ms && (
            <span>Duration: {formatDuration(job.last_duration_ms)}</span>
          )}
          {job.runs_24h !== null && job.runs_24h > 0 && (
            <span>{job.runs_24h} runs today</span>
          )}
        </div>
        {job.last_error && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-destructive mt-1 truncate cursor-help">
                Error: {job.last_error}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p className="text-xs">{job.last_error}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        {job.records_created_24h !== null && job.records_created_24h > 0 && (
          <div className="text-sm font-medium text-foreground">
            +{job.records_created_24h.toLocaleString()}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {job.successes_24h || 0}/{job.runs_24h || 0} OK
        </div>
      </div>
    </div>
  );
}

function BacklogMeter({ 
  label, 
  pending, 
  processed, 
  ingested24h 
}: { 
  label: string; 
  pending: number; 
  processed: number; 
  ingested24h: number;
}) {
  const total = pending + processed;
  const percentage = total > 0 ? (processed / total) * 100 : 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {pending > 0 && <span className="text-status-warning">{pending.toLocaleString()} pending</span>}
          {pending === 0 && <span className="text-status-success">All processed</span>}
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
      <div className="text-[10px] text-muted-foreground">
        {ingested24h.toLocaleString()} ingested in 24h
      </div>
    </div>
  );
}

export function PipelineHealthPanel({ className, compact = false }: PipelineHealthPanelProps) {
  const { data, isLoading, error, refetch, forceRun, isForceRunning } = useAdminPipelineHealth();
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [forceRunType, setForceRunType] = useState<string | null>(null);

  const handleForceRun = (jobType?: string) => {
    setForceRunType(jobType || 'all');
    forceRun({ jobType });
  };

  if (error) {
    return (
      <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-4", className)}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Failed to load pipeline health</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  const overallStatusConfig = data?.overallStatus 
    ? STATUS_CONFIG[data.overallStatus === 'healthy' ? 'ok' : data.overallStatus]
    : STATUS_CONFIG.ok;
  const OverallIcon = overallStatusConfig.icon;

  // Group jobs by category
  const jobsByCategory = (data?.jobs || []).reduce((acc, job) => {
    const category = getJobCategory(job.job_type);
    if (!acc[category]) acc[category] = [];
    acc[category].push(job);
    return acc;
  }, {} as Record<string, PipelineJobHealth[]>);

  const stats = {
    totalJobs: data?.jobs.length || 0,
    healthyJobs: data?.jobs.filter(j => j.freshness_status === 'ok').length || 0,
    staleJobs: data?.jobs.filter(j => j.freshness_status === 'stale' || j.freshness_status === 'warning').length || 0,
    errorJobs: data?.jobs.filter(j => j.freshness_status === 'error').length || 0,
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm",
      overallStatusConfig.borderColor,
      className
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                overallStatusConfig.bgColor
              )}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <OverallIcon className={cn("h-5 w-5", overallStatusConfig.color)} />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Pipeline Health</h3>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? 'Loading...' : (
                    <>
                      {stats.healthyJobs}/{stats.totalJobs} healthy
                      {stats.staleJobs > 0 && <span className="text-status-warning"> • {stats.staleJobs} stale</span>}
                      {stats.errorJobs > 0 && <span className="text-status-error"> • {stats.errorJobs} errors</span>}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleForceRun()}
                disabled={isForceRunning}
                className="hidden sm:flex"
              >
                {isForceRunning ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Force Run All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Summary Stats Row */}
          {!isExpanded && !isLoading && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t">
              {data?.backlog.map(b => (
                <div key={b.pipeline} className="text-xs">
                  <span className="text-muted-foreground">{b.pipeline}:</span>
                  <span className={cn(
                    "ml-1 font-medium",
                    b.pending_count > 0 ? "text-status-warning" : "text-status-success"
                  )}>
                    {b.pending_count > 0 ? `${b.pending_count} pending` : '✓'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4">
            {/* Backlog Section */}
            {data?.backlog && data.backlog.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {data.backlog.map(b => (
                  <BacklogMeter
                    key={b.pipeline}
                    label={b.pipeline.charAt(0).toUpperCase() + b.pipeline.slice(1)}
                    pending={b.pending_count}
                    processed={b.processed_count}
                    ingested24h={b.ingested_24h}
                  />
                ))}
              </div>
            )}

            {/* Jobs by Category */}
            <div className="mt-6 space-y-6">
              {Object.entries(jobsByCategory).map(([category, jobs]) => {
                const categoryConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other;
                const CategoryIcon = categoryConfig.icon;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
                      <h4 className="text-sm font-medium text-foreground">{categoryConfig.label}</h4>
                      <span className="text-xs text-muted-foreground">
                        ({jobs.filter(j => j.freshness_status === 'ok').length}/{jobs.length} healthy)
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {jobs.map(job => (
                        <JobRow key={job.job_type} job={job} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Force Run Button */}
            <div className="mt-4 sm:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleForceRun()}
                disabled={isForceRunning}
                className="w-full"
              >
                {isForceRunning ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Force Run All Jobs
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}