import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, parseISO, differenceInDays } from "date-fns";
import { Building2, DollarSign, AlertTriangle, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ClientCard, ClientCardData } from "./ClientCard";
import { ClientSortFilter, SortOption, FilterOption } from "./ClientSortFilter";
import { AdminAlertsBanner } from "./AdminAlertsBanner";
import { TrendingTopicsWidget } from "./TrendingTopicsWidget";
import { HighImpactNewsWidget } from "./HighImpactNewsWidget";
import { GlobalAlertsTimeline } from "./GlobalAlertsTimeline";
import { CustomizableDashboard, WidgetConfig } from "@/components/dashboard/CustomizableDashboard";
import { useNavigate } from "react-router-dom";

interface SummaryStats {
  activeClients: number;
  totalRevenue: number;
  needsAttention: number;
  criticalAlerts: number;
}

interface AlertData {
  id: string;
  entityName: string;
  alertType: string;
  severity: string;
  triggeredAt: string;
  organizationName: string;
  organizationId: string;
}

export function AdminDashboardHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<ClientCardData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    activeClients: 0,
    totalRevenue: 0,
    needsAttention: 0,
    criticalAlerts: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("revenue");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const fetchData = async () => {
    try {
      const today = new Date();
      const fourteenDaysAgo = subDays(today, 14);
      const sevenDaysAgo = subDays(today, 7);

      const [orgsResult, usersResult, metricsResult, alertsResult, credentialsResult] = await Promise.all([
        supabase.from("client_organizations").select("id, name, slug, logo_url, is_active"),
        supabase.from("client_users").select("organization_id, last_login_at"),
        supabase.from("daily_aggregated_metrics").select("*").gte("date", fourteenDaysAgo.toISOString().split("T")[0]),
        supabase.from("client_entity_alerts").select("id, entity_name, alert_type, severity, triggered_at, organization_id, is_read").eq("is_read", false),
        supabase.from("client_api_credentials").select("organization_id, platform, is_active, last_sync_status"),
      ]);

      if (orgsResult.error) throw orgsResult.error;

      const orgs = orgsResult.data || [];
      const users = usersResult.data || [];
      const metrics = metricsResult.data || [];
      const alertsData = alertsResult.data || [];
      const credentials = credentialsResult.data || [];

      const clientData: ClientCardData[] = orgs.map((org) => {
        const orgUsers = users.filter((u) => u.organization_id === org.id);
        const lastLogin = orgUsers
          .map((u) => u.last_login_at)
          .filter(Boolean)
          .sort()
          .reverse()[0] || null;
        const isStale = lastLogin ? differenceInDays(today, parseISO(lastLogin)) > 7 : true;

        const orgMetrics = metrics.filter((m) => m.organization_id === org.id);
        const current7Days = orgMetrics.filter((m) => parseISO(m.date) >= sevenDaysAgo);
        const previous7Days = orgMetrics.filter((m) => parseISO(m.date) < sevenDaysAgo && parseISO(m.date) >= fourteenDaysAgo);

        const sumMetrics = (data: typeof orgMetrics, field: keyof typeof orgMetrics[0]) =>
          data.reduce((sum, m) => sum + (Number(m[field]) || 0), 0);

        const currentRevenue = sumMetrics(current7Days, "total_funds_raised");
        const previousRevenue = sumMetrics(previous7Days, "total_funds_raised");
        const currentSpend = sumMetrics(current7Days, "total_ad_spend") + sumMetrics(current7Days, "total_sms_cost");
        const previousSpend = sumMetrics(previous7Days, "total_ad_spend") + sumMetrics(previous7Days, "total_sms_cost");
        const currentDonations = sumMetrics(current7Days, "total_donations");
        const previousDonations = sumMetrics(previous7Days, "total_donations");

        const currentROI = currentSpend > 0 ? ((currentRevenue - currentSpend) / currentSpend) * 100 : 0;
        const previousROI = previousSpend > 0 ? ((previousRevenue - previousSpend) / previousSpend) * 100 : 0;

        const calcChange = (current: number, previous: number) =>
          previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

        const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(today, 6 - i).toISOString().split("T")[0];
          const dayMetric = orgMetrics.find((m) => m.date === date);
          return dayMetric?.total_funds_raised || 0;
        });

        const orgAlerts = alertsData.filter((a) => a.organization_id === org.id);
        const highestSeverity = orgAlerts.reduce<"critical" | "high" | "medium" | "low" | null>((highest, alert) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const alertSev = alert.severity as keyof typeof severityOrder;
          if (!highest) return alertSev;
          return severityOrder[alertSev] > severityOrder[highest] ? alertSev : highest;
        }, null);

        const orgCreds = credentials.filter((c) => c.organization_id === org.id);
        const integrations = orgCreds.map((c) => ({
          platform: c.platform === "meta_ads" ? "Meta" : c.platform === "switchboard_sms" ? "SMS" : c.platform,
          status: (c.is_active && c.last_sync_status === "success" ? "ok" : c.is_active ? "failed" : "none") as "ok" | "failed" | "none",
        }));

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logo_url || undefined,
          isActive: org.is_active || false,
          lastLogin,
          userCount: orgUsers.length,
          isStale,
          revenue: currentRevenue,
          revenueChange: calcChange(currentRevenue, previousRevenue),
          spend: currentSpend,
          spendChange: calcChange(currentSpend, previousSpend),
          roi: currentROI,
          roiChange: currentROI - previousROI,
          donations: currentDonations,
          donationsChange: calcChange(currentDonations, previousDonations),
          integrations,
          unreadAlerts: orgAlerts.length,
          alertSeverity: highestSeverity,
          dailyRevenue,
        };
      });

      const alertsWithOrgNames: AlertData[] = alertsData.map((alert) => {
        const org = orgs.find((o) => o.id === alert.organization_id);
        return {
          id: alert.id,
          entityName: alert.entity_name,
          alertType: alert.alert_type,
          severity: alert.severity || "low",
          triggeredAt: alert.triggered_at || new Date().toISOString(),
          organizationName: org?.name || "Unknown",
          organizationId: alert.organization_id || "",
        };
      });

      const activeCount = clientData.filter((c) => c.isActive).length;
      const totalRev = clientData.reduce((sum, c) => sum + c.revenue, 0);
      const needsAttentionCount = clientData.filter((c) => c.isStale || c.integrations.some((i) => i.status === "failed")).length;
      const criticalCount = alertsWithOrgNames.filter((a) => a.severity === "critical" || a.severity === "high").length;

      setClients(clientData);
      setAlerts(alertsWithOrgNames.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (severityOrder[a.severity as keyof typeof severityOrder] || 3) - (severityOrder[b.severity as keyof typeof severityOrder] || 3);
      }));
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

  const handleDismissAlert = async (alertId: string) => {
    try {
      await supabase.from("client_entity_alerts").update({ is_read: true }).eq("id", alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success("Alert dismissed");
    } catch (error) {
      toast.error("Failed to dismiss alert");
    }
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(query));
    }

    switch (filterBy) {
      case "active":
        result = result.filter((c) => c.isActive);
        break;
      case "inactive":
        result = result.filter((c) => !c.isActive);
        break;
      case "needsAttention":
        result = result.filter((c) => c.isStale || c.unreadAlerts > 0 || c.integrations.some((i) => i.status === "failed"));
        break;
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "revenue":
          return b.revenue - a.revenue;
        case "roi":
          return b.roi - a.roi;
        case "lastLogin":
          if (!a.lastLogin && !b.lastLogin) return 0;
          if (!a.lastLogin) return 1;
          if (!b.lastLogin) return -1;
          return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
        case "alerts":
          return b.unreadAlerts - a.unreadAlerts;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [clients, searchQuery, sortBy, filterBy]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Widget configurations for customizable dashboard - stable references
  const dashboardWidgets: WidgetConfig[] = useMemo(() => [
    {
      id: "trending-topics",
      title: "Trending Topics",
      component: <TrendingTopicsWidget showDragHandle />,
      defaultLayout: { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    },
    {
      id: "high-impact-news",
      title: "High-Impact News",
      component: <HighImpactNewsWidget showDragHandle />,
      defaultLayout: { x: 4, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    },
    {
      id: "alerts-timeline",
      title: "Alerts Timeline",
      component: <GlobalAlertsTimeline showDragHandle />,
      defaultLayout: { x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
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
        <Skeleton className="h-32" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold portal-text-primary">Client Monitoring Center</h1>
          <p className="portal-text-secondary">Monitor performance and health across all organizations</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 portal-btn-secondary">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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

      {/* Alerts Banner */}
      <AdminAlertsBanner
        alerts={alerts}
        onViewAll={() => navigate("/admin?tab=ops")}
        onDismiss={handleDismissAlert}
      />

      {/* Customizable Dashboard Area - Always visible */}
      <CustomizableDashboard
        storageKey="admin-dashboard-layout"
        widgets={dashboardWidgets}
      />

      {/* Clients Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold portal-text-primary flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Clients
            <span className="text-sm font-normal portal-text-secondary">({filteredClients.length})</span>
          </h2>
          <ClientSortFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterBy={filterBy}
            onFilterChange={setFilterBy}
          />
        </div>

        {filteredClients.length === 0 ? (
          <div className="portal-card py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto portal-text-secondary mb-4" />
            <h3 className="text-lg font-semibold portal-text-primary mb-2">No clients found</h3>
            <p className="portal-text-secondary">
              {searchQuery ? "Try adjusting your search or filters" : "Add your first client organization to get started"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
