import { useState } from "react";
import { useRedirectClicksQuery } from "@/hooks/useRedirectClicksQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EChartsLineChart } from "@/components/charts/echarts/EChartsLineChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MousePointerClick, 
  Users, 
  Facebook, 
  Cookie, 
  TrendingUp,
  Loader2,
  RefreshCw 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RedirectLinkAnalyticsProps {
  organizationId?: string;
  title?: string;
}

export function RedirectLinkAnalytics({ 
  organizationId, 
  title = "Redirect Link Performance" 
}: RedirectLinkAnalyticsProps) {
  const [daysBack, setDaysBack] = useState(30);
  const { data, isLoading, error, refetch, isFetching } = useRedirectClicksQuery(organizationId, daysBack);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load click data</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.summary.totalClicks === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              {title}
            </CardTitle>
            <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No redirect link clicks recorded yet.
            <br />
            <span className="text-sm">Clicks will appear here when users visit your tracked links.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, byRefcode, dailyTrend } = data;

  // Prepare chart data
  const chartData = dailyTrend.map((d) => ({
    date: d.date,
    "Total Clicks": d.clicks,
    "Meta Ad Clicks": d.metaClicks,
  }));

  const getCaptureRateBadge = (rate: number) => {
    if (rate >= 70) return <Badge variant="default">Excellent</Badge>;
    if (rate >= 50) return <Badge variant="secondary">Good</Badge>;
    if (rate >= 30) return <Badge variant="outline">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <MousePointerClick className="h-4 w-4" />
              Total Clicks
            </div>
            <div className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Unique Sessions
            </div>
            <div className="text-2xl font-bold">{summary.uniqueSessions.toLocaleString()}</div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Facebook className="h-4 w-4" />
              Meta Ad Clicks
            </div>
            <div className="text-2xl font-bold">{summary.metaAdClicks.toLocaleString()}</div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Cookie className="h-4 w-4" />
              Cookie Capture
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{summary.cookieCaptureRate}%</span>
              {getCaptureRateBadge(summary.cookieCaptureRate)}
            </div>
          </div>
        </div>

        {/* Daily Trend Chart */}
        {chartData.length > 1 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Daily Click Trend
            </h4>
            <EChartsLineChart
              data={chartData}
              xAxisKey="date"
              series={[
                { dataKey: "Total Clicks", name: "Total Clicks", color: "#3b82f6" },
                { dataKey: "Meta Ad Clicks", name: "Meta Ad Clicks", color: "#8b5cf6" },
              ]}
              height={200}
              showLegend
            />
          </div>
        )}

        {/* Refcode Breakdown Table */}
        {byRefcode.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Performance by Refcode
            </h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Refcode</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Cookie Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byRefcode.slice(0, 10).map((row) => (
                    <TableRow key={row.refcode}>
                      <TableCell className="font-mono text-sm">
                        {row.refcode}
                      </TableCell>
                      <TableCell className="text-right">{row.totalClicks}</TableCell>
                      <TableCell className="text-right">{row.uniqueSessions}</TableCell>
                      <TableCell className="text-right">{row.metaAdClicks}</TableCell>
                      <TableCell className="text-right">
                        <span className={
                          row.cookieCaptureRate >= 70 ? "text-green-600" :
                          row.cookieCaptureRate >= 50 ? "text-yellow-600" :
                          row.cookieCaptureRate >= 30 ? "text-orange-500" :
                          "text-destructive"
                        }>
                          {row.cookieCaptureRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {byRefcode.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing top 10 of {byRefcode.length} refcodes
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
