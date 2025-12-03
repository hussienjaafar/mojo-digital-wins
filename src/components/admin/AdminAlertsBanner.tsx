import { AlertTriangle, Bell, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        return "bg-destructive text-destructive-foreground";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-black";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "critical" || severity === "high") {
      return <AlertTriangle className="h-3 w-3" />;
    }
    return <Bell className="h-3 w-3" />;
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-semibold text-foreground">Alerts Requiring Attention</h3>
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1">
          View All
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {alerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-3 p-2 rounded-md bg-background/50 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Badge className={`${getSeverityColor(alert.severity)} gap-1 shrink-0`}>
                {getSeverityIcon(alert.severity)}
                {alert.severity}
              </Badge>
              <span className="text-sm truncate">
                <span className="font-medium">{alert.entityName}</span>
                <span className="text-muted-foreground"> {alert.alertType} </span>
                <span className="text-muted-foreground">@ {alert.organizationName}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
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
