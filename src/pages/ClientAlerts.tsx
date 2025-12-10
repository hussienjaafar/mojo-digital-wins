import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bell, Filter, CheckCircle, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3KPICard,
  V3PageContainer,
  V3LoadingState,
  V3EmptyState,
} from "@/components/v3";
import { cn } from "@/lib/utils";

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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
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
      
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .maybeSingle();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .maybeSingle();

      if (!org) throw new Error("Organization not found");
      setOrganization(org);

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
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-error))]" />;
      case "medium":
        return <Info className="h-4 w-4 text-[hsl(var(--portal-warning))]" />;
      default:
        return <Info className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]";
      case "medium":
        return "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.2)]";
      default:
        return "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.2)]";
    }
  };

  const getAccentFromSeverity = (severity: string): "red" | "amber" | "blue" => {
    switch (severity) {
      case "high": return "red";
      case "medium": return "amber";
      default: return "blue";
    }
  };

  if (isLoading) {
    return (
      <ClientLayout>
        <V3PageContainer icon={Bell} title="Alerts" description="Loading...">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <V3LoadingState variant="kpi" />
              <V3LoadingState variant="kpi" />
              <V3LoadingState variant="kpi" />
            </div>
            <V3LoadingState variant="channel" />
            <V3LoadingState variant="channel" />
          </div>
        </V3PageContainer>
      </ClientLayout>
    );
  }

  if (!organization) {
    return (
      <ClientLayout>
        <V3PageContainer icon={Bell} title="Alerts" description="Error">
          <V3EmptyState
            icon={AlertTriangle}
            title="Organization Not Found"
            description="Unable to load your organization details."
            accent="red"
          />
        </V3PageContainer>
      </ClientLayout>
    );
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const actionableCount = alerts.filter(a => a.is_actionable).length;
  const watchlistAlerts = alerts.filter(a => a.alert_type === "watchlist_match");

  return (
    <ClientLayout>
      <V3PageContainer
        icon={Bell}
        title="Alerts"
        description={`${unreadCount} unread alerts`}
        animate={false}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Stats KPIs */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <V3KPICard
              icon={Bell}
              label="Unread Alerts"
              value={unreadCount.toString()}
              accent="blue"
            />
            <V3KPICard
              icon={TrendingUp}
              label="Actionable"
              value={actionableCount.toString()}
              accent="green"
            />
            <V3KPICard
              icon={AlertTriangle}
              label="Watchlist Matches"
              value={watchlistAlerts.length.toString()}
              accent="amber"
            />
          </motion.div>

          {/* Filters */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 p-4 bg-[hsl(var(--portal-bg-elevated))] rounded-lg border border-[hsl(var(--portal-border))]">
            <Filter className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
                className="min-h-[36px]"
              >
                All
              </Button>
              <Button
                variant={filterType === "watchlist_match" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("watchlist_match")}
                className="min-h-[36px]"
              >
                Watchlist
              </Button>
              <Button
                variant={filterType === "velocity_spike" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("velocity_spike")}
                className="min-h-[36px]"
              >
                Velocity Spike
              </Button>
              <Button
                variant={filterType === "trending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("trending")}
                className="min-h-[36px]"
              >
                Trending
              </Button>
            </div>
            
            <div className="w-px h-6 bg-[hsl(var(--portal-border))] mx-2" />
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterSeverity === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSeverity("all")}
                className="min-h-[36px]"
              >
                All Severity
              </Button>
              <Button
                variant={filterSeverity === "high" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setFilterSeverity("high")}
                className="min-h-[36px]"
              >
                High
              </Button>
              <Button
                variant={filterSeverity === "medium" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilterSeverity("medium")}
                className="min-h-[36px]"
              >
                Medium
              </Button>
            </div>
          </motion.div>

          {/* Alerts List */}
          <motion.div variants={itemVariants}>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="h-auto bg-[hsl(var(--portal-bg-elevated))]">
                <TabsTrigger value="all" className="min-h-[44px] px-4">
                  All Intelligence ({filteredAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="min-h-[44px] px-4">
                  My Watchlist ({watchlistAlerts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {filteredAlerts.length === 0 ? (
                    <V3EmptyState
                      icon={Bell}
                      title="No alerts"
                      description="You're all caught up! New alerts will appear here when relevant activity is detected."
                      accent="blue"
                    />
                  ) : (
                    filteredAlerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <V3Card 
                          accent={getAccentFromSeverity(alert.severity)}
                          interactive
                          className={cn(
                            "cursor-pointer",
                            !alert.is_read && "ring-2 ring-[hsl(var(--portal-accent-blue))]"
                          )}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <V3CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {!alert.is_read && (
                                    <Badge className="bg-[hsl(var(--portal-accent-blue))] text-white">New</Badge>
                                  )}
                                  {alert.is_actionable && (
                                    <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
                                      Actionable
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className={getSeverityColor(alert.severity || 'low')}>
                                    {getSeverityIcon(alert.severity || 'low')}
                                    <span className="ml-1">{alert.severity || 'low'}</span>
                                  </Badge>
                                </div>
                                <V3CardTitle className="text-lg">{alert.entity_name}</V3CardTitle>
                                <V3CardDescription>{alert.alert_type}</V3CardDescription>
                              </div>
                              {alert.actionable_score > 0 && (
                                <div className="text-right">
                                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Score</p>
                                  <p className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">{alert.actionable_score}</p>
                                </div>
                              )}
                            </div>
                          </V3CardHeader>
                          <V3CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[hsl(var(--portal-text-muted))]">Mentions:</span>
                                <span className="font-medium text-[hsl(var(--portal-text-primary))]">{alert.current_mentions || 0}</span>
                              </div>
                              {alert.velocity && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-[hsl(var(--portal-text-muted))]">Velocity:</span>
                                  <span className="font-medium text-[hsl(var(--portal-text-primary))]">{alert.velocity.toFixed(1)}/hr</span>
                                </div>
                              )}
                              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                                {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </V3CardContent>
                        </V3Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="watchlist" className="mt-6">
                <div className="space-y-4">
                  {watchlistAlerts.length === 0 ? (
                    <V3EmptyState
                      icon={Filter}
                      title="No watchlist alerts"
                      description="Add entities to your watchlist to start receiving alerts"
                      action={
                        <Button 
                          onClick={() => navigate('/client/watchlist')}
                          className="min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
                        >
                          Manage Watchlist
                        </Button>
                      }
                      accent="amber"
                    />
                  ) : (
                    watchlistAlerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <V3Card 
                          accent={getAccentFromSeverity(alert.severity)}
                          interactive
                          className={cn(
                            "cursor-pointer",
                            !alert.is_read && "ring-2 ring-[hsl(var(--portal-accent-blue))]"
                          )}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <V3CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {!alert.is_read && (
                                    <Badge className="bg-[hsl(var(--portal-accent-blue))] text-white">New</Badge>
                                  )}
                                  {alert.is_actionable && (
                                    <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
                                      Actionable
                                    </Badge>
                                  )}
                                </div>
                                <V3CardTitle className="text-lg">{alert.entity_name}</V3CardTitle>
                              </div>
                              {alert.actionable_score > 0 && (
                                <div className="text-right">
                                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Score</p>
                                  <p className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">{alert.actionable_score}</p>
                                </div>
                              )}
                            </div>
                          </V3CardHeader>
                          <V3CardContent>
                            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                              {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </V3CardContent>
                        </V3Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </V3PageContainer>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
          <DialogHeader>
            <DialogTitle className="text-[hsl(var(--portal-text-primary))]">{selectedAlert?.entity_name}</DialogTitle>
            <DialogDescription className="text-[hsl(var(--portal-text-secondary))]">{selectedAlert?.alert_type}</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getSeverityColor(selectedAlert.severity || 'low')}>
                  {getSeverityIcon(selectedAlert.severity || 'low')}
                  <span className="ml-1">{selectedAlert.severity || 'low'}</span>
                </Badge>
                {selectedAlert.is_actionable && (
                  <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
                    Actionable (Score: {selectedAlert.actionable_score})
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-[hsl(var(--portal-border))]">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Current Mentions</p>
                  <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{selectedAlert.current_mentions || 0}</p>
                </div>
                {selectedAlert.velocity && (
                  <div>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">Velocity</p>
                    <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{selectedAlert.velocity.toFixed(1)}/hr</p>
                  </div>
                )}
              </div>

              {selectedAlert.suggested_action && (
                <div>
                  <h4 className="font-semibold mb-2 text-[hsl(var(--portal-text-primary))]">Suggested Action</h4>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{selectedAlert.suggested_action}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => {
                  markAsRead(selectedAlert.id);
                  setSelectedAlert(null);
                }} className="flex-1 min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Read
                </Button>
                {selectedAlert.is_actionable && (
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/client/actions')} 
                    className="flex-1 min-h-[44px] border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
                  >
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
