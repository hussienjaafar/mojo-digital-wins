import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock, Building2, Lightbulb, X, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface TimelineAlert {
  id: string;
  organization_id: string;
  organization_name: string;
  entity_name: string;
  alert_type: string;
  severity: string;
  suggested_action: string;
  triggered_at: string;
  is_read: boolean;
}

export function GlobalAlertsTimeline() {
  const [alerts, setAlerts] = useState<TimelineAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    
    // Fetch alerts with organization info
    const { data: alertsData } = await supabase
      .from('client_entity_alerts')
      .select(`
        id,
        organization_id,
        entity_name,
        alert_type,
        severity,
        suggested_action,
        triggered_at,
        is_read
      `)
      .eq('is_read', false)
      .order('triggered_at', { ascending: false })
      .limit(20);

    if (alertsData) {
      // Fetch organization names
      const orgIds = [...new Set(alertsData.map(a => a.organization_id).filter(Boolean))];
      const { data: orgs } = await supabase
        .from('client_organizations')
        .select('id, name')
        .in('id', orgIds);

      const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

      setAlerts(alertsData.map(alert => ({
        ...alert,
        organization_name: orgMap.get(alert.organization_id) || 'Unknown'
      })));
    }

    setLoading(false);
  };

  const handleDismiss = async (alertId: string) => {
    const { error } = await supabase
      .from('client_entity_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (error) {
      toast.error("Failed to dismiss alert");
      return;
    }

    setAlerts(prev => prev.filter(a => a.id !== alertId));
    toast.success("Alert dismissed");
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: "bg-destructive/20 text-destructive border-destructive/30",
          border: "border-l-destructive",
          icon: "text-destructive"
        };
      case 'high':
        return {
          badge: "bg-warning/20 text-warning border-warning/30",
          border: "border-l-warning",
          icon: "text-warning"
        };
      case 'medium':
        return {
          badge: "bg-primary/20 text-primary border-primary/30",
          border: "border-l-primary",
          icon: "text-primary"
        };
      default:
        return {
          badge: "bg-muted text-muted-foreground",
          border: "border-l-muted-foreground",
          icon: "text-muted-foreground"
        };
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'spike': return 'Spike Detected';
      case 'breaking': return 'Breaking News';
      case 'sentiment_shift': return 'Sentiment Shift';
      case 'opposition_mention': return 'Opposition Mention';
      default: return type;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Alerts Timeline</CardTitle>
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length} unread
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No unread alerts</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg bg-muted/30 border-l-4 ${styles.border} hover:bg-muted/50 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${styles.badge}`}>
                            {alert.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getAlertTypeLabel(alert.alert_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{alert.organization_name}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm text-primary font-medium">{alert.entity_name}</span>
                        </div>
                        {alert.suggested_action && (
                          <div className="flex items-start gap-1 mt-2">
                            <Lightbulb className="h-3 w-3 text-warning mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {alert.suggested_action}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/admin/client/${alert.organization_id}`)}
                          title="View Dashboard"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDismiss(alert.id)}
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
