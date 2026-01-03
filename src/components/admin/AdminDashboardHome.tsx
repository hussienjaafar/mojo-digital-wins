import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, parseISO, differenceInDays } from "date-fns";
import { Building2, DollarSign, AlertTriangle, Users, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { TrendingTopicsWidget } from "./TrendingTopicsWidget";
import { HighImpactNewsWidget } from "./HighImpactNewsWidget";
import { GlobalAlertsTimeline } from "./GlobalAlertsTimeline";
import { GlobalCreativeInsightsWidget } from "./GlobalCreativeInsightsWidget";
import { AlertsBannerWidget } from "./AlertsBannerWidget";
import { ClientsOverviewWidget } from "./ClientsOverviewWidget";
import { CustomizableDashboard, WidgetConfig } from "@/components/dashboard/CustomizableDashboard";
import { AdminPageHeader, AdminStatsGrid, AdminStatItem, AdminLoadingState } from "./v3";

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

      const [orgsResult, usersResult, metricsResult, alertsResult, credentialsResult] = await Promise.all([
        supabase.from("client_organizations").select("id, is_active"),
        supabase.from("client_users").select("organization_id, last_login_at"),
        supabase.from("daily_aggregated_metrics").select("organization_id, date, total_funds_raised").gte("date", sevenDaysAgo.toISOString().split("T")[0]),
        supabase.from("client_entity_alerts").select("id, severity, organization_id").eq("is_read", false),
        supabase.from("client_api_credentials").select("organization_id, is_active, last_sync_status"),
      ]);

      if (orgsResult.error) throw orgsResult.error;

      const orgs = orgsResult.data || [];
      const users = usersResult.data || [];
      const metrics = metricsResult.data || [];
      const alertsData = alertsResult.data || [];
      const credentials = credentialsResult.data || [];

      // Calculate summary stats
      const activeCount = orgs.filter((o) => o.is_active).length;
      const totalRev = metrics.reduce((sum, m) => sum + (Number(m.total_funds_raised) || 0), 0);

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

  // Stats items for the grid
  const statsItems: AdminStatItem[] = useMemo(() => [
    {
      id: "active-clients",
      label: "Active Clients",
      value: summary.activeClients,
      icon: Building2,
      accent: "blue",
    },
    {
      id: "total-revenue",
      label: "Total Revenue (7d)",
      value: formatCurrency(summary.totalRevenue),
      icon: DollarSign,
      accent: "green",
    },
    {
      id: "needs-attention",
      label: "Needs Attention",
      value: summary.needsAttention,
      icon: Users,
      accent: summary.needsAttention > 0 ? "amber" : "default",
    },
    {
      id: "critical-alerts",
      label: "Critical Alerts",
      value: summary.criticalAlerts,
      icon: AlertTriangle,
      accent: summary.criticalAlerts > 0 ? "red" : "default",
    },
  ], [summary]);

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
    return <AdminLoadingState variant="page" count={3} />;
  }

  return (
    <div className="space-y-6 portal-animate-fade-in">
      {/* Header with V3 Styling */}
      <AdminPageHeader
        title="Client Monitoring Center"
        description="Monitor performance and health across all organizations"
        icon={LayoutDashboard}
        iconColor="blue"
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
      />

      {/* Summary Stats with V3 KPI Cards */}
      <AdminStatsGrid items={statsItems} isLoading={refreshing} columns={4} />

      {/* Customizable Dashboard with All Widgets */}
      <CustomizableDashboard
        storageKey="admin-dashboard-layout-v2"
        widgets={dashboardWidgets}
      />
    </div>
  );
}
