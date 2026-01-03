import { useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useSystemHealth, getJobStatusColor, getExecutionStatusBadge } from '@/hooks/useSystemHealth';
import { formatDistanceToNow } from 'date-fns';
import { V3Button } from '@/components/v3/V3Button';

interface SystemHealthWidgetProps {
  showDragHandle?: boolean;
}

export function SystemHealthWidget({ showDragHandle = false }: SystemHealthWidgetProps) {
  const { jobs, recentExecutions, failures, stats, isLoading, refresh } = useSystemHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="portal-card h-full">
        <div className="p-4 pb-2">
          <div className="portal-skeleton h-5 w-40" />
        </div>
        <div className="p-4 pt-0 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="portal-skeleton h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const healthScore = Math.round(
    (stats.successRate * 0.5) + 
    ((1 - stats.failingJobs / Math.max(stats.activeJobs, 1)) * 100 * 0.3) +
    ((1 - stats.unresolvedFailures / 10) * 100 * 0.2)
  );

  return (
    <div className="portal-card h-full flex flex-col">
      <div className="p-4 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <div className="cursor-grab active:cursor-grabbing p-1">
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-text-muted))]/30" />
                ))}
              </div>
            </div>
          )}
          <h3 className="text-base font-medium flex items-center gap-2 portal-text-primary">
            <Activity className="h-4 w-4 text-blue-500" />
            System Health
          </h3>
          <Badge 
            variant={healthScore >= 90 ? 'default' : healthScore >= 70 ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {healthScore}%
          </Badge>
        </div>
        <V3Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
        >
          <RefreshCw className="h-4 w-4" />
        </V3Button>
      </div>
      <div className="p-4 pt-0 space-y-4 flex-1">
        {/* Health Overview */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
            <div className="text-lg font-bold text-green-500">{stats.activeJobs}</div>
            <div className="text-[10px] portal-text-muted">Active</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
            <div className="text-lg font-bold portal-text-primary">{stats.successRate}%</div>
            <div className="text-[10px] portal-text-muted">Success</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
            <div className={`text-lg font-bold ${stats.failingJobs > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {stats.failingJobs}
            </div>
            <div className="text-[10px] portal-text-muted">Failing</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
            <div className={`text-lg font-bold ${(stats as any).circuitOpenJobs > 0 ? 'text-destructive' : 'text-green-500'}`}>
              {(stats as any).circuitOpenJobs || 0}
            </div>
            <div className="text-[10px] portal-text-muted">Circuits</div>
          </div>
        </div>

        {/* Success Rate Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="portal-text-muted">Job Success Rate</span>
            <span className="portal-text-primary">{stats.successRate}%</span>
          </div>
          <Progress value={stats.successRate} className="h-1.5" />
        </div>

        {/* Unresolved Failures */}
        {failures.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertCircle className="h-3 w-3" />
              Unresolved Failures ({failures.length})
            </div>
            <ScrollArea className="h-[80px]">
              <div className="space-y-1">
                {failures.slice(0, 3).map((f) => (
                  <div 
                    key={f.id} 
                    className="text-xs p-1.5 rounded bg-destructive/10 border border-destructive/20"
                  >
                    <div className="font-medium truncate">{f.function_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {f.error_message?.slice(0, 50)}...
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Recent Executions */}
        <div className="space-y-2">
          <div className="text-xs font-medium portal-text-muted">Recent Activity</div>
          <ScrollArea className="h-[120px]">
            <div className="space-y-1">
              {recentExecutions.slice(0, 8).map((exec) => {
                const job = jobs.find(j => j.id === exec.job_id);
                return (
                  <div 
                    key={exec.id}
                    className="flex items-center justify-between p-1.5 rounded bg-[hsl(var(--portal-bg-tertiary))] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {exec.status === 'success' ? (
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : exec.status === 'failed' ? (
                        <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                      ) : (
                        <Zap className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate portal-text-primary">{job?.job_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {exec.duration_ms && (
                        <span className="text-[10px] portal-text-muted">
                          {exec.duration_ms < 1000 
                            ? `${exec.duration_ms}ms` 
                            : `${(exec.duration_ms / 1000).toFixed(1)}s`}
                        </span>
                      )}
                      <Badge className={`text-[9px] px-1 py-0 ${getExecutionStatusBadge(exec.status)}`}>
                        {exec.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Footer Stats */}
        <div className="pt-2 border-t border-[hsl(var(--portal-border))] space-y-2">
          <div className="flex items-center justify-between text-[10px] portal-text-muted">
            <span>Avg duration: {stats.avgDurationMs < 1000 
              ? `${stats.avgDurationMs}ms` 
              : `${(stats.avgDurationMs / 1000).toFixed(1)}s`}</span>
            <span>{stats.recentExecutions} recent executions</span>
          </div>
          
          {/* Optimization Status */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20">
              Smart Skip
            </Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20">
              4hr Throttle
            </Badge>
            <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-600 border-purple-500/20">
              Batch AI
            </Badge>
            <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-600 border-orange-500/20">
              Dependencies
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemHealthWidget;