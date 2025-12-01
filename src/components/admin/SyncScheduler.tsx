import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
  Settings,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import type { Database } from "@/integrations/supabase/types";

type ScheduledJob = Database['public']['Tables']['scheduled_jobs']['Row'];
type JobExecution = Database['public']['Tables']['job_executions']['Row'];

const SyncScheduler = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [isRunningAll, setIsRunningAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch scheduled jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .order('job_name');

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch recent executions
      const { data: execData, error: execError } = await supabase
        .from('job_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (execError) throw execError;
      setExecutions(execData || []);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleJob = async (jobId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({ is_active: isEnabled, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(j => j.id === jobId ? { ...j, is_active: isEnabled } : j));

      toast({
        title: isEnabled ? "Job Enabled" : "Job Disabled",
        description: `The scheduled job has been ${isEnabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    }
  };

  const runJobNow = async (job: ScheduledJob) => {
    setRunningJobs(prev => new Set(prev).add(job.id));

    try {
      toast({
        title: "Running job...",
        description: `Starting ${job.job_name}`,
      });

      const { data, error } = await supabase.functions.invoke('run-scheduled-jobs', {
        body: { job_type: job.job_type, force: true }
      });

      if (error) throw error;

      const result = data?.results?.[0];

      if (result?.status === 'success') {
        toast({
          title: "Job completed",
          description: `${job.job_name} finished successfully in ${result.duration_ms}ms`,
        });
      } else {
        toast({
          title: "Job failed",
          description: result?.error || "Unknown error",
          variant: "destructive",
        });
      }

      // Refresh data
      await loadData();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to run job",
        variant: "destructive",
      });
    } finally {
      setRunningJobs(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const runAllJobs = async () => {
    setIsRunningAll(true);
    try {
      toast({
        title: "Running all jobs...",
        description: "Starting all enabled scheduled jobs",
      });

      const { data, error } = await supabase.functions.invoke('run-scheduled-jobs', {
        body: { force: true }
      });

      if (error) throw error;

      const successCount = data?.successful ?? data?.results?.filter((r: any) => r.status === 'success')?.length ?? 0;
      const failedCount = data?.failed ?? data?.results?.filter((r: any) => r.status === 'failed')?.length ?? 0;

      toast({
        title: "Jobs completed",
        description: `${successCount} successful, ${failedCount} failed`,
      });

      await loadData();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to run jobs",
        variant: "destructive",
      });
    } finally {
      setIsRunningAll(false);
    }
  };

  const updateCronExpression = async (jobId: string, cronExpression: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({
          cron_expression: cronExpression,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(j => j.id === jobId ? { ...j, cron_expression: cronExpression } : j));

      toast({
        title: "Schedule Updated",
        description: "The cron expression has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update schedule",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="secondary">Never Run</Badge>;
    }
  };

  const getJobName = (jobId: string) => {
    return jobs.find(j => j.id === jobId)?.job_name || 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Sync Scheduler</h2>
            <p className="text-sm portal-text-secondary">Loading sync configuration...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="portal-skeleton h-6 w-32" />
              <div className="portal-skeleton h-4 w-full" />
              <div className="flex gap-2 mt-4">
                <div className="portal-skeleton h-8 w-24" />
                <div className="portal-skeleton h-8 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-7 w-7" />
            Job Scheduler
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage automated data fetching and processing jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={runAllJobs} disabled={isRunningAll}>
            {isRunningAll ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {isRunningAll ? "Running..." : "Run All Now"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Scheduled Jobs
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Execution History
          </TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Jobs</CardTitle>
              <CardDescription>
                Configure and manage automated data synchronization jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(job.last_run_status)}
                            <h4 className="font-semibold">{job.job_name}</h4>
                            {getStatusBadge(job.last_run_status)}
                        </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {job.job_type}
                          </p>
                      </div>
                      <Switch
                        checked={job.is_active}
                        onCheckedChange={(checked) => toggleJob(job.id, checked)}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Schedule</Label>
                        <p className="text-xs mt-1 font-mono">
                          {job.schedule}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Run</Label>
                        <p className="text-xs mt-1">
                          {job.last_run_at
                            ? formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })
                            : 'Never'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Next Run</Label>
                        <p className="text-xs mt-1">
                          {job.next_run_at
                            ? formatDistanceToNow(new Date(job.next_run_at), { addSuffix: true })
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <p className="text-xs mt-1">
                          {job.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runJobNow(job)}
                        disabled={runningJobs.has(job.id)}
                      >
                        {runningJobs.has(job.id) ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {runningJobs.has(job.id) ? 'Running...' : 'Run Now'}
                      </Button>
                    </div>
                  </div>
                ))}

                {jobs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled jobs found. Run the migration to create default jobs.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                Recent job execution logs and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell className="font-medium">
                          {getJobName(exec.job_id)}
                        </TableCell>
                        <TableCell>{getStatusBadge(exec.status)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(exec.started_at), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {exec.duration_ms ? `${exec.duration_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {exec.result && typeof exec.result === 'object' && 'items_processed' in exec.result && (
                            <span>{(exec.result as any).items_processed} processed</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                          {exec.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {executions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No execution history yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cron Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cron Expression Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div>
              <code className="bg-muted px-1 rounded">*/30 * * * *</code>
              <p className="text-muted-foreground mt-1">Every 30 min</p>
            </div>
            <div>
              <code className="bg-muted px-1 rounded">0 */4 * * *</code>
              <p className="text-muted-foreground mt-1">Every 4 hours</p>
            </div>
            <div>
              <code className="bg-muted px-1 rounded">0 6,18 * * *</code>
              <p className="text-muted-foreground mt-1">6 AM & 6 PM</p>
            </div>
            <div>
              <code className="bg-muted px-1 rounded">0 8 * * *</code>
              <p className="text-muted-foreground mt-1">Daily at 8 AM</p>
            </div>
            <div>
              <code className="bg-muted px-1 rounded">0 0 * * 1</code>
              <p className="text-muted-foreground mt-1">Weekly Monday</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncScheduler;
