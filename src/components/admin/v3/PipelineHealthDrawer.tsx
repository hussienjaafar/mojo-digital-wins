import { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle, 
  RefreshCw, 
  Play, 
  Activity,
  Database,
  Zap,
  TrendingUp,
  Bell,
  Mail,
  Loader2,
  AlertTriangle,
  ChevronDown,
  History,
  Gauge,
  Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  useAdminPipelineHealth, 
  getJobDisplayName, 
  getJobCategory, 
  formatDuration, 
  formatTimeAgo, 
  type PipelineJobHealth 
} from '@/hooks/useAdminPipelineHealth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PipelineHealthDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  ok: { 
    icon: CheckCircle, 
    color: 'text-status-success', 
    bgColor: 'bg-status-success/10',
    label: 'OK' 
  },
  warning: { 
    icon: Clock, 
    color: 'text-status-warning', 
    bgColor: 'bg-status-warning/10',
    label: 'Warning' 
  },
  stale: { 
    icon: AlertTriangle, 
    color: 'text-status-warning', 
    bgColor: 'bg-status-warning/10',
    label: 'Stale' 
  },
  error: { 
    icon: XCircle, 
    color: 'text-status-error', 
    bgColor: 'bg-status-error/10',
    label: 'Error' 
  },
};

const CATEGORY_CONFIG = {
  ingestion: { icon: Database, label: 'Ingestion', color: 'text-blue-400' },
  processing: { icon: Zap, label: 'Processing', color: 'text-purple-400' },
  trends: { icon: TrendingUp, label: 'Trends', color: 'text-green-400' },
  alerting: { icon: Bell, label: 'Alerting', color: 'text-orange-400' },
  notifications: { icon: Mail, label: 'Notify', color: 'text-pink-400' },
  other: { icon: Activity, label: 'Other', color: 'text-muted-foreground' },
};

function StatusBadge({ status }: { status: PipelineJobHealth['freshness_status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-[10px] font-medium h-5",
        config.bgColor,
        config.color
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  );
}

function ExpandableJobRow({ job }: { job: PipelineJobHealth }) {
  const [isOpen, setIsOpen] = useState(false);
  const category = getJobCategory(job.job_type);
  const categoryConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow 
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          job.freshness_status === 'error' && "bg-status-error/5"
        )}
      >
        <TableCell className="font-medium py-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-left w-full">
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform text-muted-foreground",
                isOpen && "rotate-180"
              )} />
              <span className={cn("text-xs", categoryConfig.color)}>
                {categoryConfig.label}
              </span>
              <span className="text-sm">{getJobDisplayName(job.job_type)}</span>
            </button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="py-2 text-xs text-muted-foreground">
          {formatTimeAgo(job.last_run_at)}
        </TableCell>
        <TableCell className="py-2">
          <StatusBadge status={job.freshness_status} />
        </TableCell>
        <TableCell className="py-2 text-xs text-center">
          {job.runs_24h || 0}
        </TableCell>
        <TableCell className="py-2 text-xs text-center">
          <span className={cn(
            (job.failures_24h || 0) > 0 && "text-status-error font-medium"
          )}>
            {job.failures_24h || 0}
          </span>
        </TableCell>
        <TableCell className="py-2 text-xs text-right tabular-nums">
          {job.records_created_24h?.toLocaleString() || '-'}
        </TableCell>
      </TableRow>
      
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="py-3 px-8">
            <div className="space-y-2 text-xs">
              {job.last_error && (
                <div className="p-2 rounded bg-status-error/10 border border-status-error/20">
                  <span className="text-status-error font-medium">Last Error: </span>
                  <span className="text-muted-foreground">{job.last_error}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 text-muted-foreground">
                <div>
                  <span className="block text-foreground/70">Duration</span>
                  {formatDuration(job.last_duration_ms)}
                </div>
                <div>
                  <span className="block text-foreground/70">Avg Duration (24h)</span>
                  {formatDuration(job.avg_duration_ms_24h)}
                </div>
                <div>
                  <span className="block text-foreground/70">Success Rate</span>
                  {job.runs_24h && job.runs_24h > 0 
                    ? `${Math.round(((job.successes_24h || 0) / job.runs_24h) * 100)}%`
                    : '-'
                  }
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
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
    <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className={cn(
          "text-[10px]",
          pending > 0 ? "text-status-warning border-status-warning/30" : "text-status-success border-status-success/30"
        )}>
          {pending > 0 ? `${pending.toLocaleString()} pending` : 'Clear'}
        </Badge>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{processed.toLocaleString()} processed</span>
        <span>{ingested24h.toLocaleString()} ingested today</span>
      </div>
    </div>
  );
}

export function PipelineHealthDrawer({ open, onOpenChange }: PipelineHealthDrawerProps) {
  const { data, isLoading, error, refetch, forceRun, isForceRunning } = useAdminPipelineHealth();
  const [activeTab, setActiveTab] = useState('health');

  const handleForceRun = (jobType?: string) => {
    forceRun({ jobType }, {
      onSuccess: () => {
        toast.success(jobType ? `${getJobDisplayName(jobType)} triggered` : 'All jobs triggered');
      },
      onError: (err) => {
        toast.error('Failed to trigger jobs', { description: err.message });
      }
    });
  };

  const handleBackfill = (hours: number) => {
    forceRun({ backfillHours: hours }, {
      onSuccess: () => {
        toast.success(`Backfill started for last ${hours} hours`);
      },
      onError: (err) => {
        toast.error('Backfill failed', { description: err.message });
      }
    });
  };

  const overallStatusConfig = data?.overallStatus 
    ? STATUS_CONFIG[data.overallStatus === 'healthy' ? 'ok' : data.overallStatus]
    : STATUS_CONFIG.ok;
  const OverallIcon = overallStatusConfig.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded", overallStatusConfig.bgColor)}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <OverallIcon className={cn("h-4 w-4", overallStatusConfig.color)} />
                )}
              </div>
              Pipeline Health
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <SheetDescription>
            {isLoading ? 'Loading pipeline status...' : (
              <>
                {data?.jobs.filter(j => j.freshness_status === 'ok').length || 0} of {data?.jobs.length || 0} jobs healthy
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="mt-6 p-4 rounded-lg bg-status-error/10 border border-status-error/30">
            <div className="flex items-center gap-2 text-status-error">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Failed to load pipeline data</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="health" className="text-xs gap-1">
                <Activity className="h-3 w-3" />
                Health
              </TabsTrigger>
              <TabsTrigger value="backlog" className="text-xs gap-1">
                <Gauge className="h-3 w-3" />
                Backlog
              </TabsTrigger>
              <TabsTrigger value="runs" className="text-xs gap-1">
                <History className="h-3 w-3" />
                Runs
              </TabsTrigger>
              <TabsTrigger value="controls" className="text-xs gap-1">
                <Settings2 className="h-3 w-3" />
                Controls
              </TabsTrigger>
            </TabsList>

            {/* Health Tab - Dense Job Table */}
            <TabsContent value="health" className="mt-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs h-9">Job</TableHead>
                      <TableHead className="text-xs h-9">Last Run</TableHead>
                      <TableHead className="text-xs h-9">Status</TableHead>
                      <TableHead className="text-xs h-9 text-center">24h Runs</TableHead>
                      <TableHead className="text-xs h-9 text-center">Failures</TableHead>
                      <TableHead className="text-xs h-9 text-right">Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.jobs.map(job => (
                        <ExpandableJobRow key={job.job_type} job={job} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Backlog Tab */}
            <TabsContent value="backlog" className="mt-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : data?.backlog && data.backlog.length > 0 ? (
                data.backlog.map(b => (
                  <BacklogMeter
                    key={b.pipeline}
                    label={b.pipeline.charAt(0).toUpperCase() + b.pipeline.slice(1)}
                    pending={b.pending_count}
                    processed={b.processed_count}
                    ingested24h={b.ingested_24h}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No backlog data available</p>
                </div>
              )}
            </TabsContent>

            {/* Runs Tab - Placeholder for pipeline_runs table */}
            <TabsContent value="runs" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Run history coming soon</p>
                <p className="text-xs mt-1">Pipeline runs will be logged here</p>
              </div>
            </TabsContent>

            {/* Controls Tab */}
            <TabsContent value="controls" className="mt-4 space-y-4">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-medium text-sm mb-3">Force Run</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Trigger pipeline jobs immediately, bypassing schedule.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleForceRun()}
                    disabled={isForceRunning}
                  >
                    {isForceRunning ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    Run All Jobs
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-medium text-sm mb-3">Backfill</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Reprocess historical data for a time window.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleBackfill(24)}
                    disabled={isForceRunning}
                  >
                    Last 24 hours
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleBackfill(168)}
                    disabled={isForceRunning}
                  >
                    Last 7 days
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
