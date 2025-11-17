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
  ChevronDown,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarSearch } from "@/components/admin/SidebarSearch";
import { RecentItems } from "@/components/admin/RecentItems";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";

export interface NavigationItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  requiredRole?: 'admin' | 'manager';
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
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
  const collapsed = !isMobile && state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // localStorage for collapsed groups state
  const [collapsedGroups, setCollapsedGroups] = useLocalStorage<Record<string, boolean>>(
    'admin-sidebar-collapsed-groups',
    {}
  );
  
  // localStorage for recent items
  const [recentItemValues, setRecentItemValues] = useLocalStorage<string[]>(
    'admin-sidebar-recent-items',
    []
  );

  const handleTabChange = (value: string) => {
    onTabChange(value);
    
    // Add to recent items (max 5)
    setRecentItemValues((prev) => {
      const filtered = prev.filter(v => v !== value);
      return [value, ...filtered].slice(0, 5);
    });
    
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

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  // Get recent items with full data
  const recentItems = recentItemValues
    .map(value => {
      for (const group of navigationGroups) {
        const item = group.items.find(i => i.value === value);
        if (item && hasAccess(item)) return item;
      }
      return null;
    })
    .filter((item): item is NavigationItem => item !== null);

  // Filter groups and items based on search
  const filteredGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => 
        hasAccess(item) && 
        (searchTerm === "" || 
         item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
         group.label.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }))
    .filter(group => group.items.length > 0);

  // Auto-expand group containing active item or search results
  const shouldGroupBeExpanded = (groupLabel: string) => {
    if (searchTerm) return true; // Expand all when searching
    const group = navigationGroups.find(g => g.label === groupLabel);
    if (!group) return false;
    const hasActiveItem = group.items.some(item => item.value === activeTab);
    if (hasActiveItem) return true;
    return !collapsedGroups[groupLabel];
  };

  return (
    <Sidebar 
      className={cn(
        collapsed ? "w-16" : "w-64",
        "border-r border-border bg-background transition-all duration-300"
      )}
      collapsible="icon"
    >
      <SidebarContent className="py-6 px-2" role="navigation" aria-label="Admin navigation">
        {/* Search */}
        <SidebarSearch 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          collapsed={collapsed}
        />

        {/* Recent Items */}
        {!searchTerm && (
          <RecentItems
            recentItems={recentItems}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            collapsed={collapsed}
          />
        )}

        {/* Navigation Groups */}
        {filteredGroups.map((group, groupIndex) => {
          const isExpanded = shouldGroupBeExpanded(group.label);
          
          return (
            <Collapsible
              key={group.label}
              open={isExpanded}
              onOpenChange={() => !searchTerm && toggleGroup(group.label)}
            >
              <SidebarGroup className="mb-4">
                {!collapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className={cn(
                      "text-muted-foreground text-sm font-bold tracking-wider uppercase",
                      "px-4 py-2 mb-2 opacity-90 bg-muted/30 rounded-md border-b border-border/50",
                      "flex items-center justify-between cursor-pointer",
                      "hover:bg-muted/50 transition-colors",
                      "group"
                    )}>
                      <span>{group.label}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded ? "rotate-0" : "-rotate-90"
                      )} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">
                      {group.items.map((item) => {
                        // Highlight matching text when searching
                        const itemTitle = searchTerm 
                          ? highlightMatch(item.title, searchTerm)
                          : item.title;
                        
                        return (
                          <SidebarMenuItem key={item.value}>
                            <SidebarMenuButton
                              onClick={() => handleTabChange(item.value)}
                              isActive={activeTab === item.value}
                              tooltip={collapsed ? item.title : undefined}
                              aria-current={activeTab === item.value ? 'page' : undefined}
                              className={cn(
                                "relative w-full min-h-[48px]",
                                collapsed ? 'justify-center px-0' : 'justify-start px-4',
                                "gap-3 py-3 rounded-lg transition-all duration-200",
                                "hover:bg-accent hover:text-accent-foreground",
                                activeTab === item.value 
                                  ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground font-semibold shadow-lg border-l-4 border-primary-foreground/50' 
                                  : 'text-foreground hover:font-medium hover:shadow-sm'
                              )}
                            >
                              <item.icon className={cn(
                                collapsed ? 'h-6 w-6' : 'h-5 w-5',
                                "shrink-0 transition-transform duration-200",
                                activeTab === item.value && 'scale-110'
                              )} />
                              {!collapsed && (
                                <span 
                                  className="text-sm leading-tight"
                                  dangerouslySetInnerHTML={{ __html: itemTitle }}
                                />
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
                
                {/* Separator between groups */}
                {groupIndex < filteredGroups.length - 1 && !collapsed && isExpanded && (
                  <div className="h-px bg-border/50 mt-4" />
                )}
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

// Helper function to highlight search matches
function highlightMatch(text: string, search: string): string {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  return text.replace(regex, '<mark class="bg-primary/30 text-foreground rounded px-0.5">$1</mark>');
}
