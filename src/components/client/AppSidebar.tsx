import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Bell,
  Eye,
  Target,
  TrendingUp,
  BarChart3,
  DollarSign,
  UserCircle,
  Settings,
  Activity,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  organizationId?: string;
}

export function AppSidebar({ organizationId }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const [stats, setStats] = useState({
    alerts: 0,
    actions: 0,
    opportunities: 0,
  });

  useEffect(() => {
    if (organizationId) {
      loadStats();
    }
  }, [organizationId]);

  const loadStats = async () => {
    try {
      const sb = supabase as any;

      const { count: alertCount } = await sb
        .from('client_entity_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_read', false)
        .in('severity', ['critical', 'high']);

      const { count: actionCount } = await sb
        .from('suggested_actions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      const { count: opportunityCount } = await sb
        .from('fundraising_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      setStats({
        alerts: alertCount || 0,
        actions: actionCount || 0,
        opportunities: opportunityCount || 0,
      });
    } catch (error) {
      console.error('Error loading sidebar stats:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const sections = [
    {
      label: "Overview",
      items: [
        { title: "Dashboard", url: "/client-dashboard", icon: Home },
      ],
    },
    {
      label: "Intelligence Hub",
      items: [
        { title: "News Feed", url: "/", icon: Activity },
        { title: "Entity Watchlist", url: "/client-watchlist", icon: Eye },
        { title: "Polling Intelligence", url: "/polling-intelligence", icon: BarChart3 },
        { title: "Polling Alerts", url: "/client-polling-alerts", icon: Bell },
      ],
    },
    {
      label: "Alerts & Actions",
      items: [
        { title: "Critical Alerts", url: "/client-alerts", icon: Bell, badge: stats.alerts },
        { title: "Suggested Actions", url: "/client-actions", icon: Target, badge: stats.actions },
        { title: "Opportunities", url: "/client-opportunities", icon: DollarSign, badge: stats.opportunities },
      ],
    },
    {
      label: "Performance",
      items: [
        { title: "Demographics", url: "/client-demographics", icon: UserCircle },
        { title: "Donor Journey", url: "/client-donor-journey", icon: TrendingUp },
      ],
    },
    {
      label: "Settings",
      items: [
        { title: "Profile", url: "/client-profile", icon: Settings },
      ],
    },
  ];

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          "hover:bg-muted/50",
                          active && "bg-secondary/10 text-secondary font-medium hover:bg-secondary/20"
                        )}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <Icon className={cn("h-5 w-5", active && "text-secondary")} />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1">{item.title}</span>
                              {item.badge !== undefined && item.badge > 0 && (
                                <Badge variant="destructive" className="ml-auto">
                                  {item.badge}
                                </Badge>
                              )}
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
