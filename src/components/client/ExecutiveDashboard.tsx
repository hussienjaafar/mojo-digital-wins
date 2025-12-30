import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays, parseISO, formatDistanceToNow } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart,
  type LucideIcon,
} from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useDateRange } from "@/stores/dashboardStore";
import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import { EChartsLineChart } from "@/components/charts/echarts/EChartsLineChart";
import { EChartsBarChart } from "@/components/charts/echarts/EChartsBarChart";
import { EChartsPieChart } from "@/components/charts/echarts/EChartsPieChart";
import { getChartColors } from "@/lib/design-tokens";

// ============================================================================
// Types
// ============================================================================

type Alert = {
  id: string;
  type: "warning" | "success" | "info" | "danger";
  title: string;
  message: string;
  timestamp: Date;
};

// ============================================================================
// Constants
// ============================================================================

const CHART_COLORS = [
  "hsl(var(--portal-accent-blue))",
  "hsl(var(--portal-accent-purple))",
  "hsl(var(--portal-success))",
  "hsl(var(--portal-warning))",
  "hsl(var(--portal-error))",
];

// ============================================================================
// Local Components
// ============================================================================

interface MetricChipProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  variant?: "default" | "success" | "warning" | "error" | "info";
  description?: string;
}

const MetricChip = ({
  label,
  value,
  icon: Icon,
  change,
  variant = "default",
  description,
}: MetricChipProps) => {
  const variantStyles = {
    default: "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-primary))]",
    success: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
    warning: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
    error: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
    info: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--portal-border)/0.5)]",
        variantStyles[variant]
      )}
    >
      <div className="p-2 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs opacity-80 block">{label}</span>
        <span className="font-bold text-lg tabular-nums">{value}</span>
        {description && (
          <span className="text-xs opacity-70 block truncate">{description}</span>
        )}
      </div>
      {change !== undefined && (
        <div
          className={cn(
            "flex items-center text-xs font-medium",
            change > 0
              ? "text-[hsl(var(--portal-success))]"
              : change < 0
              ? "text-[hsl(var(--portal-error))]"
              : "text-[hsl(var(--portal-text-muted))]"
          )}
        >
          {change > 0 ? (
            <ArrowUpRight className="h-3 w-3 mr-0.5" />
          ) : change < 0 ? (
            <ArrowDownRight className="h-3 w-3 mr-0.5" />
          ) : (
            <Minus className="h-3 w-3 mr-0.5" />
          )}
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdate: Date | null;
}

const ConnectionStatus = ({ isConnected, lastUpdate }: ConnectionStatusProps) => (
  <div className="flex items-center gap-3">
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        isConnected
          ? "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]"
          : "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]"
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Offline</span>
        </>
      )}
    </div>
    {lastUpdate && (
      <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--portal-text-muted))]">
        <Clock className="h-4 w-4" aria-hidden="true" />
        <span>{format(lastUpdate, "HH:mm:ss")}</span>
      </div>
    )}
  </div>
);

interface AlertItemProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
}

