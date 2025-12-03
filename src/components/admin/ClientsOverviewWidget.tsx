import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, parseISO, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  GripVertical,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Props = {
  showDragHandle?: boolean;
};

type ClientData = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  revenue: number;
  revenueChange: number;
  unreadAlerts: number;
  alertSeverity: string | null;
  isStale: boolean;
};

export function ClientsOverviewWidget({ showDragHandle }: Props) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const today = new Date();
      const fourteenDaysAgo = subDays(today, 14);
      const sevenDaysAgo = subDays(today, 7);

      const [orgsResult, usersResult, metricsResult, alertsResult] = await Promise.all([
        supabase.from("client_organizations").select("id, name, slug, logo_url, is_active"),
        supabase.from("client_users").select("organization_id, last_login_at"),
        supabase.from("daily_aggregated_metrics").select("*").gte("date", fourteenDaysAgo.toISOString().split("T")[0]),
        supabase.from("client_entity_alerts").select("organization_id, severity").eq("is_read", false),
      ]);

      if (orgsResult.error) throw orgsResult.error;

      const orgs = orgsResult.data || [];
      const users = usersResult.data || [];
      const metrics = metricsResult.data || [];
      const alertsData = alertsResult.data || [];

      const clientData: ClientData[] = orgs.map((org) => {
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
        const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : currentRevenue > 0 ? 100 : 0;

        const orgAlerts = alertsData.filter((a) => a.organization_id === org.id);
        const highestSeverity = orgAlerts.reduce<string | null>((highest, alert) => {
          const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
          const alertSev = alert.severity || "low";
          if (!highest) return alertSev;
          return (severityOrder[alertSev] || 0) > (severityOrder[highest] || 0) ? alertSev : highest;
        }, null);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo_url: org.logo_url,
          is_active: org.is_active || false,
          revenue: currentRevenue,
          revenueChange,
          unreadAlerts: orgAlerts.length,
          alertSeverity: highestSeverity,
          isStale,
        };
      });

      // Sort by revenue descending
      clientData.sort((a, b) => b.revenue - a.revenue);
      setClients(clientData);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients.slice(0, 8);
    const query = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8);
  }, [clients, searchQuery]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="portal-card h-full">
        <div className="p-4 space-y-3">
          <div className="h-6 w-32 portal-skeleton rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 w-full portal-skeleton rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card h-full flex flex-col">
      <div className={`p-4 border-b border-[hsl(var(--portal-border))] ${showDragHandle ? 'cursor-move' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showDragHandle && (
              <GripVertical className="h-5 w-5 portal-text-secondary" />
            )}
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Building2 className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <h3 className="text-base font-semibold portal-text-primary">Clients</h3>
              <p className="text-xs portal-text-secondary">{clients.length} organizations</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin?tab=clients")}
            className="gap-1 text-xs"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3 border-b border-[hsl(var(--portal-border))]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 portal-text-secondary" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-10 w-10 portal-text-secondary mx-auto mb-3 opacity-50" />
              <p className="portal-text-secondary text-sm">No clients found</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => navigate(`/admin/client/${client.slug}`)}
                className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))] hover:bg-[hsl(var(--portal-muted))] cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--portal-muted))] flex items-center justify-center shrink-0 overflow-hidden">
                  {client.logo_url ? (
                    <img src={client.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="h-4 w-4 portal-text-secondary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm portal-text-primary truncate">
                      {client.name}
                    </span>
                    {client.unreadAlerts > 0 && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        client.alertSeverity === "critical" || client.alertSeverity === "high"
                          ? "bg-[hsl(var(--portal-accent-red)/0.1)] text-[hsl(var(--portal-accent-red))]"
                          : "bg-[hsl(var(--portal-accent-orange)/0.1)] text-[hsl(var(--portal-accent-orange))]"
                      }`}>
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        {client.unreadAlerts}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs portal-text-secondary">
                      {formatCurrency(client.revenue)} (7d)
                    </span>
                    {client.revenueChange !== 0 && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${
                        client.revenueChange > 0 
                          ? "text-[hsl(var(--portal-accent-green))]" 
                          : "text-[hsl(var(--portal-accent-red))]"
                      }`}>
                        {client.revenueChange > 0 ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        {Math.abs(client.revenueChange).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 portal-text-secondary shrink-0" />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
