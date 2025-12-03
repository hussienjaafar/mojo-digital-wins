import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Bell, 
  GripVertical,
  X,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = {
  showDragHandle?: boolean;
};

type AlertData = {
  id: string;
  entity_name: string;
  alert_type: string;
  severity: string | null;
  triggered_at: string | null;
  organization_id: string | null;
  organization_name?: string;
};

export function AlertsBannerWidget({ showDragHandle }: Props) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const { data: alertsData, error: alertsError } = await supabase
        .from("client_entity_alerts")
        .select("id, entity_name, alert_type, severity, triggered_at, organization_id")
        .eq("is_read", false)
        .order("triggered_at", { ascending: false })
        .limit(10);

      if (alertsError) throw alertsError;

      // Get organization names
      const orgIds = [...new Set((alertsData || []).map(a => a.organization_id).filter(Boolean))];
      const { data: orgs } = await supabase
        .from("client_organizations")
        .select("id, name")
        .in("id", orgIds);

      const alertsWithOrgs = (alertsData || []).map(alert => ({
        ...alert,
        organization_name: orgs?.find(o => o.id === alert.organization_id)?.name || "Unknown"
      }));

      setAlerts(alertsWithOrgs);
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await supabase.from("client_entity_alerts").update({ is_read: true }).eq("id", alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success("Alert dismissed");
    } catch (error) {
      toast.error("Failed to dismiss alert");
    }
  };

  const getSeverityStyles = (severity: string | null) => {
    switch (severity) {
      case "critical":
        return "bg-[hsl(var(--portal-accent-red)/0.1)] text-[hsl(var(--portal-accent-red))] border-[hsl(var(--portal-accent-red)/0.3)]";
      case "high":
        return "bg-[hsl(var(--portal-accent-orange)/0.1)] text-[hsl(var(--portal-accent-orange))] border-[hsl(var(--portal-accent-orange)/0.3)]";
      case "medium":
        return "bg-[hsl(var(--portal-accent-yellow)/0.1)] text-[hsl(var(--portal-accent-yellow))] border-[hsl(var(--portal-accent-yellow)/0.3)]";
      default:
        return "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.3)]";
    }
  };

  if (isLoading) {
    return (
      <div className="portal-card h-full">
        <div className="p-4 space-y-3">
          <div className="h-6 w-32 portal-skeleton rounded" />
          <div className="h-16 w-full portal-skeleton rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card portal-widget-red h-full flex flex-col">
      <div className={`p-4 border-b border-[hsl(var(--portal-border))] portal-widget-header-red ${showDragHandle ? 'cursor-move' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showDragHandle && (
              <GripVertical className="h-5 w-5 portal-text-secondary" />
            )}
            <div className="portal-widget-icon portal-widget-icon-red">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold portal-text-primary">Active Alerts</h3>
              <p className="text-xs portal-text-secondary">{alerts.length} unread alerts</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin?tab=ops")}
            className="gap-1 text-xs"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-10 w-10 portal-text-secondary mx-auto mb-3 opacity-50" />
              <p className="portal-text-secondary text-sm">No active alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))] group"
              >
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                  alert.severity === "critical" || alert.severity === "high" 
                    ? "text-[hsl(var(--portal-accent-red))]" 
                    : "text-[hsl(var(--portal-accent-orange))]"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm portal-text-primary truncate">
                      {alert.entity_name}
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${getSeverityStyles(alert.severity)}`}>
                      {alert.severity || "low"}
                    </Badge>
                  </div>
                  <p className="text-xs portal-text-secondary truncate">
                    {alert.organization_name} · {alert.alert_type}
                  </p>
                  <p className="text-[10px] portal-text-secondary mt-1">
                    {alert.triggered_at && formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDismiss(alert.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
