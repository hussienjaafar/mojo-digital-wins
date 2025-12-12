import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { useRealtimeTrends } from "@/hooks/useRealtimeTrends";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CreativeInsights } from "@/components/client/CreativeInsights";
import { CreativeDataImport } from "@/components/client/CreativeDataImport";

import {
  Activity,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Newspaper,
  Eye,
  ArrowUpRight,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Sparkles,
  Upload,
  ExternalLink,
} from "lucide-react";

// Lazy load sentiment chart for performance
const SentimentTrendChart = lazy(() =>
  import("@/components/news/SentimentTrendChart").then((m) => ({
    default: m.SentimentTrendChart,
  }))
);

// ============================================================================
// Types
// ============================================================================

type Article = {
  id: string;
  title: string;
  source_name: string;
  published_date: string;
  sentiment_label: string | null;
  category: string | null;
};

type AlertSeverity = "all" | "critical" | "high" | "medium";

// ============================================================================
// Sub-Components
// ============================================================================

interface ConnectionStatusProps {
  alertsStatus: string;
  trendsStatus: string;
}

const ConnectionStatusBadge = ({ alertsStatus, trendsStatus }: ConnectionStatusProps) => {
  const isConnected = alertsStatus === "connected" || trendsStatus === "connected";

  return (
    <Badge
      variant={isConnected ? "default" : "secondary"}
      className={cn(
        "gap-1.5 px-2.5 py-1",
        isConnected
          ? "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.3)]"
          : "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]"
      )}
    >
      {isConnected ? (
        <Wifi className="h-3 w-3" aria-hidden="true" />
      ) : (
        <WifiOff className="h-3 w-3" aria-hidden="true" />
      )}
      <span className="text-xs font-medium">{isConnected ? "LIVE" : "Offline"}</span>
      {isConnected && (
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-success))] animate-pulse" />
      )}
    </Badge>
  );
};

interface MetricChipProps {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "error";
  icon?: React.ReactNode;
}

const MetricChip = ({ label, value, variant = "default", icon }: MetricChipProps) => {
  const variantStyles = {
    default: "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-primary))]",
    success: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
    warning: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
    error: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--portal-border)/0.5)]",
        variantStyles[variant]
      )}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
};

interface SentimentBadgeProps {
  sentiment: string | null;
}

const SentimentBadge = ({ sentiment }: SentimentBadgeProps) => {
  if (!sentiment) return null;

  const lower = sentiment.toLowerCase();
  const config = {
    positive: {
      bg: "bg-[hsl(var(--portal-success)/0.1)]",
      text: "text-[hsl(var(--portal-success))]",
      border: "border-[hsl(var(--portal-success)/0.2)]",
    },
    negative: {
      bg: "bg-[hsl(var(--portal-error)/0.1)]",
      text: "text-[hsl(var(--portal-error))]",
      border: "border-[hsl(var(--portal-error)/0.2)]",
    },
    neutral: {
      bg: "bg-[hsl(var(--portal-bg-elevated))]",
      text: "text-[hsl(var(--portal-text-muted))]",
      border: "border-[hsl(var(--portal-border))]",
    },
  };

  const style = config[lower as keyof typeof config] || config.neutral;

  return (
    <Badge variant="outline" className={cn("text-xs capitalize", style.bg, style.text, style.border)}>
      {sentiment}
    </Badge>
  );
};

// ============================================================================
// Alert Item Component
// ============================================================================

interface AlertItemProps {
  alert: {
    id: string;
    severity: string | null;
    entity_name: string;
    alert_type: string;
    suggested_action?: string | null;
    triggered_at?: string | null;
  };
  onDismiss: (id: string) => void;
}

