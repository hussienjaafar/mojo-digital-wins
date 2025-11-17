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
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { SidebarSearch } from "@/components/admin/SidebarSearch";
import { QuickAccess } from "@/components/admin/QuickAccess";
import { FlatSearchResults } from "@/components/admin/FlatSearchResults";
import { KeyboardShortcutsDialog } from "@/components/admin/KeyboardShortcutsDialog";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { cn } from "@/lib/utils";

export interface NavigationItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  requiredRole?: 'admin' | 'manager';
  badge?: {
    count?: number;
    status?: 'success' | 'warning' | 'error' | 'info';
    pulse?: boolean;
  };
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
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // localStorage for collapsed groups state
  const [collapsedGroups, setCollapsedGroups] = useLocalStorage<Record<string, boolean>>(
    'admin-sidebar-collapsed-groups',
    {}
  );
  
  // localStorage for pinned items
  const [pinnedItemValues, setPinnedItemValues] = useLocalStorage<string[]>(
    'admin-sidebar-pinned-items',
    []
  );

  const handleTabChange = (value: string) => {
    onTabChange(value);
    setSearchTerm(""); // Clear search when navigating
    setSearchSelectedIndex(0);
    
    // Close mobile menu when item is selected
    if (isMobile && setOpenMobile) {
      setOpenMobile(false);
    }
  };

  const togglePin = (value: string) => {
    setPinnedItemValues((prev) => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value].slice(0, 4) // Max 4 pinned items
    );
  };

  const fetchUnreadCounts = async () => {
    try {
      // Fetch unread contact submissions
      const { count: contactCount } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      setUnreadCounts({
        contacts: contactCount || 0,
      });
    } catch (error) {
      logger.error('Failed to fetch unread counts', error);
    }
  };

  useEffect(() => {
    fetchUserRoles();
    fetchUnreadCounts();
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

  // Get pinned items with full data
  const pinnedItems = pinnedItemValues
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

  // Get flat search results (all matching items across groups)
  const searchResults = searchTerm
    ? navigationGroups
        .flatMap(group => group.items)
        .filter(item => 
          hasAccess(item) && 
          item.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
    : [];

  // Handle keyboard navigation in search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = searchResults[searchSelectedIndex];
      if (selectedItem) {
        handleTabChange(selectedItem.value);
      }
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcut([
    {
      key: 'b',
      ctrlKey: true,
      metaKey: true,
      callback: () => {
        const newState = state === "collapsed" ? "expanded" : "collapsed";
        // Trigger sidebar toggle
        document.querySelector('[data-sidebar="sidebar"]')?.dispatchEvent(
          new CustomEvent('toggle')
        );
      },
      description: 'Toggle sidebar',
    },
    {
      key: '?',
      shiftKey: true,
      callback: () => setShowShortcutsDialog(true),
      description: 'Show keyboard shortcuts',
    },
    {
      key: 'd',
      callback: () => {
        // Only if 'g' was pressed recently (within 500ms)
        if (recentKey === 'g') {
          handleTabChange('analytics');
          setRecentKey(null);
        }
      },
    },
    {
      key: 'c',
      callback: () => {
        if (recentKey === 'g') {
          handleTabChange('clients');
          setRecentKey(null);
        }
      },
    },
    {
      key: 'm',
      callback: () => {
        if (recentKey === 'g') {
          handleTabChange('contacts');
          setRecentKey(null);
        }
      },
    },
    {
      key: 'a',
      callback: () => {
        if (recentKey === 'g') {
          handleTabChange('attribution');
          setRecentKey(null);
        }
      },
    },
    {
      key: 'g',
      callback: () => setRecentKey('g'),
    },
  ]);

  const [recentKey, setRecentKey] = useState<string | null>(null);

  // Reset recent key after 500ms
  useEffect(() => {
    if (recentKey === 'g') {
      const timeout = setTimeout(() => setRecentKey(null), 500);
      return () => clearTimeout(timeout);
    }
  }, [recentKey]);

  // Reset search selection when search term changes
  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [searchTerm]);

  // Auto-expand group containing active item
  const shouldGroupBeExpanded = (group: NavigationGroup) => {
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

  // Get opacity for visual hierarchy
  const getGroupOpacity = (groupLabel: string) => {
    if (groupLabel === "Dashboard") return "opacity-100";
    if (groupLabel === "Admin") return "opacity-70";
    return "opacity-90";
  };

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

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
          onKeyDown={handleSearchKeyDown}
          collapsed={collapsed}
        />

        {/* Quick Access (Pinned Items) */}
        {!searchTerm && (
          <QuickAccess
            pinnedItems={pinnedItems}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onTogglePin={togglePin}
            collapsed={collapsed}
          />
        )}

        {/* Flat Search Results */}
        {searchTerm && (
          <FlatSearchResults
            items={searchResults}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            searchTerm={searchTerm}
            selectedIndex={searchSelectedIndex}
            collapsed={collapsed}
          />
        )}

        {/* Navigation Groups - Only show when NOT searching */}
        {!searchTerm && filteredGroups.map((group, groupIndex) => {
          const accessibleItems = group.items.filter(item => hasAccess(item));
          const isExpanded = shouldGroupBeExpanded(group);
          const groupOpacity = getGroupOpacity(group.label);
          
          const groupLabel = (
            <SidebarGroupLabel className={cn(
              "text-muted-foreground text-sm font-bold tracking-wider uppercase",
              "px-4 py-2 mb-2 bg-muted/30 rounded-md border-b border-border/50",
              "flex items-center justify-between cursor-pointer",
              "hover:bg-muted/50 transition-colors",
              "group",
              groupOpacity
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
          );
          
          return (
            <Collapsible
              key={group.label}
              open={isExpanded}
              onOpenChange={() => toggleGroup(group.label)}
            >
              <SidebarGroup className="mb-4">
                {!collapsed ? (
                  <CollapsibleTrigger asChild>
                    {groupLabel}
                  </CollapsibleTrigger>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="px-2 mb-2">
                          {group.icon && (
                            <div className="h-8 w-8 mx-auto flex items-center justify-center rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                              <group.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-semibold mb-1">{group.label}</p>
                        <ul className="text-xs space-y-0.5">
                          {accessibleItems.map(item => (
                            <li key={item.value}>• {item.title}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">
                      {group.items.map((item) => {
                        const isPinned = pinnedItemValues.includes(item.value);
                        const badge = item.badge || (item.value === 'contacts' && unreadCounts.contacts > 0 
                          ? { count: unreadCounts.contacts, status: 'info' as const, pulse: true }
                          : undefined);
                        
                        return (
                          <SidebarMenuItem key={item.value}>
                            <SidebarMenuButton
                              onClick={() => handleTabChange(item.value)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                togglePin(item.value);
                              }}
                              isActive={activeTab === item.value}
                              tooltip={collapsed ? item.title : undefined}
                              aria-current={activeTab === item.value ? 'page' : undefined}
                              aria-label={badge?.count ? `${item.title} (${badge.count} unread)` : item.title}
                              className={cn(
                                "relative w-full min-h-[48px] group",
                                collapsed ? 'justify-center px-0' : 'justify-start px-4',
                                "gap-3 py-3 rounded-lg transition-all duration-200",
                                "hover:bg-accent hover:text-accent-foreground",
                                activeTab === item.value 
                                  ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground font-semibold shadow-lg border-l-4 border-primary-foreground/50' 
                                  : 'text-foreground hover:font-medium hover:shadow-sm'
                              )}
                            >
                              <div className="relative">
                                <item.icon className={cn(
                                  collapsed ? 'h-6 w-6' : 'h-5 w-5',
                                  "shrink-0 transition-transform duration-200",
                                  activeTab === item.value && 'scale-110'
                                )} />
                                {badge && collapsed && badge.count && (
                                  <Badge 
                                    variant="destructive" 
                                    className={cn(
                                      "absolute -top-2 -right-2 h-4 min-w-4 px-1 text-xs flex items-center justify-center",
                                      badge.pulse && "animate-pulse"
                                    )}
                                  >
                                    {badge.count}
                                  </Badge>
                                )}
                              </div>
                              {!collapsed && (
                                <>
                                  <span className="text-sm leading-tight flex-1">{item.title}</span>
                                  <div className="flex items-center gap-2">
                                    {badge && (
                                      <>
                                        {badge.count !== undefined && (
                                          <Badge 
                                            variant={badge.status === 'error' ? 'destructive' : 'secondary'}
                                            className={cn(
                                              "h-5 px-2 text-xs",
                                              badge.pulse && "animate-pulse",
                                              badge.status === 'success' && "bg-green-500/10 text-green-500 border-green-500/20",
                                              badge.status === 'warning' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                                              badge.status === 'info' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            )}
                                          >
                                            {badge.count}
                                          </Badge>
                                        )}
                                        {badge.status === 'error' && !badge.count && (
                                          <AlertCircle className="h-3 w-3 text-destructive" />
                                        )}
                                        {badge.status === 'success' && !badge.count && (
                                          <CheckCircle className="h-3 w-3 text-green-500" />
                                        )}
                                        {badge.status === 'warning' && !badge.count && (
                                          <Clock className="h-3 w-3 text-yellow-500" />
                                        )}
                                      </>
                                    )}
                                    <span title={isPinned ? "Right-click to unpin" : "Right-click to pin"}>
                                      <Star 
                                        className={cn(
                                          "h-3 w-3 transition-all",
                                          isPinned 
                                            ? "fill-primary text-primary opacity-100" 
                                            : "opacity-0 group-hover:opacity-50"
                                        )}
                                      />
                                    </span>
                                  </div>
                                </>
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

    {/* Keyboard Shortcuts Dialog */}
    <KeyboardShortcutsDialog 
      open={showShortcutsDialog}
      onOpenChange={setShowShortcutsDialog}
    />
  </>
  );
}
