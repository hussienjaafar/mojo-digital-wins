import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Bell,
  Eye,
  Target,
  TrendingUp,
  BarChart3,
  Users,
  Settings,
  Zap,
  GitBranch,
  Sparkles,
  Brain,
  User,
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
import type { SidebarNavSection } from "@/lib/design-tokens";

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

  // New Information Architecture structure
  const sections = useMemo(() => [
    {
      label: "Overview",
      items: [
        { title: "Dashboard", url: "/client/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Acquisition",
      items: [
        { title: "Opportunities", url: "/client/opportunities", icon: Target, badge: stats.opportunities },
        { title: "Suggested Actions", url: "/client/actions", icon: Zap, badge: stats.actions },
      ],
    },
    {
      label: "Donors",
      items: [
        { title: "Demographics", url: "/client/demographics", icon: Users },
        { title: "Attribution & Performance", url: "/client/journey", icon: GitBranch },
        { title: "Donor Intelligence", url: "/client/donor-intelligence", icon: Brain },
      ],
    },
    {
      label: "Creative Intelligence",
      items: [
        { title: "Creative Analysis", url: "/client/creative-intelligence", icon: Sparkles },
      ],
    },
    {
      label: "Media & News",
      items: [
        { title: "Media Intelligence", url: "/client/media-intelligence", icon: Eye },
      ],
    },
    {
      label: "Watchlist & Alerts",
      items: [
        { title: "Entity Watchlist", url: "/client/watchlist", icon: Eye },
        { title: "Critical Alerts", url: "/client/alerts", icon: Bell, badge: stats.alerts },
        { title: "Polling Alerts", url: "/client/polling-alerts", icon: BarChart3 },
      ],
    },
    {
      label: "Settings",
      items: [
        { title: "Profile", url: "/client/profile", icon: User },
        { title: "Settings", url: "/client/settings", icon: Settings },
      ],
    },
  ], [stats]);

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="portal-sidebar">
      <SidebarContent>
        <nav role="navigation" aria-label="Client navigation">
          {sections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel
                className="text-xs font-semibold uppercase tracking-wider portal-text-muted"
              >
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url);
                    const hasBadge = item.badge !== undefined && item.badge > 0;

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={isCollapsed ? item.title : undefined}
                          className={cn(
                            "relative transition-colors",
                            "hover:bg-[hsl(var(--portal-bg-hover))]",
                            active && [
                              "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                              "text-[hsl(var(--portal-accent-blue))]",
                              "font-medium",
                              "hover:bg-[hsl(var(--portal-accent-blue)/0.15)]",
                              "border-l-2 border-[hsl(var(--portal-accent-blue))]",
                            ]
                          )}
                        >
                          <Link
                            to={item.url}
                            className="flex items-center gap-3"
                            aria-current={active ? "page" : undefined}
                          >
                            <Icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                active
                                  ? "text-[hsl(var(--portal-accent-blue))]"
                                  : "text-[hsl(var(--portal-text-secondary))]"
                              )}
                              aria-hidden="true"
                            />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 truncate">{item.title}</span>
                                {hasBadge && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-auto shrink-0 h-5 min-w-[1.25rem] px-1.5"
                                  >
                                    {item.badge}
                                  </Badge>
                                )}
                              </>
                            )}
                            {/* Badge dot indicator when collapsed */}
                            {isCollapsed && hasBadge && (
                              <span
                                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive"
                                aria-label={`${item.badge} notifications`}
                              />
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
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
