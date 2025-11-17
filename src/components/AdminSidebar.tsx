import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Building2,
  Users,
  Key,
  GitBranch,
  Calendar,
  UserCog,
  Shield,
  Activity,
  FileText,
  MessageSquare,
  Mail,
  PenTool,
} from "lucide-react";
import { logger } from "@/lib/logger";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavigationItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  requiredRole?: 'admin' | 'manager';
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Overview & Analytics",
    items: [
      { title: "Analytics Dashboard", icon: LayoutDashboard, value: "analytics" },
    ],
  },
  {
    label: "Client Management",
    items: [
      { title: "Client Organizations", icon: Building2, value: "clients" },
      { title: "Client Users", icon: Users, value: "client-users" },
      { title: "Email Reports", icon: Mail, value: "email-reports" },
    ],
  },
  {
    label: "Platform Integration",
    items: [
      { title: "API Credentials", icon: Key, value: "api-credentials", requiredRole: 'admin' },
      { title: "Campaign Attribution", icon: GitBranch, value: "attribution" },
      { title: "Sync Scheduler", icon: Calendar, value: "scheduler", requiredRole: 'admin' },
    ],
  },
  {
    label: "System Administration",
    items: [
      { title: "User Management", icon: UserCog, value: "users", requiredRole: 'admin' },
      { title: "Admin Invite Codes", icon: Shield, value: "invite-codes", requiredRole: 'admin' },
      { title: "Session Management", icon: Activity, value: "sessions", requiredRole: 'admin' },
      { title: "Audit Logs", icon: FileText, value: "audit-logs", requiredRole: 'admin' },
    ],
  },
  {
    label: "Content & Communications",
    items: [
      { title: "Contact Submissions", icon: MessageSquare, value: "contacts" },
      { title: "Newsletter", icon: Mail, value: "newsletter" },
      { title: "Blog Generator", icon: PenTool, value: "blog-generator" },
    ],
  },
];

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  // Collapse only on desktop; on mobile the sheet should always show full labels
  const collapsed = !isMobile && state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const handleTabChange = (value: string) => {
    onTabChange(value);
    // Close mobile menu when item is selected
    if (isMobile && setOpenMobile) {
      setOpenMobile(false);
    }
  };

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      setUserRoles(data?.map((r: any) => r.role) || []);
    } catch (error) {
      logger.error('Failed to fetch user roles', error);
    }
  };

  const hasAccess = (item: NavigationItem) => {
    if (!item.requiredRole) return true;
    return userRoles.includes(item.requiredRole);
  };

  return (
    <Sidebar 
      className={`
        ${collapsed ? "w-16" : "w-64"} 
        border-r border-border 
        bg-background
        transition-all duration-300
      `} 
      collapsible="icon"
    >
      <SidebarContent className="py-6 px-2">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="mb-6">
            {!collapsed && (
              <SidebarGroupLabel className="
                text-muted-foreground 
                text-xs 
                font-bold 
                tracking-wider 
                uppercase 
                px-4 
                mb-3
                opacity-70
              ">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {group.items.filter(hasAccess).map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => handleTabChange(item.value)}
                      isActive={activeTab === item.value}
                      tooltip={collapsed ? item.title : undefined}
                      className={`
                        w-full 
                        min-h-[48px]
                        ${collapsed ? 'justify-center px-0' : 'justify-start px-4'}
                        gap-3 
                        py-3
                        rounded-lg
                        transition-all duration-200
                        hover:bg-accent hover:text-accent-foreground
                        ${activeTab === item.value 
                          ? 'bg-primary text-primary-foreground font-semibold shadow-md scale-[1.02]' 
                          : 'text-foreground hover:font-medium'
                        }
                      `}
                    >
                      <item.icon className={`${collapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0`} />
                      {!collapsed && (
                        <span className="text-sm leading-tight">{item.title}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
