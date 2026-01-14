import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, parseISO, differenceInDays } from "date-fns";
import { Building2, DollarSign, AlertTriangle, RefreshCw, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { TrendingTopicsWidget } from "./TrendingTopicsWidget";
import { HighImpactNewsWidget } from "./HighImpactNewsWidget";
import { GlobalAlertsTimeline } from "./GlobalAlertsTimeline";
import { GlobalCreativeInsightsWidget } from "./GlobalCreativeInsightsWidget";
import { AlertsBannerWidget } from "./AlertsBannerWidget";
import { ClientsOverviewWidget } from "./ClientsOverviewWidget";
import { CustomizableDashboard, WidgetConfig } from "@/components/dashboard/CustomizableDashboard";
import { PortalSectionHeader } from "@/components/portal/PortalSectionHeader";

interface SummaryStats {
  activeClients: number;
  totalRevenue: number;
  needsAttention: number;
  criticalAlerts: number;
}

export function AdminDashboardHome() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<SummaryStats>({
    activeClients: 0,
    totalRevenue: 0,
    needsAttention: 0,
    criticalAlerts: 0,
  });

  const fetchData = async () => {
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 7);

      const [orgsResult, usersResult, actblueResult, alertsResult, credentialsResult] = await Promise.all([
        supabase.from("client_organizations").select("id, is_active"),
        supabase.from("client_users").select("organization_id, last_login_at"),
        // Use canonical ActBlue source instead of legacy daily_aggregated_metrics
        (supabase as any).from("actblue_transactions_secure").select("organization_id, amount, transaction_date").gte("transaction_date", sevenDaysAgo.toISOString().split("T")[0]),
        supabase.from("client_entity_alerts").select("id, severity, organization_id").eq("is_read", false),
        supabase.from("client_api_credentials").select("organization_id, is_active, last_sync_status"),
      ]);

      if (orgsResult.error) throw orgsResult.error;

      const orgs = orgsResult.data || [];
      const users = usersResult.data || [];
      const actblueTransactions = actblueResult.data || [];
      const alertsData = alertsResult.data || [];
      const credentials = credentialsResult.data || [];

      // Calculate summary stats from canonical ActBlue source
      const activeCount = orgs.filter((o) => o.is_active).length;
      const totalRev = actblueTransactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      // Calculate needs attention
      const needsAttentionCount = orgs.filter((org) => {
        const orgUsers = users.filter((u) => u.organization_id === org.id);
        const lastLogin = orgUsers.map((u) => u.last_login_at).filter(Boolean).sort().reverse()[0];
        const isStale = lastLogin ? differenceInDays(today, parseISO(lastLogin)) > 7 : true;
        
        const orgCreds = credentials.filter((c) => c.organization_id === org.id);
        const hasFailedIntegration = orgCreds.some((c) => c.is_active && c.last_sync_status !== "success");
        
        return isStale || hasFailedIntegration;
      }).length;

      const criticalCount = alertsData.filter((a) => a.severity === "critical" || a.severity === "high").length;

      setSummary({
        activeClients: activeCount,
        totalRevenue: totalRev,
        needsAttention: needsAttentionCount,
        criticalAlerts: criticalCount,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Widget configurations for customizable dashboard
  const dashboardWidgets: WidgetConfig[] = useMemo(() => [
    {
      id: "active-alerts",
      title: "Active Alerts",
      component: <AlertsBannerWidget showDragHandle />,
      defaultLayout: { x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
    },
    {
      id: "clients-overview",
      title: "Clients Overview",
      component: <ClientsOverviewWidget showDragHandle />,
      defaultLayout: { x: 4, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
    },
    {
      id: "creative-insights",
      title: "Creative Insights",
      component: <GlobalCreativeInsightsWidget showDragHandle />,
      defaultLayout: { x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
    },
    {
      id: "trending-topics",
      title: "Trending Topics",
      component: <TrendingTopicsWidget showDragHandle />,
      defaultLayout: { x: 0, y: 5, w: 4, h: 4, minW: 3, minH: 3 },
    },
    {
      id: "high-impact-news",
      title: "High-Impact News",
      component: <HighImpactNewsWidget showDragHandle />,
      defaultLayout: { x: 4, y: 5, w: 4, h: 4, minW: 3, minH: 3 },
    },
    {
      id: "alerts-timeline",
      title: "Alerts Timeline",
      component: <GlobalAlertsTimeline showDragHandle />,
      defaultLayout: { x: 8, y: 5, w: 4, h: 4, minW: 3, minH: 3 },
    },
  ], []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PortalSectionHeader
        title="Client Monitoring Center"
        subtitle="Monitor performance and health across all organizations"
        icon={LayoutDashboard}
        iconColor="blue"
      >
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 portal-btn-secondary">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PortalSectionHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="portal-metric">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Building2 className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <p className="text-sm portal-text-secondary">Active Clients</p>
              <p className="text-2xl font-bold portal-text-primary">{summary.activeClients}</p>
            </div>
          </div>
        </div>

        <div className="portal-metric">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-green)/0.1)]">
              <DollarSign className="h-5 w-5 text-[hsl(var(--portal-accent-green))]" />
            </div>
            <div>
              <p className="text-sm portal-text-secondary">Total Revenue (7d)</p>
              <p className="text-2xl font-bold portal-text-primary">{formatCurrency(summary.totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="portal-metric">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-orange)/0.1)]">
              <Users className="h-5 w-5 text-[hsl(var(--portal-accent-orange))]" />
            </div>
            <div>
              <p className="text-sm portal-text-secondary">Needs Attention</p>
              <p className="text-2xl font-bold portal-text-primary">{summary.needsAttention}</p>
            </div>
          </div>
        </div>

        <div className="portal-metric">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-red)/0.1)]">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-accent-red))]" />
            </div>
            <div>
              <p className="text-sm portal-text-secondary">Critical Alerts</p>
              <p className="text-2xl font-bold portal-text-primary">{summary.criticalAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Customizable Dashboard with All Widgets */}
      <CustomizableDashboard
        storageKey="admin-dashboard-layout-v2"
        widgets={dashboardWidgets}
      />
    </div>
  );
}
