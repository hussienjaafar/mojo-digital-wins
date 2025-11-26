import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Filter, CheckCircle, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";

type Alert = {
  id: string;
  entity_name: string;
  alert_type: string;
  severity: string;
  actionable_score: number;
  is_actionable: boolean;
  is_read: boolean;
  velocity: number;
  current_mentions: number;
  suggested_action: string | null;
  sample_sources: any;
  triggered_at: string;
  created_at: string;
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

const ClientAlerts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    applyFilters();
  }, [alerts, filterType, filterSeverity]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load organization
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .single();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .single();

      setOrganization(org);

      // Load alerts
      const { data: alertsData, error } = await (supabase as any)
        .from('client_entity_alerts')
        .select('*')
        .eq('organization_id', clientUser.organization_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAlerts(alertsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...alerts];

    if (filterType !== "all") {
      filtered = filtered.filter(a => a.alert_type === filterType);
    }

    if (filterSeverity !== "all") {
      filtered = filtered.filter(a => a.severity === filterSeverity);
    }

    setFilteredAlerts(filtered);
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('client_entity_alerts')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  if (isLoading || !organization) {
    return null;
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const actionableCount = alerts.filter(a => a.is_actionable).length;
  const watchlistAlerts = alerts.filter(a => a.alert_type === "watchlist_match");

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unread Alerts</p>
                  <p className="text-3xl font-bold">{unreadCount}</p>
                </div>
                <Bell className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Actionable</p>
                  <p className="text-3xl font-bold">{actionableCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Watchlist Matches</p>
                  <p className="text-3xl font-bold">{watchlistAlerts.length}</p>
                </div>
                <Filter className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Alert Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="watchlist_match">Watchlist Match</SelectItem>
                    <SelectItem value="velocity_spike">Velocity Spike</SelectItem>
                    <SelectItem value="sentiment_change">Sentiment Change</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Severity</label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Intelligence ({filteredAlerts.length})</TabsTrigger>
            <TabsTrigger value="watchlist">
              My Watchlist ({watchlistAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-4">
              {filteredAlerts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No alerts</h3>
                    <p className="text-muted-foreground text-center">
                      You're all caught up! New alerts will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredAlerts.map((alert) => (
                  <Card 
                    key={alert.id} 
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      !alert.is_read ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {!alert.is_read && (
                              <Badge className="bg-primary">New</Badge>
                            )}
                            {alert.is_actionable && (
                              <Badge className="bg-green-500">Actionable</Badge>
                            )}
                            <Badge variant="outline" className={getSeverityColor(alert.severity || 'low')}>
                              {getSeverityIcon(alert.severity || 'low')}
                              <span className="ml-1">{alert.severity || 'low'}</span>
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{alert.entity_name}</CardTitle>
                          <CardDescription>{alert.alert_type}</CardDescription>
                        </div>
                        {alert.actionable_score > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Score</p>
                            <p className="text-2xl font-bold text-primary">{alert.actionable_score}</p>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Mentions:</span>
                          <span className="font-medium">{alert.current_mentions || 0}</span>
                        </div>
                        {alert.velocity && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Velocity:</span>
                            <span className="font-medium">{alert.velocity.toFixed(1)}/hr</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className="mt-6">
            <div className="space-y-4">
              {watchlistAlerts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No watchlist alerts</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Add entities to your watchlist to start receiving alerts
                    </p>
                    <Button onClick={() => navigate('/client/watchlist')}>
                      Manage Watchlist
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                watchlistAlerts.map((alert) => (
                  <Card 
                    key={alert.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      !alert.is_read ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {!alert.is_read && (
                              <Badge className="bg-primary">New</Badge>
                            )}
                            {alert.is_actionable && (
                              <Badge className="bg-green-500">Actionable</Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg">{alert.entity_name}</CardTitle>
                        </div>
                        {alert.actionable_score > 0 && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Score</p>
                            <p className="text-2xl font-bold text-primary">{alert.actionable_score}</p>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAlert?.entity_name}</DialogTitle>
            <DialogDescription>{selectedAlert?.alert_type}</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getSeverityColor(selectedAlert.severity || 'low')}>
                  {getSeverityIcon(selectedAlert.severity || 'low')}
                  <span className="ml-1">{selectedAlert.severity || 'low'}</span>
                </Badge>
                {selectedAlert.is_actionable && (
                  <Badge className="bg-green-500">Actionable (Score: {selectedAlert.actionable_score})</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y">
                <div>
                  <p className="text-sm text-muted-foreground">Current Mentions</p>
                  <p className="text-2xl font-bold">{selectedAlert.current_mentions || 0}</p>
                </div>
                {selectedAlert.velocity && (
                  <div>
                    <p className="text-sm text-muted-foreground">Velocity</p>
                    <p className="text-2xl font-bold">{selectedAlert.velocity.toFixed(1)}/hr</p>
                  </div>
                )}
              </div>

              {selectedAlert.suggested_action && (
                <div>
                  <h4 className="font-semibold mb-2">Suggested Action</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlert.suggested_action}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => {
                  markAsRead(selectedAlert.id);
                  setSelectedAlert(null);
                }} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Read
                </Button>
                {selectedAlert.is_actionable && (
                  <Button variant="secondary" onClick={() => navigate('/client/actions')} className="flex-1">
                    View Actions
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientAlerts;
