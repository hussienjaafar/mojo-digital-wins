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
  icon?: React.ComponentType<{ className?: string }>;
  collapsedByDefault?: boolean;
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Overview", icon: LayoutDashboard, value: "analytics" },
    ],
  },
  {
    label: "Clients",
    icon: Building2,
    items: [
      { title: "Organizations", icon: Building2, value: "clients" },
      { title: "Users", icon: Users, value: "client-users" },
      { title: "Reports", icon: Mail, value: "email-reports" },
    ],
  },
  {
    label: "Marketing",
    icon: GitBranch,
    items: [
      { title: "Campaigns", icon: GitBranch, value: "attribution" },
      { title: "API Keys", icon: Key, value: "api-credentials", requiredRole: 'admin' },
      { title: "Sync Schedule", icon: Calendar, value: "scheduler", requiredRole: 'admin' },
    ],
  },
  {
    label: "Content",
    icon: PenTool,
    items: [
      { title: "Messages", icon: MessageSquare, value: "contacts" },
      { title: "Newsletter", icon: Mail, value: "newsletter" },
      { title: "Blog", icon: PenTool, value: "blog-generator" },
    ],
  },
  {
    label: "Admin",
    icon: Shield,
    collapsedByDefault: true,
    items: [
      { title: "Users", icon: UserCog, value: "users", requiredRole: 'admin' },
      { title: "Invites", icon: Shield, value: "invite-codes", requiredRole: 'admin' },
      { title: "Sessions", icon: Activity, value: "sessions", requiredRole: 'admin' },
      { title: "Audit Log", icon: FileText, value: "audit-logs", requiredRole: 'admin' },
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
  const shouldGroupBeExpanded = (group: NavigationGroup) => {
    // If searching, expand groups with matches
    if (searchTerm) {
      return group.items.some(item => 
        hasAccess(item) && 
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Check if active tab is in this group
    const hasActiveItem = group.items.some(item => item.value === activeTab);
    if (hasActiveItem) return true;
    
    // Dashboard group is always expanded, Admin group collapsed by default
    if (group.collapsedByDefault !== undefined) {
      // Use stored state if exists, otherwise use collapsedByDefault
      return collapsedGroups[group.label] !== undefined 
        ? !collapsedGroups[group.label]
        : !group.collapsedByDefault;
    }
    
    // Otherwise use stored state (default to expanded)
    return !collapsedGroups[group.label];
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
          const accessibleItems = group.items.filter(item => hasAccess(item));
          const isExpanded = shouldGroupBeExpanded(group);
          
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
                      <span className="flex items-center gap-2">
                        {group.icon && <group.icon className="h-4 w-4 opacity-70" />}
                        {group.label}
                        <span className="text-xs opacity-60 ml-1 font-normal normal-case">
                          ({accessibleItems.length})
                        </span>
                      </span>
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
