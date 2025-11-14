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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);

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
      console.error('Error fetching user roles:', error);
    }
  };

  const hasAccess = (item: NavigationItem) => {
    if (!item.requiredRole) return true;
    return userRoles.includes(item.requiredRole);
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.filter(hasAccess).map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      isActive={activeTab === item.value}
                      tooltip={collapsed ? item.title : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