const AlertItem = ({ alert, onAcknowledge }: AlertItemProps) => {
  const typeConfig = {
    success: {
      bg: "bg-[hsl(var(--portal-success)/0.1)]",
      border: "border-[hsl(var(--portal-success)/0.2)]",
      icon: CheckCircle2,
      iconColor: "text-[hsl(var(--portal-success))]",
    },
    warning: {
      bg: "bg-[hsl(var(--portal-warning)/0.1)]",
      border: "border-[hsl(var(--portal-warning)/0.2)]",
      icon: AlertCircle,
      iconColor: "text-[hsl(var(--portal-warning))]",
    },
    danger: {
      bg: "bg-[hsl(var(--portal-error)/0.1)]",
      border: "border-[hsl(var(--portal-error)/0.2)]",
      icon: AlertCircle,
      iconColor: "text-[hsl(var(--portal-error))]",
    },
    info: {
      bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
      border: "border-[hsl(var(--portal-accent-blue)/0.2)]",
      icon: AlertCircle,
      iconColor: "text-[hsl(var(--portal-accent-blue))]",
    },
  };

  const config = typeConfig[alert.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        config.bg,
        config.border
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconColor)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
          {alert.title}
        </h4>
        <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-0.5">
          {alert.message}
        </p>
      </div>
      {onAcknowledge && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAcknowledge(alert.id)}
          className="shrink-0 h-7 px-2 text-xs"
        >
          Acknowledge
        </Button>
      )}
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ExecutiveDashboard = () => {
  const { toast } = useToast();
  const { organizationId } = useClientOrganization();
  const dateRange = useDateRange();

  // Use realtime metrics hook
  const {
    metaMetrics,
    smsMetrics,
    transactions,
    roiAnalytics,
    isConnected,
    lastUpdate,
    isLoading,
  } = useRealtimeMetrics(organizationId || "", dateRange.startDate, dateRange.endDate);

  // State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalAdSpend = metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    const totalSmsCost = smsMetrics.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const totalSpend = totalAdSpend + totalSmsCost;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const totalDonations = transactions.length;
    const avgDonation = totalDonations > 0 ? totalRevenue / totalDonations : 0;

    // Engagement metrics
    const totalImpressions = metaMetrics.reduce((sum, m) => sum + Number(m.impressions || 0), 0);
    const totalClicks = metaMetrics.reduce((sum, m) => sum + Number(m.clicks || 0), 0);
    const metaCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const totalSmsSent = smsMetrics.reduce((sum, m) => sum + Number(m.messages_sent || 0), 0);
    const totalSmsDelivered = smsMetrics.reduce((sum, m) => sum + Number(m.messages_delivered || 0), 0);
    const smsDeliveryRate = totalSmsSent > 0 ? (totalSmsDelivered / totalSmsSent) * 100 : 0;

    // Period comparison
    const midDate = new Date((new Date(dateRange.startDate).getTime() + new Date(dateRange.endDate).getTime()) / 2);
    const currentPeriodRevenue = transactions
      .filter((t) => new Date(t.transaction_date) >= midDate)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const previousPeriodRevenue = transactions
      .filter((t) => new Date(t.transaction_date) < midDate)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const revenueChange =
      previousPeriodRevenue > 0
        ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

    return {
      totalRevenue,
      roi,
      totalDonations,
      avgDonation,
      totalSpend,
      metaCTR,
      smsDeliveryRate,
      revenueChange,
      totalAdSpend,
      totalSmsCost,
    };
  }, [metaMetrics, smsMetrics, transactions, dateRange.startDate, dateRange.endDate]);

  // Attribution analysis
  const attributionData = useMemo(() => {
    if (roiAnalytics.length === 0) return [];

    const platforms = ["meta", "sms", "actblue"];
    return platforms.map((platform) => {
      const data = roiAnalytics.filter((r) => r.platform === platform);
      const firstTouch = data.reduce((sum, r) => sum + Number(r.first_touch_attribution || 0), 0);
      const lastTouch = data.reduce((sum, r) => sum + Number(r.last_touch_attribution || 0), 0);
      const linear = data.reduce((sum, r) => sum + Number(r.linear_attribution || 0), 0);

      return { name: platform.toUpperCase(), firstTouch, lastTouch, linear };
    });
  }, [roiAnalytics]);

  // Performance timeline
  const performanceTimeline = useMemo(() => {
    const dateMap = new Map<string, any>();

    metaMetrics.forEach((m) => {
      const date = m.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      dateMap.get(date).metaSpend += Number(m.spend || 0);
    });

    smsMetrics.forEach((m) => {
      const date = m.send_date || '';
      if (!date) return;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      dateMap.get(date)!.smsSpend += Number(m.cost || 0);
    });

    transactions.forEach((t) => {
      const date = format(parseISO(t.transaction_date), "yyyy-MM-dd");
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      dateMap.get(date).revenue += Number(t.amount || 0);
    });

    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [metaMetrics, smsMetrics, transactions]);

  // Generate intelligent alerts
  useEffect(() => {
    const newAlerts: Alert[] = [];

    if (kpis.roi < 100) {
      newAlerts.push({
        id: "roi-low",
        type: "warning",
        title: "ROI Below Target",
        message: `Current ROI is ${kpis.roi.toFixed(1)}%. Consider optimizing campaign spend.`,
        timestamp: new Date(),
      });
    } else if (kpis.roi > 200) {
      newAlerts.push({
        id: "roi-high",
        type: "success",
        title: "Exceptional ROI",
        message: `ROI is ${kpis.roi.toFixed(1)}%. Campaigns are performing excellently!`,
        timestamp: new Date(),
      });
    }

    if (kpis.smsDeliveryRate < 95 && kpis.smsDeliveryRate > 0) {
      newAlerts.push({
        id: "sms-delivery",
        type: "warning",
        title: "Low SMS Delivery Rate",
        message: `SMS delivery rate is ${kpis.smsDeliveryRate.toFixed(1)}%. Check contact list quality.`,
        timestamp: new Date(),
      });
    }

    const efficiency = kpis.totalRevenue > 0 ? (kpis.totalSpend / kpis.totalRevenue) * 100 : 0;
    if (efficiency > 50) {
      newAlerts.push({
        id: "budget-efficiency",
        type: "info",
        title: "Budget Efficiency Notice",
        message: `Spending ${efficiency.toFixed(1)}% of revenue. Review campaign allocations.`,
        timestamp: new Date(),
      });
    }

    const recentDonations = transactions.filter(
      (t) => new Date(t.transaction_date) > subDays(new Date(), 1)
    );
    if (recentDonations.length > 10) {
      newAlerts.push({
        id: "recent-activity",
        type: "success",
        title: "High Activity",
        message: `${recentDonations.length} donations in the last 24 hours!`,
        timestamp: new Date(),
      });
    }

    setAlerts(newAlerts);
  }, [kpis, transactions]);

  // Handlers
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const handleExport = useCallback(() => {
    toast({
      title: "Exporting snapshot",
      description: "Your executive dashboard export is being prepared.",
    });
  }, [toast]);

  const handleAcknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <ClientShell pageTitle="Executive Dashboard" showDateControls={false}>
      <div className="space-y-6">
        {/* Hero Panel */}
        <ChartPanel
          title="Executive Overview"
          description="Real-time analytics and performance insights"
          icon={Activity}
          isLoading={isLoading}
          minHeight={160}
          actions={
            <div className="flex items-center gap-2">
              <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <RefreshCw
                  className={cn("h-4 w-4", autoRefresh && "animate-spin")}
                  aria-hidden="true"
                />
                Auto-refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricChip
              label="Total Revenue"
              value={formatCurrency(kpis.totalRevenue)}
              icon={DollarSign}
              change={kpis.revenueChange}
              variant="success"
              description={`${kpis.totalDonations} donations`}
            />
            <MetricChip
              label="ROI"
              value={`${kpis.roi.toFixed(1)}%`}
              icon={Target}
              change={kpis.roi - 150}
              variant={kpis.roi > 150 ? "success" : kpis.roi < 100 ? "error" : "warning"}
              description="Multi-attribution"
            />
            <MetricChip
              label="Total Donations"
              value={kpis.totalDonations.toLocaleString()}
              icon={Users}
              variant="info"
            />
            <MetricChip
              label="Avg Donation"
              value={formatCurrency(kpis.avgDonation)}
              icon={Zap}
              variant="default"
            />
            <MetricChip
              label="Meta CTR"
              value={`${kpis.metaCTR.toFixed(2)}%`}
              icon={TrendingUp}
              change={kpis.metaCTR - 2}
              variant={kpis.metaCTR > 2 ? "success" : "warning"}
            />
            <MetricChip
              label="SMS Delivery"
              value={`${kpis.smsDeliveryRate.toFixed(1)}%`}
              icon={Activity}
              variant={kpis.smsDeliveryRate >= 95 ? "success" : "warning"}
            />
          </div>
        </ChartPanel>

        {/* Alerts Panel */}
        {alerts.length > 0 && (
          <ChartPanel
            title="Intelligent Alerts & Insights"
            description="AI-generated performance recommendations"
            icon={AlertCircle}
            minHeight={100}
            status={
              alerts.some((a) => a.type === "warning" || a.type === "danger")
                ? { text: "Action Needed", variant: "warning" }
                : { text: "All Good", variant: "success" }
            }
          >
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={handleAcknowledgeAlert}
                  />
                ))}
              </div>
            </AnimatePresence>
          </ChartPanel>
        )}

        {/* Performance Timeline Panel */}
        <ChartPanel
          title="Multi-Platform Performance Timeline"
          description="Revenue vs marketing spend (Last 30 days)"
          icon={BarChart3}
          isLoading={isLoading}
          isEmpty={performanceTimeline.length === 0}
          emptyMessage="No performance data available for this period"
          minHeight={320}
          status={
            lastUpdate
              ? {
                  text: `Updated ${formatDistanceToNow(lastUpdate, { addSuffix: true })}`,
                  variant: "info",
                }
              : undefined
          }
        >
          <EChartsLineChart
            data={performanceTimeline}
            xAxisKey="date"
            xAxisType="time"
            height={288}
            valueType="currency"
            series={[
              { 
                dataKey: "metaSpend", 
                name: "Meta Ads Spend", 
                color: CHART_COLORS[0],
                type: "area",
                areaStyle: { opacity: 0.3 },
                valueType: "currency"
              },
              { 
                dataKey: "smsSpend", 
                name: "SMS Spend", 
                color: CHART_COLORS[1],
                type: "area",
                areaStyle: { opacity: 0.3 },
                valueType: "currency"
              },
              { 
                dataKey: "revenue", 
                name: "Revenue", 
                color: CHART_COLORS[2],
                lineStyle: { width: 2.5 },
                valueType: "currency"
              },
            ]}
          />
        </ChartPanel>

        {/* Attribution Analysis */}
        {attributionData.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel
              title="Attribution Funnel Analysis"
              description="Multi-touch attribution by platform"
              icon={BarChart3}
              isLoading={isLoading}
              minHeight={280}
            >
              <EChartsBarChart
                data={attributionData}
                xAxisKey="name"
                series={[
                  { dataKey: "firstTouch", name: "First Touch", color: CHART_COLORS[0], valueType: "currency" },
                  { dataKey: "lastTouch", name: "Last Touch", color: CHART_COLORS[1], valueType: "currency" },
                  { dataKey: "linear", name: "Linear", color: CHART_COLORS[2], valueType: "currency" },
                ]}
                valueType="currency"
                height={240}
                disableHoverEmphasis
              />
            </ChartPanel>

            <ChartPanel
              title="Platform Distribution"
              description="Revenue attribution breakdown"
              icon={PieChart}
              isLoading={isLoading}
              minHeight={280}
            >
              <EChartsPieChart
                data={attributionData.map((d) => ({ name: d.name, value: d.linear }))}
                valueType="currency"
                height={240}
                variant="donut"
                disableHoverEmphasis
              />
            </ChartPanel>
          </div>
        )}

        {/* Recent Activity Feed */}
        <ChartPanel
          title="Recent Activity"
          description="Latest donations and campaign updates"
          icon={Activity}
          isLoading={isLoading}
          isEmpty={transactions.length === 0}
          emptyMessage="No recent activity"
          minHeight={200}
        >
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
              {transactions.slice(0, 15).map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary)/0.5)] hover:bg-[hsl(var(--portal-bg-tertiary))] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--portal-success))] animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                        ${Number(tx.amount).toFixed(2)} donation
                      </p>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                        {tx.donor_name || "Anonymous"} •{" "}
                        {format(parseISO(tx.transaction_date), "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>
                  {tx.is_recurring && (
                    <Badge
                      variant="outline"
                      className="text-xs border-[hsl(var(--portal-accent-blue)/0.3)] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.1)]"
                    >
                      Recurring
                    </Badge>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </ChartPanel>
      </div>
    </ClientShell>
  );
};

export default ExecutiveDashboard;
