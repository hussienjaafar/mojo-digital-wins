/**
 * AdFatigueMonitor
 * 
 * Visualizes ad fatigue trends and alerts.
 * Shows rolling CTR decline for active ads with
 * early warning indicators.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  RefreshCw,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3Badge, V3Button } from "@/components/v3";
import { type AdFatigueAlert, useAcknowledgeFatigueAlert } from "@/hooks/useCreativeCorrelations";
import { toast } from "sonner";

interface AdFatigueMonitorProps {
  alerts: AdFatigueAlert[];
  creatives: any[];
  className?: string;
}

// Get severity configuration
function getSeverityConfig(severity: string) {
  switch (severity) {
    case "critical":
      return {
        color: "hsl(var(--portal-error))",
        bgColor: "bg-[hsl(var(--portal-error)/0.1)]",
        borderColor: "border-[hsl(var(--portal-error)/0.3)]",
        icon: XCircle,
        label: "Critical",
      };
    case "warning":
      return {
        color: "hsl(var(--portal-warning))",
        bgColor: "bg-[hsl(var(--portal-warning)/0.1)]",
        borderColor: "border-[hsl(var(--portal-warning)/0.3)]",
        icon: AlertTriangle,
        label: "Warning",
      };
    default:
      return {
        color: "hsl(var(--portal-accent-blue))",
        bgColor: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
        borderColor: "border-[hsl(var(--portal-accent-blue)/0.3)]",
        icon: Eye,
        label: "Watch",
      };
  }
}

// Generate mock trend data for visualization
function generateTrendData(alert: AdFatigueAlert) {
  const baseline = alert.baseline_ctr || 0.02;
  const current = alert.current_ctr || baseline * 0.8;
  const days = alert.days_declining || 5;
  
  // Generate declining trend
  const data = [];
  for (let i = days; i >= 0; i--) {
    const progress = i / days;
    const ctr = current + (baseline - current) * progress;
    data.push({
      day: `Day ${days - i + 1}`,
      ctr: ctr * 100,
    });
  }
  
  return data;
}

interface AlertCardProps {
  alert: AdFatigueAlert;
  creative?: any;
  onAcknowledge: (action: string) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, creative, onAcknowledge }) => {
  const config = getSeverityConfig(alert.alert_severity);
  const SeverityIcon = config.icon;
  const trendData = generateTrendData(alert);

  const chartOption = useMemo(() => ({
    grid: { top: 5, right: 5, bottom: 20, left: 35 },
    xAxis: {
      type: "category",
      data: trendData.map((d) => d.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { 
        fontSize: 10, 
        color: "hsl(var(--portal-text-muted))",
        interval: 0,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { 
        fontSize: 10, 
        color: "hsl(var(--portal-text-muted))",
        formatter: (v: number) => `${v.toFixed(1)}%`,
      },
      splitLine: {
        lineStyle: { color: "hsl(var(--portal-border)/0.3)" },
      },
    },
    series: [
      {
        data: trendData.map((d) => d.ctr),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: config.color, width: 2 },
        itemStyle: { color: config.color },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${config.color.replace(")", "/0.3)")}` },
              { offset: 1, color: `${config.color.replace(")", "/0.05)")}` },
            ],
          },
        },
      },
    ],
  }), [trendData, config.color]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-4",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", config.bgColor)}>
          <SeverityIcon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <V3Badge
              variant={alert.alert_severity === "critical" ? "error" : alert.alert_severity === "warning" ? "warning" : "blue"}
              size="sm"
            >
              {config.label}
            </V3Badge>
            {alert.days_declining > 0 && (
              <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                {alert.days_declining} days declining
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {creative?.headline || creative?.primary_text?.slice(0, 50) || `Ad ${alert.ad_id.slice(-8)}`}
          </p>
          <div className="flex items-center gap-4 mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
            <span>
              CTR: {((alert.current_ctr || 0) * 100).toFixed(2)}% →{" "}
              <span style={{ color: config.color }}>
                {alert.decline_percent?.toFixed(0)}% drop
              </span>
            </span>
            {alert.predicted_exhaustion_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Est. exhaustion: {new Date(alert.predicted_exhaustion_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mini trend chart */}
      <div className="h-20 mb-3">
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <V3Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onAcknowledge("paused")}
        >
          <Pause className="w-3 h-3 mr-1" />
          Pause Ad
        </V3Button>
        <V3Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onAcknowledge("refreshed")}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh Creative
        </V3Button>
        <V3Button
          size="sm"
          variant="ghost"
          onClick={() => onAcknowledge("ignored")}
        >
          Dismiss
        </V3Button>
      </div>
    </motion.div>
  );
};

export const AdFatigueMonitor: React.FC<AdFatigueMonitorProps> = ({
  alerts,
  creatives,
  className,
}) => {
  const acknowledgeAlert = useAcknowledgeFatigueAlert();

  const handleAcknowledge = (alertId: string, action: string) => {
    acknowledgeAlert.mutate(
      { alertId, action },
      {
        onSuccess: () => {
          toast.success(`Alert acknowledged: ${action}`);
        },
        onError: () => {
          toast.error("Failed to acknowledge alert");
        },
      }
    );
  };

  // Map creatives by ad_id for quick lookup
  const creativeMap = useMemo(() => {
    const map = new Map();
    creatives.forEach((c) => {
      if (c.ad_id) map.set(c.ad_id, c);
    });
    return map;
  }, [creatives]);

  if (alerts.length === 0) {
    return (
      <V3Card className={className}>
        <V3CardContent className="p-6 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--portal-success))]" />
          <h4 className="text-lg font-medium text-[hsl(var(--portal-text-primary))] mb-2">
            No Fatigue Detected
          </h4>
          <p className="text-sm text-[hsl(var(--portal-text-muted))] max-w-md mx-auto">
            All your active ads are performing within healthy parameters. 
            We'll alert you when any ad shows signs of declining engagement.
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  // Sort by severity
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, watch: 2 };
    return (severityOrder[a.alert_severity] || 2) - (severityOrder[b.alert_severity] || 2);
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-warning)/0.1)]">
            <TrendingDown className="w-5 h-5 text-[hsl(var(--portal-warning))]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
              Ad Fatigue Monitor
            </h3>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              {alerts.length} ad{alerts.length !== 1 ? "s" : ""} showing declining performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alerts.filter((a) => a.alert_severity === "critical").length > 0 && (
            <V3Badge variant="error">
              {alerts.filter((a) => a.alert_severity === "critical").length} Critical
            </V3Badge>
          )}
          {alerts.filter((a) => a.alert_severity === "warning").length > 0 && (
            <V3Badge variant="warning">
              {alerts.filter((a) => a.alert_severity === "warning").length} Warning
            </V3Badge>
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedAlerts.slice(0, 4).map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            creative={creativeMap.get(alert.ad_id)}
            onAcknowledge={(action) => handleAcknowledge(alert.id, action)}
          />
        ))}
      </div>

      {sortedAlerts.length > 4 && (
        <div className="text-center text-sm text-[hsl(var(--portal-text-muted))]">
          +{sortedAlerts.length - 4} more alerts
        </div>
      )}
    </div>
  );
};

export default AdFatigueMonitor;
