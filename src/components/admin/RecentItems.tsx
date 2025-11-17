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
        <SidebarGroupLabel className="
          text-muted-foreground 
          text-sm 
          font-bold 
          tracking-wider 
          uppercase 
          px-4 
          py-2
          mb-2
          opacity-90
          bg-muted/30
          rounded-md
          border-b border-border/50
          flex items-center gap-2
        ">
          <Clock className="h-3.5 w-3.5" />
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
                  relative
                  w-full 
                  min-h-[48px]
                  ${collapsed ? 'justify-center px-0' : 'justify-start px-4'}
                  gap-3 
                  py-3
                  rounded-lg
                  transition-all duration-200
                  hover:bg-accent hover:text-accent-foreground
                  ${activeTab === item.value 
                    ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground font-semibold shadow-lg border-l-4 border-primary-foreground/50' 
                    : 'text-foreground hover:font-medium hover:shadow-sm'
                  }
                `}
              >
                <item.icon className={`
                  ${collapsed ? 'h-6 w-6' : 'h-5 w-5'} 
                  shrink-0
                  transition-transform duration-200
                  ${activeTab === item.value ? 'scale-110' : ''}
                `} />
                {!collapsed && (
                  <span className="text-sm leading-tight">{item.title}</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      {!collapsed && <div className="h-px bg-border/50 mt-4" />}
    </SidebarGroup>
  );
}
