import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { NavigationItem } from "@/components/AdminSidebar";

interface QuickAccessProps {
  pinnedItems: NavigationItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onTogglePin: (value: string) => void;
  collapsed?: boolean;
}

export function QuickAccess({
  pinnedItems,
  activeTab,
  onTabChange,
  onTogglePin,
  collapsed,
}: QuickAccessProps) {
  if (pinnedItems.length === 0) return null;

  return (
    <SidebarGroup className="mb-4">
      {!collapsed && (
        <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-4 py-2 flex items-center gap-2">
          <Star className="h-3 w-3 fill-primary text-primary" />
          Quick Access
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {pinnedItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                onClick={() => onTabChange(item.value)}
                isActive={activeTab === item.value}
                tooltip={collapsed ? item.title : undefined}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onTogglePin(item.value);
                }}
                aria-current={activeTab === item.value ? 'page' : undefined}
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
                <item.icon className={cn(
                  collapsed ? 'h-6 w-6' : 'h-5 w-5',
                  "shrink-0 transition-transform duration-200",
                  activeTab === item.value && 'scale-110'
                )} />
                {!collapsed && (
                  <span className="text-sm leading-tight flex-1">{item.title}</span>
                )}
                {!collapsed && (
                  <span title="Right-click to unpin">
                    <Star className="h-3 w-3 fill-primary text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
