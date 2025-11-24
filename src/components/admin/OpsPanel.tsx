import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Activity, Clock, AlertTriangle, CheckCircle, Server, Play, Terminal, TrendingUp, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ScheduledJob {
  id: string;
  job_name: string;
  job_type: string;
  schedule?: string; // new schema
  cron_expression?: string; // legacy schema
  is_active?: boolean;
  is_enabled?: boolean; // legacy schema
  last_run_at?: string | null;
  last_run_status?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
}

interface JobFailure {
  id: string;
  function_name: string;
  error_message: string;
  created_at: string;
}

interface BackfillMonitoringRow {
  unprocessed: number | null;
  processed: number | null;
  completion_percentage: number | null;
  processed_last_hour: number | null;
  processed_last_day: number | null;
  posts_per_minute: number | null;
  hours_remaining_at_current_rate: number | null;
  status: string | null;
}

function Sparkline({ data, width = 120, height = 30, color = "hsl(var(--primary))" }: { data: number[]; width?: number; height?: number; color?: string }) {
  const path = useMemo(() => {
    if (!data || data.length === 0) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = Math.max(1, max - min);
    const stepX = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${x},${isFinite(y) ? y : height}`;
    });
    return `M ${points[0]} L ${points.slice(1).join(" ")}`;
  }, [data, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function OpsPanel() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [failures, setFailures] = useState<JobFailure[]>([]);
  const [articlesPending, setArticlesPending] = useState<number>(0);
  const [blueskyPending, setBlueskyPending] = useState<number>(0);
  const [blueskyUpdatedAt, setBlueskyUpdatedAt] = useState<string | null>(null);
  const [backfillStats, setBackfillStats] = useState<BackfillMonitoringRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [trendResult, setTrendResult] = useState<any>(null);
  const [correlateResult, setCorrelateResult] = useState<any>(null);

  // Session sparkline data (last 20 samples)
  const [articleTrend, setArticleTrend] = useState<number[]>([]);
  const [blueskyTrend, setBlueskyTrend] = useState<number[]>([]);

  const freshness = (ts?: string | null) => ts ? formatDistanceToNow(new Date(ts), { addSuffix: true }) : 'never';
  const isActive = (j: ScheduledJob) => (j.is_active ?? j.is_enabled) ? true : false;
  const scheduleOf = (j: ScheduledJob) => j.schedule || j.cron_expression || '';

  const pushTrend = (arrSetter: React.Dispatch<React.SetStateAction<number[]>>, value: number) => {
    arrSetter(prev => {
      const next = [...prev, value];
      return next.length > 20 ? next.slice(next.length - 20) : next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Scheduled jobs
      const { data: sj } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .order('job_name');
      setJobs((sj as any) || []);

      // Recent failures
      const { data: jf } = await supabase
        .from('job_failures')
        .select('id,function_name,error_message,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      setFailures((jf as any) || []);

      // Articles pending analysis
      const { count: ap } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .or('affected_groups.is.null,relevance_category.is.null');
      const apNum = ap || 0;
      setArticlesPending(apNum);
      pushTrend(setArticleTrend, apNum);

      // Bluesky pending
      const { count: bp } = await supabase
        .from('bluesky_posts')
        .select('*', { count: 'exact', head: true })
        .eq('ai_processed', false)
        .gte('ai_relevance_score', 0.1);
      const bpNum = bp || 0;
      setBlueskyPending(bpNum);
      pushTrend(setBlueskyTrend, bpNum);

      // Bluesky stream cursor
      const { data: cursor } = await supabase
        .from('bluesky_stream_cursor')
        .select('last_updated_at')
        .eq('id', 1)
        .maybeSingle();
      setBlueskyUpdatedAt(cursor?.last_updated_at || null);

      // Skip backfill monitoring for now
      setBackfillStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const id = window.setInterval(loadData, 60000); // refresh every minute
    return () => window.clearInterval(id);
  }, []);

  const runDiagnostics = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-diagnostics', { body: {} });
      if (error) throw error;
      setDiagResult(data);
    } catch (e: any) {
      setDiagResult({ error: e?.message || 'Failed to run diagnostics' });
    } finally {
      setRunning(false);
    }
  };

  const triggerAnalyzeArticles = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-articles', {
        body: { batchSize: 10, requestDelayMs: 500 }
      });
      if (error) throw error;
      await loadData();
      setDiagResult((prev: any) => ({ ...prev, analyzeArticles: data }));
    } catch (e: any) {
      setDiagResult((prev: any) => ({ ...prev, analyzeArticlesError: e?.message || 'Failed to trigger analyze-articles' }));
    } finally {
      setRunning(false);
    }
  };

  const triggerBlueskyTrends = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-bluesky-trends', { body: {} });
      if (error) throw error;
      setTrendResult(data);
    } catch (e: any) {
      setTrendResult({ error: e?.message || 'Failed to run calculate-bluesky-trends' });
    } finally {
      setRunning(false);
    }
  };

  const triggerCorrelate = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('correlate-social-news', { body: {} });
      if (error) throw error;
      setCorrelateResult(data);
    } catch (e: any) {
      setCorrelateResult({ error: e?.message || 'Failed to run correlate-social-news' });
    } finally {
      setRunning(false);
    }
  };

  // Basic SLA checks
  const blueskySLA = useMemo(() => {
    if (!backfillStats) return { label: 'Unknown', variant: 'outline' as const };
    const ok = (backfillStats.posts_per_minute ?? 0) >= 2 && (backfillStats.hours_remaining_at_current_rate ?? 99) < 2;
    return ok ? { label: 'On track', variant: 'secondary' as const } : { label: 'Behind', variant: 'destructive' as const };
  }, [backfillStats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-stretch">
        <Card className="min-w-[280px] flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Articles Pending</CardTitle>
            <CardDescription>Needs AI analysis (target: {'>'}80% in 10m)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div className="text-3xl font-bold">{articlesPending}</div>
              <Sparkline data={articleTrend} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">Session trend (last {articleTrend.length} samples)</div>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Bluesky Pending</CardTitle>
            <CardDescription>Queued for processing (target: {'<'} 2h backlog)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div className="text-3xl font-bold">{blueskyPending}</div>
              <Sparkline data={blueskyTrend} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">Stream updated {freshness(blueskyUpdatedAt)}</div>
            {backfillStats && (
              <div className="mt-2 text-xs text-muted-foreground">
                <div>Processed last hour: {backfillStats.processed_last_hour ?? 0} • Rate: {(backfillStats.posts_per_minute ?? 0).toFixed(2)}/min</div>
                <div>ETA: {backfillStats.hours_remaining_at_current_rate ? `${backfillStats.hours_remaining_at_current_rate.toFixed(1)}h` : 'n/a'} • Status: {backfillStats.status}</div>
                <Badge className="mt-1" variant={blueskySLA.variant}>{blueskySLA.label}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-[220px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Jobs</CardTitle>
            <CardDescription>Active schedules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{jobs.filter(j => isActive(j)).length}</div>
            <div className="text-xs text-muted-foreground mt-1">{jobs.length} total</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={loadData} variant="secondary" disabled={loading || running} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
        <Button onClick={runDiagnostics} variant="default" disabled={running} className="gap-2">
          <Terminal className="h-4 w-4" /> Run Diagnostics
        </Button>
        <Button onClick={triggerAnalyzeArticles} variant="outline" disabled={running} className="gap-2">
          <Play className="h-4 w-4" /> Kick Analyze Articles
        </Button>
        <Button onClick={triggerBlueskyTrends} variant="outline" disabled={running} className="gap-2">
          <TrendingUp className="h-4 w-4" /> Run Bluesky Trends
        </Button>
        <Button onClick={triggerCorrelate} variant="outline" disabled={running} className="gap-2">
          <Sparkles className="h-4 w-4" /> Correlate Social ↔ News
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>Last run status and upcoming schedules</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.job_name}</TableCell>
                  <TableCell>{j.job_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{scheduleOf(j)}</TableCell>
                  <TableCell>{freshness(j.last_run_at)}</TableCell>
                  <TableCell>{freshness(j.next_run_at)}</TableCell>
                  <TableCell>
                    {j.last_run_status === 'success' && (
                      <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> ok</Badge>
                    )}
                    {j.last_run_status === 'failed' && (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> failed</Badge>
                    )}
                    {!j.last_run_status && (
                      <Badge variant="outline">never</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {jobs.some(j => j.last_error) && (
            <Alert className="mt-3" variant="destructive">
              <AlertDescription>Some jobs report recent errors. Check failures below.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Failures</CardTitle>
          <CardDescription>Last 10 entries from job_failures</CardDescription>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent failures.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Function</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap text-xs">{freshness(f.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{f.function_name}</TableCell>
                    <TableCell className="text-xs max-w-[700px] truncate" title={f.error_message}>{f.error_message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(trendResult || correlateResult || diagResult) && (
        <Card>
          <CardHeader>
            <CardTitle>Function Runs</CardTitle>
            <CardDescription>Last outputs from panel-triggered runs</CardDescription>
          </CardHeader>
          <CardContent>
            {trendResult && (
              <div className="mb-3">
                <div className="text-sm font-medium mb-1">calculate-bluesky-trends</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded-md max-h-[240px] overflow-auto">{JSON.stringify(trendResult, null, 2)}</pre>
              </div>
            )}
            {correlateResult && (
              <div className="mb-3">
                <div className="text-sm font-medium mb-1">correlate-social-news</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded-md max-h-[240px] overflow-auto">{JSON.stringify(correlateResult, null, 2)}</pre>
              </div>
            )}
            {diagResult && (
              <div>
                <div className="text-sm font-medium mb-1">run-diagnostics</div>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded-md max-h-[240px] overflow-auto">{JSON.stringify(diagResult, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
