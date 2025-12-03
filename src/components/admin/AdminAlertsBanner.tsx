import { AlertTriangle, Bell, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  entityName: string;
  alertType: string;
  severity: string;
  triggeredAt: string;
  organizationName: string;
  organizationId: string;
}

interface AdminAlertsBannerProps {
  alerts: Alert[];
  onViewAll: () => void;
  onDismiss: (id: string) => void;
}

export function AdminAlertsBanner({ alerts, onViewAll, onDismiss }: AdminAlertsBannerProps) {
  if (alerts.length === 0) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "portal-badge-error";
      case "high":
        return "bg-[hsl(var(--portal-accent-orange))] text-white";
      case "medium":
        return "portal-badge-warning";
      default:
        return "bg-[hsl(var(--portal-bg-elevated))] portal-text-secondary";
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "critical" || severity === "high") {
      return <AlertTriangle className="h-3 w-3" />;
    }
    return <Bell className="h-3 w-3" />;
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--portal-accent-red)/0.3)] bg-[hsl(var(--portal-accent-red)/0.05)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-accent-red))]" />
          <h3 className="font-semibold portal-text-primary">Alerts Requiring Attention</h3>
          <span className="portal-badge portal-badge-error text-xs">
            {alerts.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 portal-btn-secondary">
          View All
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto portal-scrollbar">
        {alerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-3 p-2 rounded-md bg-[hsl(var(--portal-bg-primary)/0.5)] group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`${getSeverityColor(alert.severity)} portal-badge gap-1 shrink-0`}>
                {getSeverityIcon(alert.severity)}
                {alert.severity}
              </span>
              <span className="text-sm truncate">
                <span className="font-medium portal-text-primary">{alert.entityName}</span>
                <span className="portal-text-secondary"> {alert.alertType} </span>
                <span className="portal-text-secondary">@ {alert.organizationName}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs portal-text-secondary">
                {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
