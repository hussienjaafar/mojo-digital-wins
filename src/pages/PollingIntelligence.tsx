import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, AlertTriangle, Target, Users, BarChart3 } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  V3PageContainer,
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3CardContent,
  V3ChartWrapper,
  V3LoadingState,
  V3EmptyState,
  V3Badge,
  V3Button,
  V3FilterPill,
} from "@/components/v3";
import { EChartsLineChart, type LineSeriesConfig } from "@/components/charts/echarts";
import { getChartColors } from "@/lib/design-tokens";

import { Database } from "@/integrations/supabase/types";

type PollingData = Database['public']['Tables']['polling_data']['Row'];
type PollingAlert = Database['public']['Tables']['polling_alerts']['Row'];

export default function PollingIntelligence() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pollingData, setPollingData] = useState<PollingData[]>([]);
  const [pollingAlerts, setPollingAlerts] = useState<PollingAlert[]>([]);
  const [selectedRaceType, setSelectedRaceType] = useState<string>("all");

  useEffect(() => {
    checkAuth();
    fetchPollingData();
    fetchPollingAlerts();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/client/login");
      return;
    }
    setUser(user);
  };

  const fetchPollingData = async () => {
    try {
      const { data, error } = await supabase
        .from("polling_data")
        .select("*")
        .order("poll_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      setPollingData(data || []);
    } catch (error) {
      console.error("Error fetching polling data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollingAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("polling_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPollingAlerts(data || []);
    } catch (error) {
      console.error("Error fetching polling alerts:", error);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      await supabase
        .from("polling_alerts")
        .update({ is_read: true })
        .eq("id", alertId);
      
      setPollingAlerts(alerts => 
        alerts.map(alert => 
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  };

  const filteredPollingData = selectedRaceType === "all" 
    ? pollingData 
    : pollingData.filter(poll => poll.poll_type === selectedRaceType);

  const racesByState = filteredPollingData.reduce((acc, poll) => {
    const raceName = `${poll.state}${poll.district ? ` - District ${poll.district}` : ''} ${poll.poll_type}`;
    if (!acc[raceName]) {
      acc[raceName] = [];
    }
    acc[raceName].push(poll);
    return acc;
  }, {} as Record<string, PollingData[]>);

  const chartColors = getChartColors();

  const getTrendData = (raceName: string) => {
    const racePolls = racesByState[raceName] || [];
    const sortedPolls = [...racePolls].sort((a, b) => 
      new Date(a.poll_date).getTime() - new Date(b.poll_date).getTime()
    );

    // Get unique candidates
    const candidates = [...new Set(sortedPolls.map(p => p.candidate_name))];

    // Transform data for ECharts - each data point needs all candidate values
    const dateMap = new Map<string, Record<string, number | null>>();
    sortedPolls.forEach(poll => {
      const dateKey = poll.poll_date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey as any });
      }
      const entry = dateMap.get(dateKey)!;
      entry[poll.candidate_name] = poll.lead_margin;
    });

    const chartData = Array.from(dateMap.values()).map(entry => ({
      date: entry.date as unknown as string,
      ...Object.fromEntries(
        candidates.map(c => [c, entry[c] ?? null])
      )
    }));

    // Build series config for each candidate
    const seriesConfig: LineSeriesConfig[] = candidates.map((candidate, idx) => ({
      dataKey: candidate,
      name: candidate,
      color: chartColors[idx % chartColors.length],
      smooth: true,
      showSymbol: true,
    }));

    return { chartData, seriesConfig, sortedPolls, candidates };
  };

  const unreadAlertsCount = pollingAlerts.filter(alert => !alert.is_read).length;

  if (loading) {
    return (
      <ClientShell>
        <div className="p-6">
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6">
            <V3LoadingState variant="chart" />
          </div>
        </div>
      </ClientShell>
    );
  }

  return (
    <ClientShell>
      <V3PageContainer
        title="Polling Intelligence"
        description="Track key races and polling trends"
      >
        {unreadAlertsCount > 0 && (
          <Alert className="mb-6 border-[hsl(var(--portal-accent-red))]/50 bg-[hsl(var(--portal-accent-red))]/10">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-accent-red))]" />
            <AlertDescription className="text-[hsl(var(--portal-text-primary))]">
              You have {unreadAlertsCount} unread polling alert{unreadAlertsCount > 1 ? 's' : ''}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="races" className="space-y-6">
          <TabsList className="bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
            <TabsTrigger value="races" className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <Target className="h-4 w-4 mr-2" />
              Race Trackers
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts {unreadAlertsCount > 0 && `(${unreadAlertsCount})`}
            </TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4 mr-2" />
              Issue Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="races" className="space-y-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              <V3FilterPill
                label="All Races"
                isActive={selectedRaceType === "all"}
                onClick={() => setSelectedRaceType("all")}
              />
              <V3FilterPill
                label="Senate"
                isActive={selectedRaceType === "senate"}
                onClick={() => setSelectedRaceType("senate")}
              />
              <V3FilterPill
                label="House"
                isActive={selectedRaceType === "house"}
                onClick={() => setSelectedRaceType("house")}
              />
              <V3FilterPill
                label="Presidential"
                isActive={selectedRaceType === "presidential"}
                onClick={() => setSelectedRaceType("presidential")}
              />
            </div>

            {Object.entries(racesByState).map(([raceName, polls]) => {
              const { chartData, seriesConfig, candidates } = getTrendData(raceName);
              const latestPolls = polls.slice(0, 3);

              return (
                <V3Card key={raceName}>
                  <V3CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <V3CardTitle>{raceName}</V3CardTitle>
                        <V3CardDescription>
                          {polls[0]?.poll_type} • Latest: {new Date(polls[0]?.poll_date).toLocaleDateString()}
                        </V3CardDescription>
                      </div>
                      <V3Badge variant="info">
                        <Users className="h-3 w-3 mr-1" />
                        {polls.length} polls
                      </V3Badge>
                    </div>
                  </V3CardHeader>
                  <V3CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {latestPolls.map((poll) => (
                        <div key={poll.id} className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-[hsl(var(--portal-text-primary))]">{poll.candidate_name}</p>
                              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                                {poll.pollster}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">
                              {poll.lead_margin !== null ? `+${poll.lead_margin}` : 'N/A'}%
                            </p>
                            <p className="text-xs text-[hsl(var(--portal-text-muted))]">±{poll.margin_of_error}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {candidates.length > 1 && chartData.length > 1 && (
                      <V3ChartWrapper
                        title="Polling Trend"
                        ariaLabel={`Polling trend chart for ${raceName}`}
                      >
                        <EChartsLineChart
                          data={chartData}
                          xAxisKey="date"
                          series={seriesConfig}
                          height={200}
                          xAxisType="time"
                          showLegend={true}
                          valueType="number"
                        />
                      </V3ChartWrapper>
                    )}
                  </V3CardContent>
                </V3Card>
              );
            })}

            {Object.keys(racesByState).length === 0 && (
              <V3EmptyState
                icon={BarChart3}
                title="Polling Data Loading"
                description="We're aggregating polling data from multiple trusted sources. Check back soon for comprehensive race tracking and trend analysis."
                accent="blue"
              />
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {pollingAlerts.map((alert) => (
              <V3Card key={alert.id} className={!alert.is_read ? "border-[hsl(var(--portal-accent-blue))]" : ""}>
                <V3CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {alert.change_amount > 0 ? (
                        <TrendingUp className="h-5 w-5 text-[hsl(var(--portal-accent-green))] mt-0.5" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-[hsl(var(--portal-accent-red))] mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">{alert.state} {alert.poll_type}</h4>
                          {!alert.is_read && (
                            <V3Badge variant="info">New</V3Badge>
                          )}
                          <V3Badge variant={
                            alert.severity === "high" ? "error" : 
                            alert.severity === "medium" ? "warning" : 
                            "muted"
                          }>
                            {alert.severity}
                          </V3Badge>
                        </div>
                        <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-2">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-[hsl(var(--portal-text-muted))]">
                          <span>Change: {alert.change_amount > 0 ? '+' : ''}{alert.change_amount}%</span>
                          <span>Previous: {alert.previous_value}%</span>
                          <span>Current: {alert.current_value}%</span>
                          <span>{new Date(alert.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {!alert.is_read && (
                      <V3Button
                        variant="secondary"
                        size="sm"
                        onClick={() => markAlertAsRead(alert.id)}
                      >
                        Mark Read
                      </V3Button>
                    )}
                  </div>
                </V3CardContent>
              </V3Card>
            ))}

            {pollingAlerts.length === 0 && (
              <V3EmptyState
                icon={AlertTriangle}
                title="No Polling Alerts Yet"
                description="You'll receive alerts here when significant polling shifts are detected in tracked races. Our system monitors changes every 6 hours."
                accent="amber"
              />
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <V3Card>
              <V3CardHeader>
                <V3CardTitle>Coming Soon</V3CardTitle>
                <V3CardDescription>Issue polling trends will be available once data is collected</V3CardDescription>
              </V3CardHeader>
              <V3CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mx-auto mb-4" />
                <p className="text-[hsl(var(--portal-text-muted))]">Issue trend analysis in development</p>
              </V3CardContent>
            </V3Card>
          </TabsContent>
        </Tabs>
      </V3PageContainer>
    </ClientShell>
  );
}
