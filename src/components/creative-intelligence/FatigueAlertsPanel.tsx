import { AlertTriangle, TrendingDown, RefreshCw } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent } from "@/components/v3/V3Card";
import { V3InsightBadge } from "@/components/v3/V3InsightBadge";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { FatigueAlert } from "@/hooks/useCreativeIntelligence";

interface FatigueAlertsPanelProps {
  alerts: FatigueAlert[];
  isLoading?: boolean;
}

const statusConfig = {
  FATIGUED: {
    color: "red" as const,
    icon: AlertTriangle,
    badgeType: "anomaly-high" as const,
    label: "Fatigued",
  },
  DECLINING: {
    color: "amber" as const,
    icon: TrendingDown,
    badgeType: "anomaly-low" as const,
    label: "Declining",
  },
};

export function FatigueAlertsPanel({ alerts, isLoading }: FatigueAlertsPanelProps) {
  if (isLoading) {
    return (
      <V3Card accent="amber">
        <V3CardHeader>
          <V3CardTitle>Fatigue Alerts</V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="card" />
        </V3CardContent>
      </V3Card>
    );
  }

  const fatigued = alerts.filter((a) => a.fatigue_status === "FATIGUED");
  const declining = alerts.filter((a) => a.fatigue_status === "DECLINING");

  return (
    <V3Card accent={fatigued.length > 0 ? "red" : declining.length > 0 ? "amber" : "default"}>
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <V3CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-warning))]" />
            Fatigue Alerts
          </V3CardTitle>
          {alerts.length > 0 && (
            <V3InsightBadge type={fatigued.length > 0 ? "anomaly-high" : "anomaly-low"}>
              {alerts.length} creative{alerts.length !== 1 ? "s" : ""} need attention
            </V3InsightBadge>
          )}
        </div>
      </V3CardHeader>
      <V3CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No fatigue alerts - all creatives performing well</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {alerts.map((alert) => {
              const config = statusConfig[alert.fatigue_status as keyof typeof statusConfig];
              const Icon = config?.icon || TrendingDown;

              return (
                <div
                  key={alert.creative_id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]"
                >
                  {alert.thumbnail_url && (
                    <img
                      src={alert.thumbnail_url}
                      alt=""
                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
                      <span className="font-medium text-sm truncate">
                        {alert.headline || alert.issue_primary || "Unknown Creative"}
                      </span>
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
                      <div>
                        CTR dropped {((alert.decline_from_peak || 0) * 100).toFixed(0)}% from peak
                      </div>
                      <div>
                        {alert.days_with_data} days · {alert.total_impressions.toLocaleString()} impressions
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]">
                        {alert.recommendation.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium">{alert.roas.toFixed(2)}x</div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">ROAS</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}