const AlertItem = ({ alert, onDismiss }: AlertItemProps) => {
  const severityStyles = {
    critical: {
      badge: "bg-[hsl(var(--portal-error))] text-white",
      border: "border-l-[hsl(var(--portal-error))]",
    },
    high: {
      badge: "bg-orange-500 text-white",
      border: "border-l-orange-500",
    },
    medium: {
      badge: "bg-[hsl(var(--portal-warning))] text-white",
      border: "border-l-[hsl(var(--portal-warning))]",
    },
    low: {
      badge: "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]",
      border: "border-l-[hsl(var(--portal-border))]",
    },
  };

  const style = severityStyles[alert.severity as keyof typeof severityStyles] || severityStyles.low;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "flex items-start justify-between p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border border-[hsl(var(--portal-border))] border-l-4",
        style.border,
        "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs font-medium capitalize", style.badge)}>{alert.severity}</Badge>
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {alert.entity_name}
          </span>
        </div>
        <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{alert.alert_type}</p>
        {alert.suggested_action && (
          <p className="text-xs text-[hsl(var(--portal-accent-blue))] flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {alert.suggested_action}
          </p>
        )}
        <p className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {alert.triggered_at
            ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })
            : "Recently"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(alert.id)}
        className="shrink-0 h-8 w-8 p-0 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))]"
        aria-label="Dismiss alert"
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function ClientIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const {
    alerts,
    criticalCount,
    isLoading: alertsLoading,
    connectionStatus: alertsStatus,
    markAsRead,
    refresh: refreshAlerts,
  } = useRealtimeAlerts(organizationId || undefined);
  const {
    trends,
    isLoading: trendsLoading,
    connectionStatus: trendsStatus,
    refresh: refreshTrends,
  } = useRealtimeTrends();

  const [recentNews, setRecentNews] = useState<Article[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [alertFilter, setAlertFilter] = useState<AlertSeverity>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCreativeData, setHasCreativeData] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadAdditionalData = useCallback(async () => {
    if (!organizationId) return;

    try {
      // Parallel fetch all data
      const [articlesResult, watchCountResult, smsCountResult, metaCountResult] = await Promise.all([
        supabase
          .from("articles")
          .select("id, title, source_name, published_date, sentiment_label, category")
          .order("published_date", { ascending: false })
          .limit(10),
        supabase
          .from("entity_watchlist")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("is_active", true),
        supabase
          .from("sms_creative_insights")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        supabase
          .from("meta_creative_insights")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organizationId),
      ]);

      if (articlesResult.data) setRecentNews(articlesResult.data);
      setWatchlistCount(watchCountResult.count || 0);
      setHasCreativeData((smsCountResult.count || 0) > 0 || (metaCountResult.count || 0) > 0);
    } catch (error) {
      console.error("Error loading intelligence data:", error);
    } finally {
      setNewsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadAdditionalData();
  }, [loadAdditionalData]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshAlerts(), refreshTrends(), loadAdditionalData()]);
      toast.success("Intelligence data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAllRead = () => {
    alerts.forEach((alert) => markAsRead(alert.id));
    toast.success("All alerts marked as read");
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const filteredAlerts = alertFilter === "all" ? alerts : alerts.filter((a) => a.severity === alertFilter);

  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    medium: alerts.filter((a) => a.severity === "medium").length,
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (orgLoading) {
    return (
      <ClientShell pageTitle="Intelligence Center">
        <div className="p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </ClientShell>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <ClientShell pageTitle="Intelligence Center" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Activity className="h-6 w-6 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                Intelligence Center
              </h1>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                Real-time alerts, trends, and strategic insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatusBadge alertsStatus={alertsStatus} trendsStatus={trendsStatus} />
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className={cn(
                "gap-2",
                "bg-[hsl(var(--portal-bg-secondary))]",
                "border-[hsl(var(--portal-border))]",
                "text-[hsl(var(--portal-text-primary))]",
                "hover:bg-[hsl(var(--portal-bg-hover))]"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh All
            </Button>
          </div>
        </header>

        {/* Critical Alerts Panel */}
        <ChartPanel
          title="Critical Alerts"
          description="Monitor and respond to high-priority alerts"
          icon={AlertTriangle}
          status={
            criticalCount > 0
              ? { text: `${criticalCount} Critical`, variant: "error" }
              : { text: "All Clear", variant: "success" }
          }
          actions={
            <div className="flex items-center gap-2">
              {alerts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-xs h-7 text-[hsl(var(--portal-text-muted))]"
                >
                  Mark all read
                </Button>
              )}
            </div>
          }
          isLoading={alertsLoading}
          isEmpty={filteredAlerts.length === 0 && !alertsLoading}
          emptyMessage={`No ${alertFilter !== "all" ? alertFilter : ""} alerts at this time`}
          minHeight={320}
        >
          <div className="space-y-4">
            {/* Filter Tabs */}
            <Tabs value={alertFilter} onValueChange={(v) => setAlertFilter(v as AlertSeverity)}>
              <TabsList className="h-9 bg-[hsl(var(--portal-bg-elevated))]">
                <TabsTrigger value="all" className="text-xs px-3">
                  All ({alertCounts.all})
                </TabsTrigger>
                <TabsTrigger value="critical" className="text-xs px-3">
                  Critical ({alertCounts.critical})
                </TabsTrigger>
                <TabsTrigger value="high" className="text-xs px-3">
                  High ({alertCounts.high})
                </TabsTrigger>
                <TabsTrigger value="medium" className="text-xs px-3">
                  Medium ({alertCounts.medium})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Alert List */}
            {filteredAlerts.length > 0 && (
              <ScrollArea className="h-[280px] pr-3">
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {filteredAlerts.map((alert) => (
                      <AlertItem key={alert.id} alert={alert} onDismiss={markAsRead} />
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            )}

            {/* View All Link */}
            <div className="pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
              <Link to="/client/alerts">
                <Button
                  variant="outline"
                  className="w-full gap-2 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
                >
                  View All Alerts
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </ChartPanel>

        {/* Two Column: Trends + Watchlist/News */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trending Topics Panel */}
          <div className="lg:col-span-2">
            <ChartPanel
              title="Trending Topics"
              description="Real-time topic velocity and mentions"
              icon={TrendingUp}
              status={{ text: "Top 15", variant: "info" }}
              isLoading={trendsLoading}
              isEmpty={trends.length === 0 && !trendsLoading}
              emptyMessage="No trending topics detected"
              minHeight={400}
            >
              <ScrollArea className="h-[380px] pr-3">
                <div className="space-y-2">
                  {trends.map((trend, index) => (
                    <motion.div
                      key={trend.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        "bg-[hsl(var(--portal-bg-secondary))]",
                        "border border-[hsl(var(--portal-border))]",
                        "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-lg font-bold text-[hsl(var(--portal-text-muted))] w-6 text-center tabular-nums">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-[hsl(var(--portal-text-primary))]">
                            {trend.entity_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
                            <span>{trend.mentions_24h || 0} mentions (24h)</span>
                            {trend.is_trending && (
                              <Badge className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                                <Zap className="h-3 w-3 mr-1" />
                                Hot
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {trend.velocity !== null && trend.velocity !== undefined && (
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            trend.velocity > 0
                              ? "text-[hsl(var(--portal-success))]"
                              : trend.velocity < 0
                              ? "text-[hsl(var(--portal-error))]"
                              : "text-[hsl(var(--portal-text-muted))]"
                          )}
                        >
                          {trend.velocity > 0 ? "+" : ""}
                          {Math.round(trend.velocity)}%
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </ChartPanel>
          </div>

          {/* Watchlist & News Column */}
          <div className="space-y-6">
            {/* Watchlist Status Card */}
            <ChartPanel
              title="Watchlist Status"
              description="Entities you're monitoring"
              icon={Eye}
              minHeight={140}
            >
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                  {watchlistCount}
                </div>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Active Entities</p>
              </div>
              <Link to="/client/watchlist">
                <Button
                  variant="outline"
                  className="w-full gap-2 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
                >
                  Manage Watchlist
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </ChartPanel>

            {/* Connection Status Card */}
            <div
              className={cn(
                "rounded-xl border p-4",
                "bg-[hsl(var(--portal-bg-secondary))]",
                "border-[hsl(var(--portal-border))]"
              )}
            >
              <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">
                Connection Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricChip
                  label="Alerts Feed"
                  value={alertsStatus === "connected" ? "Connected" : "Offline"}
                  variant={alertsStatus === "connected" ? "success" : "error"}
                  icon={alertsStatus === "connected" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                />
                <MetricChip
                  label="Trends Feed"
                  value={trendsStatus === "connected" ? "Connected" : "Offline"}
                  variant={trendsStatus === "connected" ? "success" : "error"}
                  icon={trendsStatus === "connected" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sentiment Analysis Panel */}
        <ChartPanel
          title="Sentiment Analysis"
          description="Historical sentiment trends across news sources"
          icon={TrendingUp}
          minHeight={400}
        >
          <Suspense
            fallback={
              <div className="h-[400px] flex items-center justify-center">
                <div className="space-y-3 text-center">
                  <div className="w-8 h-8 border-2 border-t-transparent border-[hsl(var(--portal-accent-blue))] rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Loading chart...</p>
                </div>
              </div>
            }
          >
            <SentimentTrendChart />
          </Suspense>
        </ChartPanel>

        {/* Recent News Panel */}
        <ChartPanel
          title="Recent Headlines"
          description="Latest news articles from monitored sources"
          icon={Newspaper}
          status={{ text: "Latest 10", variant: "info" }}
          isLoading={newsLoading}
          isEmpty={recentNews.length === 0 && !newsLoading}
          emptyMessage="No recent news articles"
          minHeight={300}
        >
          <div className="space-y-2">
            {recentNews.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  "flex items-start justify-between p-3 rounded-lg",
                  "bg-[hsl(var(--portal-bg-secondary))]",
                  "border border-[hsl(var(--portal-border))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-sm line-clamp-2 text-[hsl(var(--portal-text-primary))]">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="outline" className="text-xs bg-[hsl(var(--portal-bg-elevated))]">
                      {article.source_name}
                    </Badge>
                    <span className="text-[hsl(var(--portal-text-muted))]">
                      {format(new Date(article.published_date), "MMM d, h:mm a")}
                    </span>
                    <SentimentBadge sentiment={article.sentiment_label} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <Link to="/client/news">
              <Button
                variant="outline"
                className="w-full gap-2 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
              >
                View Full News Feed
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </ChartPanel>

        {/* Creative Intelligence Panel */}
        {organizationId && (
          <>
            {!hasCreativeData && !showImport ? (
              <ChartPanel
                title="Creative Intelligence"
                description="AI-powered insights on what messaging works best"
                icon={Sparkles}
                minHeight={200}
                className="border-dashed"
              >
                <div className="py-6 text-center">
                  <div className="p-3 rounded-full bg-[hsl(var(--portal-accent-blue)/0.1)] w-fit mx-auto mb-4">
                    <Zap className="h-8 w-8 text-[hsl(var(--portal-accent-blue))]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--portal-text-primary))]">
                    Unlock Creative Intelligence
                  </h3>
                  <p className="text-[hsl(var(--portal-text-muted))] max-w-md mx-auto mb-4">
                    Import your SMS and Meta ad data to get AI-powered insights on what messaging works
                    best for your audience.
                  </p>
                  <Button onClick={() => setShowImport(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import Campaign Data
                  </Button>
                </div>
              </ChartPanel>
            ) : showImport ? (
              <ChartPanel
                title="Import Creative Data"
                description="Upload your campaign data to unlock insights"
                icon={Upload}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>
                    Cancel
                  </Button>
                }
                minHeight={300}
              >
                <CreativeDataImport
                  organizationId={organizationId}
                  onImportComplete={() => {
                    setShowImport(false);
                    setHasCreativeData(true);
                    loadAdditionalData();
                  }}
                />
              </ChartPanel>
            ) : (
              <ChartPanel
                title="Creative Intelligence"
                description="AI-powered insights on your campaign performance"
                icon={Sparkles}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImport(true)}
                    className="gap-2 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import More Data
                  </Button>
                }
                minHeight={400}
              >
                <CreativeInsights organizationId={organizationId} />
              </ChartPanel>
            )}
          </>
        )}
      </div>
    </ClientShell>
  );
}
