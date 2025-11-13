import { useLocation, useNavigate } from "react-router-dom";
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
      { title: "API Credentials", icon: Key, value: "api-credentials" },
      { title: "Campaign Attribution", icon: GitBranch, value: "attribution" },
      { title: "Sync Scheduler", icon: Calendar, value: "scheduler" },
    ],
  },
  {
    label: "System Administration",
    items: [
      { title: "User Management", icon: UserCog, value: "users" },
      { title: "Admin Invite Codes", icon: Shield, value: "invite-codes" },
      { title: "Session Management", icon: Activity, value: "sessions" },
      { title: "Audit Logs", icon: FileText, value: "audit-logs" },
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

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
