import { useState, useEffect } from "react";
import { V3Button } from "@/components/v3/V3Button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock, Building2, Lightbulb, X, Eye, GripVertical } from "lucide-react";
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

interface GlobalAlertsTimelineProps {
  showDragHandle?: boolean;
}

export function GlobalAlertsTimeline({ showDragHandle = false }: GlobalAlertsTimelineProps) {
  const [alerts, setAlerts] = useState<TimelineAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    
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
          badge: "portal-badge-error",
          border: "border-l-[hsl(var(--portal-accent-red))]",
          icon: "text-[hsl(var(--portal-accent-red))]"
        };
      case 'high':
        return {
          badge: "portal-badge-warning",
          border: "border-l-[hsl(var(--portal-accent-orange))]",
          icon: "text-[hsl(var(--portal-accent-orange))]"
        };
      case 'medium':
        return {
          badge: "portal-badge-info",
          border: "border-l-[hsl(var(--portal-accent-blue))]",
          icon: "text-[hsl(var(--portal-accent-blue))]"
        };
      default:
        return {
          badge: "bg-[hsl(var(--portal-bg-elevated))] portal-text-secondary",
          border: "border-l-[hsl(var(--portal-text-secondary))]",
          icon: "portal-text-secondary"
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
    <div className="portal-card portal-widget-amber h-full flex flex-col">
      <div className={`p-4 pb-3 flex-shrink-0 portal-widget-header-amber ${showDragHandle ? 'cursor-move' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showDragHandle && (
              <GripVertical className="h-4 w-4 portal-text-secondary" />
            )}
            <div className="portal-widget-icon portal-widget-icon-amber">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold portal-text-primary">Alerts Timeline</h3>
              {alerts.length > 0 && (
                <p className="text-xs portal-text-secondary">{alerts.length} unread alerts</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 pt-0 flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-[hsl(var(--portal-bg-elevated))] animate-pulse rounded" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 portal-text-secondary">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No unread alerts</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border-l-4 ${styles.border} hover:bg-[hsl(var(--portal-bg-hover))] transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`portal-badge text-xs ${styles.badge}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs portal-text-secondary">
                            {getAlertTypeLabel(alert.alert_type)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 portal-text-secondary flex-shrink-0" />
                            <span className="text-sm font-medium portal-text-primary break-words">{alert.organization_name}</span>
                          </div>
                          <span className="text-xs portal-text-secondary">•</span>
                          <span className="text-sm text-[hsl(var(--portal-accent-blue))] font-medium break-words">{alert.entity_name}</span>
                        </div>
                        {alert.suggested_action && (
                          <div className="flex items-start gap-1.5 mt-2 p-2 bg-[hsl(var(--portal-accent-orange)/0.1)] rounded border border-[hsl(var(--portal-accent-orange)/0.2)]">
                            <Lightbulb className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-orange))] mt-0.5 flex-shrink-0" />
                            <p className="text-xs portal-text-secondary leading-relaxed">
                              {alert.suggested_action}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="h-3 w-3 portal-text-secondary" />
                          <span className="text-xs portal-text-secondary">
                            {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <V3Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => navigate(`/admin/client/${alert.organization_id}`)}
                          title="View Dashboard"
                        >
                          <Eye className="h-4 w-4" />
                        </V3Button>
                        <V3Button
                          variant="ghost"
                          size="icon-sm"
                          className="portal-text-secondary hover:text-[hsl(var(--portal-accent-red))]"
                          onClick={() => handleDismiss(alert.id)}
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </V3Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
