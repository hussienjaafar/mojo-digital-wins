import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
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
      label: "Main",
      items: [
        { title: "Dashboard", url: "/client-dashboard", icon: Home },
        { title: "Intelligence", url: "/", icon: Activity },
        { title: "Watchlist", url: "/client-watchlist", icon: Eye },
        { title: "Alerts", url: "/client-alerts", icon: Bell, badge: stats.alerts },
        { title: "Profile", url: "/client-profile", icon: Settings },
      ],
    },
  ];

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" role="navigation" aria-label="Main navigation">
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
                        <Link 
                          to={item.url} 
                          className="flex items-center gap-3"
                          aria-label={item.badge && item.badge > 0 ? `${item.title} (${item.badge} items)` : item.title}
                          aria-current={active ? 'page' : undefined}
                        >
                          <Icon className={cn("h-5 w-5", active && "text-secondary")} aria-hidden="true" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1">{item.title}</span>
                              {item.badge !== undefined && item.badge > 0 && (
                                <Badge variant="destructive" className="ml-auto" aria-label={`${item.badge} unread`}>
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
