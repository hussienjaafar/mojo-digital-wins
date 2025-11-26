import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Eye, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActivityAlert {
  id: string;
  alert_type: string;
  entity_name: string | null;
  organization_id: string | null;
  relevance_score: number | null;
  usage_count: number | null;
  details: string | null;
  is_resolved: boolean;
  created_at: string;
  organization?: {
    name: string;
    slug: string;
  };
}

export default function AdminActivityAlerts() {
  const [alerts, setAlerts] = useState<ActivityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from("admin_activity_alerts")
        .select(`
          *,
          organization:client_organizations(name, slug)
        `)
        .order("created_at", { ascending: false });

      if (filter === 'unresolved') {
        query = query.eq('is_resolved', false);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error("Error fetching activity alerts:", error);
      toast({
        title: "Error",
        description: "Failed to load activity alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("admin_activity_alerts")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", alertId);

      if (error) throw error;

      toast({
        title: "Alert Resolved",
        description: "The activity alert has been marked as resolved",
      });

      fetchAlerts();
    } catch (error) {
      console.error("Error resolving alert:", error);
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'high_entity_volume':
        return <TrendingUp className="h-5 w-5 text-destructive" />;
      case 'low_relevance_score':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'unusual_pattern':
        return <Users className="h-5 w-5 text-primary" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'high_entity_volume':
        return 'High Entity Volume';
      case 'low_relevance_score':
        return 'Low Relevance Score';
      case 'unusual_pattern':
        return 'Unusual Pattern';
      default:
        return type;
    }
  };

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Activity Alerts</h2>
          <p className="text-sm text-muted-foreground">
            Monitor unusual client activity and usage patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unresolved')}
          >
            Unresolved {unresolvedCount > 0 && `(${unresolvedCount})`}
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
      </div>

      {unresolvedCount > 0 && filter === 'unresolved' && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-foreground">
            You have {unresolvedCount} unresolved activity alert{unresolvedCount > 1 ? 's' : ''} requiring attention
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filter === 'unresolved' 
                  ? 'No unresolved activity alerts' 
                  : 'No activity alerts found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card key={alert.id} className={!alert.is_resolved ? "border-destructive/50" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.alert_type)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">
                          {getAlertTypeLabel(alert.alert_type)}
                        </CardTitle>
                        {alert.is_resolved ? (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {alert.organization && (
                          <span className="font-medium">
                            {alert.organization.name}
                          </span>
                        )}
                        {alert.entity_name && ` • Entity: ${alert.entity_name}`}
                        {` • ${new Date(alert.created_at).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {alert.organization_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/client-view/${alert.organization_id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Client
                      </Button>
                    )}
                    {!alert.is_resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alert.details && (
                    <p className="text-sm text-muted-foreground">{alert.details}</p>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {alert.relevance_score !== null && (
                      <span>Relevance Score: {alert.relevance_score}%</span>
                    )}
                    {alert.usage_count !== null && (
                      <span>Usage Count: {alert.usage_count}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
