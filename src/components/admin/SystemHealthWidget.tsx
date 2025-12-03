import { useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useSystemHealth, getJobStatusColor, getExecutionStatusBadge } from '@/hooks/useSystemHealth';
import { formatDistanceToNow } from 'date-fns';

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
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthScore = Math.round(
    (stats.successRate * 0.5) + 
    ((1 - stats.failingJobs / Math.max(stats.activeJobs, 1)) * 100 * 0.3) +
    ((1 - stats.unresolvedFailures / 10) * 100 * 0.2)
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <div className="cursor-grab active:cursor-grabbing p-1">
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                ))}
              </div>
            </div>
          )}
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            System Health
          </CardTitle>
          <Badge 
            variant={healthScore >= 90 ? 'default' : healthScore >= 70 ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {healthScore}%
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Health Overview */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-green-500">{stats.activeJobs}</div>
            <div className="text-[10px] text-muted-foreground">Active</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{stats.successRate}%</div>
            <div className="text-[10px] text-muted-foreground">Success</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className={`text-lg font-bold ${stats.failingJobs > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {stats.failingJobs}
            </div>
            <div className="text-[10px] text-muted-foreground">Failing</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className={`text-lg font-bold ${(stats as any).circuitOpenJobs > 0 ? 'text-destructive' : 'text-green-500'}`}>
              {(stats as any).circuitOpenJobs || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Circuits</div>
          </div>
        </div>

        {/* Success Rate Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Job Success Rate</span>
            <span>{stats.successRate}%</span>
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
          <div className="text-xs font-medium text-muted-foreground">Recent Activity</div>
          <ScrollArea className="h-[120px]">
            <div className="space-y-1">
              {recentExecutions.slice(0, 8).map((exec) => {
                const job = jobs.find(j => j.id === exec.job_id);
                return (
                  <div 
                    key={exec.id}
                    className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {exec.status === 'success' ? (
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : exec.status === 'failed' ? (
                        <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                      ) : (
                        <Zap className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{job?.job_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {exec.duration_ms && (
                        <span className="text-[10px] text-muted-foreground">
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
        <div className="pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Avg duration: {stats.avgDurationMs < 1000 
            ? `${stats.avgDurationMs}ms` 
            : `${(stats.avgDurationMs / 1000).toFixed(1)}s`}</span>
          <span>{stats.recentExecutions} recent executions</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemHealthWidget;