import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  Newspaper,
  ScrollText,
  BarChart3,
  Bookmark,
  AlertTriangle,
  Landmark,
  Bell,
  Download,
  TrendingUp,
  HeartPulse,
  Layers,
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
import { NavigationItemContextMenu } from "@/components/admin/NavigationItemContextMenu";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
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
    label: "Intelligence",
    icon: AlertTriangle,
    items: [
      { title: "Daily Briefing", icon: Calendar, value: "daily-briefing" },
      { title: "News & Trends", icon: Newspaper, value: "news" },
      { title: "Analytics", icon: BarChart3, value: "content-analytics" },
      { title: "Critical Alerts", icon: AlertTriangle, value: "critical-alerts" },
      { title: "Bills", icon: ScrollText, value: "bills" },
    ],
  },
  {
    label: "Clients",
    icon: Building2,
    items: [
      { title: "Organizations", icon: Building2, value: "clients" },
      { title: "Users", icon: Users, value: "client-users" },
      { title: "Attribution", icon: GitBranch, value: "attribution" },
      { title: "Health Monitoring", icon: HeartPulse, value: "client-health", requiredRole: 'admin' },
    ],
  },
  {
    label: "System",
    icon: Shield,
    collapsedByDefault: true,
    items: [
      { title: "Operations", icon: Activity, value: "scheduler", requiredRole: 'admin' },
      { title: "Coverage Governance", icon: Layers, value: "coverage-governance", requiredRole: 'admin' },
      { title: "API & Credentials", icon: Key, value: "api-credentials", requiredRole: 'admin' },
      { title: "Audit Logs", icon: FileText, value: "audit-logs", requiredRole: 'admin' },
    ],
  },
];

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { state, isMobile, setOpenMobile, open, setOpen } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Calculate effective expansion state (removed hover functionality)
  const isEffectivelyExpanded = !collapsed;
  
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

  const refreshNavigation = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchUserRoles(), fetchUnreadCounts()]);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);


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

  // Mobile swipe gestures
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeGesture({
    onSwipeRight: () => {
      if (isMobile && !open) {
        setOpenMobile?.(true);
      }
    },
    onSwipeLeft: () => {
      if (isMobile && open) {
        setOpenMobile?.(false);
      }
    },
    onSwipeDown: () => {
      if (isMobile && open) {
        refreshNavigation();
      }
    },
    threshold: 50,
  });

  // Keyboard shortcuts (sidebar toggle is handled by base sidebar.tsx)
  useKeyboardShortcut([
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
    <TooltipProvider delayDuration={200}>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      <Sidebar 
        ref={sidebarRef}
        className={cn(
          "portal-sidebar border-r border-[hsl(var(--portal-border))]",
          isMobile && open && "animate-slide-in-right"
        )}
        collapsible="icon"
        onTouchStart={isMobile ? handleTouchStart as any : undefined}
        onTouchMove={isMobile ? handleTouchMove as any : undefined}
        onTouchEnd={isMobile ? handleTouchEnd as any : undefined}
        aria-expanded={isEffectivelyExpanded}
      >
      <SidebarContent className={cn("py-6 portal-scrollbar", collapsed ? "px-1" : "px-2")} role="navigation" aria-label="Admin navigation">
        {/* Mobile refresh indicator */}
        {isMobile && isRefreshing && (
          <div className="px-4 pb-2">
            <div className="h-1 bg-primary/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full" />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="animate-fade-in">
          <SidebarSearch 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onKeyDown={handleSearchKeyDown}
            collapsed={!isEffectivelyExpanded}
            isEffectivelyExpanded={isEffectivelyExpanded}
            onExpandSidebar={() => setOpen(true)}
          />
        </div>

        {/* Quick Access (Pinned Items) */}
        {!searchTerm && (
          <div className="animate-fade-in">
            <QuickAccess
              pinnedItems={pinnedItems}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onTogglePin={togglePin}
              collapsed={!isEffectivelyExpanded}
              isEffectivelyExpanded={isEffectivelyExpanded}
            />
          </div>
        )}

        {/* Flat Search Results */}
        {searchTerm && (
          <div className="animate-fade-in">
            <FlatSearchResults
              items={searchResults}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              searchTerm={searchTerm}
              selectedIndex={searchSelectedIndex}
              collapsed={!isEffectivelyExpanded}
              isEffectivelyExpanded={isEffectivelyExpanded}
            />
          </div>
        )}

        {/* Navigation Groups - Only show when NOT searching */}
        {!searchTerm && filteredGroups.map((group, groupIndex) => {
          const accessibleItems = group.items.filter(item => hasAccess(item));
          const isExpanded = shouldGroupBeExpanded(group);
          const groupOpacity = getGroupOpacity(group.label);
          
          const groupLabel = (
            <SidebarGroupLabel className={cn(
              "text-xs font-semibold uppercase tracking-wider portal-text-muted",
              "px-3 py-2 flex items-center justify-between cursor-pointer",
              "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors rounded-md",
              "group"
            )}>
              <span className="flex items-center gap-2">
                {group.icon && <group.icon className="h-3.5 w-3.5" />}
                {group.label}
              </span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200 opacity-60",
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
              <SidebarGroup className={cn("mb-4", collapsed && "px-0")}>
                {isEffectivelyExpanded && (
                  <CollapsibleTrigger asChild>
                    {groupLabel}
                  </CollapsibleTrigger>
                )}
                
                <CollapsibleContent className="animate-accordion-down" forceMount={collapsed ? true : undefined}>
                  <SidebarGroupContent>
                    <SidebarMenu className={cn("space-y-1", collapsed && "items-center")}>
                      {group.items.map((item, itemIndex) => {
                        const isPinned = pinnedItemValues.includes(item.value);
                        const badge = item.badge || (item.value === 'contacts' && unreadCounts.contacts > 0 
                          ? { count: unreadCounts.contacts, status: 'info' as const, pulse: true }
                          : undefined);
                        
                        return (
                          <SidebarMenuItem 
                            key={item.value}
                            style={{
                              animationDelay: `${itemIndex * 50}ms`
                            }}
                            className="animate-fade-in"
                          >
                            <NavigationItemContextMenu
                              item={item}
                              isPinned={isPinned}
                              onTogglePin={() => togglePin(item.value)}
                              onNavigate={() => handleTabChange(item.value)}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SidebarMenuButton
                                    onClick={() => handleTabChange(item.value)}
                                    isActive={activeTab === item.value}
                                    aria-current={activeTab === item.value ? 'page' : undefined}
                                    className={cn(
                                      "relative w-full group transition-colors rounded-md",
                                      "hover:bg-[hsl(var(--portal-bg-hover))]",
                                      collapsed 
                                        ? "justify-center !size-10 !p-0 mx-auto" 
                                        : "justify-start px-3 py-2.5 min-h-[44px] gap-3",
                                      activeTab === item.value && [
                                        "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                                        "text-[hsl(var(--portal-accent-blue))]",
                                        "font-medium",
                                        "hover:bg-[hsl(var(--portal-accent-blue)/0.15)]",
                                        !collapsed && "border-l-2 border-[hsl(var(--portal-accent-blue))]",
                                      ],
                                      !activeTab || activeTab !== item.value && "portal-text-secondary"
                                    )}
                                  >
                                    <div className="relative">
                                      <item.icon className={cn(
                                        "h-5 w-5 shrink-0",
                                        activeTab === item.value 
                                          ? "text-[hsl(var(--portal-accent-blue))]" 
                                          : "text-[hsl(var(--portal-text-secondary))]"
                                      )} />
                                      {badge && !isEffectivelyExpanded && (
                                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                                      )}
                                    </div>
                                    {isEffectivelyExpanded && (
                                      <>
                                        <span className="flex-1 truncate text-sm">
                                          {item.title}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {isPinned && <Star className="h-3 w-3 fill-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))]" />}
                                          {badge && (
                                            <Badge 
                                              variant="destructive"
                                              className="ml-auto shrink-0 h-5 min-w-[1.25rem] px-1.5"
                                            >
                                              {badge.count}
                                            </Badge>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </SidebarMenuButton>
                                </TooltipTrigger>
                                {!isEffectivelyExpanded && (
                                  <TooltipContent side="right">
                                    <span className="font-medium">{item.title}</span>
                                    {badge && <span className="text-xs text-muted-foreground block">{badge.count} items</span>}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </NavigationItemContextMenu>
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

        {/* Theme Toggle - Fixed at bottom */}
        <div className={cn(
          "mt-auto border-t border-[hsl(var(--portal-border))]",
          collapsed ? "pt-2 pb-2" : "pt-4"
        )}>
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center py-1" : "justify-between px-4 py-3"
          )}>
            {isEffectivelyExpanded && (
              <span className="text-sm font-medium portal-text-secondary">Theme</span>
            )}
            <div className={collapsed ? "scale-90" : ""}>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog 
        open={showShortcutsDialog}
        onOpenChange={setShowShortcutsDialog}
      />
    </TooltipProvider>
  );
}
