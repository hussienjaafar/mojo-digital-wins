import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrendingUp, TrendingDown, AlertTriangle, ArrowLeft, Target, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

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

  const getTrendData = (raceName: string) => {
    const racePolls = racesByState[raceName] || [];
    const sortedPolls = [...racePolls].sort((a, b) => 
      new Date(a.poll_date).getTime() - new Date(b.poll_date).getTime()
    );

    const candidateData: Record<string, any[]> = {};
    sortedPolls.forEach(poll => {
      if (!candidateData[poll.candidate_name]) {
        candidateData[poll.candidate_name] = [];
      }
      candidateData[poll.candidate_name].push({
        date: new Date(poll.poll_date).toLocaleDateString(),
        lead_margin: poll.lead_margin,
        pollster: poll.pollster,
      });
    });

    return { candidateData, sortedPolls };
  };

  const getPartyColor = (party: string) => {
    if (party === "Republican") return "hsl(var(--destructive))";
    if (party === "Democratic") return "hsl(var(--primary))";
    return "hsl(var(--muted-foreground))";
  };

  const unreadAlertsCount = pollingAlerts.filter(alert => !alert.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading polling data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/client/dashboard")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Polling Intelligence</h1>
                <p className="text-sm text-muted-foreground">Track key races and polling trends</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {unreadAlertsCount > 0 && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-foreground">
              You have {unreadAlertsCount} unread polling alert{unreadAlertsCount > 1 ? 's' : ''}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="races" className="space-y-6">
          <TabsList>
            <TabsTrigger value="races">
              <Target className="h-4 w-4 mr-2" />
              Race Trackers
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Polling Alerts {unreadAlertsCount > 0 && `(${unreadAlertsCount})`}
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="h-4 w-4 mr-2" />
              Issue Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="races" className="space-y-6">
            <div className="flex gap-2 mb-4">
              <Button
                variant={selectedRaceType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRaceType("all")}
              >
                All Races
              </Button>
              <Button
                variant={selectedRaceType === "senate" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRaceType("senate")}
              >
                Senate
              </Button>
              <Button
                variant={selectedRaceType === "house" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRaceType("house")}
              >
                House
              </Button>
              <Button
                variant={selectedRaceType === "presidential" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRaceType("presidential")}
              >
                Presidential
              </Button>
            </div>

            {Object.entries(racesByState).map(([raceName, polls]) => {
              const { candidateData, sortedPolls } = getTrendData(raceName);
              const latestPolls = polls.slice(0, 3);
              const leader = latestPolls.reduce((prev, current) => 
                (prev.lead_margin || 0) > (current.lead_margin || 0) ? prev : current
              );

              return (
                <Card key={raceName}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-foreground">{raceName}</CardTitle>
                        <CardDescription>
                          {polls[0]?.poll_type} • Latest: {new Date(polls[0]?.poll_date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-primary text-primary">
                        <Users className="h-3 w-3 mr-1" />
                        {polls.length} polls
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {latestPolls.map((poll) => (
                        <div key={poll.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-foreground">{poll.candidate_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {poll.pollster}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {poll.lead_margin !== null ? `+${poll.lead_margin}` : 'N/A'}%
                            </p>
                            <p className="text-xs text-muted-foreground">±{poll.margin_of_error}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {Object.keys(candidateData).length > 1 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium mb-3 text-foreground">Polling Trend</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={sortedPolls}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="poll_date" 
                              tickFormatter={(date) => new Date(date).toLocaleDateString()}
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                color: "hsl(var(--foreground))"
                              }}
                            />
                            <Legend />
                            {Object.keys(candidateData).map((candidate, idx) => (
                              <Line
                                key={candidate}
                                type="monotone"
                                dataKey="lead_margin"
                                data={candidateData[candidate]}
                                name={candidate}
                                stroke={idx === 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {Object.keys(racesByState).length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No polling data available for selected races</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {pollingAlerts.map((alert) => (
              <Card key={alert.id} className={!alert.is_read ? "border-primary" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {alert.change_amount > 0 ? (
                        <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-destructive mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{alert.state} {alert.poll_type}</h4>
                          {!alert.is_read && (
                            <Badge variant="default" className="text-xs">New</Badge>
                          )}
                          <Badge variant="outline" className={
                            alert.severity === "high" ? "border-destructive text-destructive" : 
                            alert.severity === "medium" ? "border-primary text-primary" : 
                            "border-muted-foreground text-muted-foreground"
                          }>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Change: {alert.change_amount > 0 ? '+' : ''}{alert.change_amount}%</span>
                          <span>Previous: {alert.previous_value}%</span>
                          <span>Current: {alert.current_value}%</span>
                          <span>{new Date(alert.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {!alert.is_read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAlertAsRead(alert.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {pollingAlerts.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No polling alerts available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Coming Soon</CardTitle>
                <CardDescription>Issue polling trends will be available once data is collected</CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Issue trend analysis in development</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
