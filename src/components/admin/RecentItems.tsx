import { Clock } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { NavigationItem } from "@/components/AdminSidebar";

interface RecentItemsProps {
  recentItems: NavigationItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  collapsed?: boolean;
}

export function RecentItems({ recentItems, activeTab, onTabChange, collapsed }: RecentItemsProps) {
  if (recentItems.length === 0) return null;

  return (
    <SidebarGroup className="mb-4">
      {!collapsed && (
        <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider portal-text-muted px-3 py-2 flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Recently Viewed
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {recentItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                onClick={() => onTabChange(item.value)}
                isActive={activeTab === item.value}
                tooltip={collapsed ? item.title : undefined}
                aria-current={activeTab === item.value ? 'page' : undefined}
                className={`
                  relative w-full min-h-[44px] group transition-colors
                  ${collapsed ? 'justify-center px-2' : 'justify-start px-3'}
                  gap-3 py-2.5 rounded-md
                  hover:bg-[hsl(var(--portal-bg-hover))]
                  ${activeTab === item.value 
                    ? 'bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] font-medium hover:bg-[hsl(var(--portal-accent-blue)/0.15)] border-l-2 border-[hsl(var(--portal-accent-blue))]' 
                    : 'portal-text-secondary'
                  }
                `}
              >
                <item.icon className={`
                  h-5 w-5 shrink-0
                  ${activeTab === item.value 
                    ? 'text-[hsl(var(--portal-accent-blue))]' 
                    : 'text-[hsl(var(--portal-text-secondary))]'
                  }
                `} />
                {!collapsed && (
                  <span className="flex-1 truncate text-sm">{item.title}</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
