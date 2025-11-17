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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavigationItem } from "@/components/AdminSidebar";

interface QuickAccessProps {
  pinnedItems: NavigationItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onTogglePin: (value: string) => void;
  collapsed?: boolean;
  isEffectivelyExpanded?: boolean;
}

export function QuickAccess({
  pinnedItems,
  activeTab,
  onTabChange,
  onTogglePin,
  collapsed,
  isEffectivelyExpanded = true,
}: QuickAccessProps) {
  if (pinnedItems.length === 0) return null;

  return (
    <SidebarGroup className="mb-4">
      <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-4 py-2 flex items-center gap-2">
        <Star className={`h-3 w-3 fill-primary text-primary transition-transform duration-200 ${!isEffectivelyExpanded ? 'group-hover:scale-110' : ''}`} />
        <span className={`transition-all duration-200 ${isEffectivelyExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          Quick Access
        </span>
        {!isEffectivelyExpanded && (
          <span className="ml-1 text-xs bg-primary/20 text-primary rounded-full h-5 w-5 flex items-center justify-center">
            {pinnedItems.length}
          </span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {pinnedItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.value)}
                    isActive={activeTab === item.value}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onTogglePin(item.value);
                    }}
                    aria-current={activeTab === item.value ? 'page' : undefined}
                    className={cn(
                      "relative w-full min-h-[48px] group",
                      collapsed ? 'justify-center px-0' : 'justify-start px-4',
                      "gap-3 py-3 rounded-lg transition-all duration-200",
                      "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
                      activeTab === item.value 
                        ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground font-semibold shadow-lg border-l-4 border-primary-foreground/50' 
                        : 'text-foreground hover:font-medium hover:shadow-sm'
                    )}
                  >
                    <item.icon className={cn(
                      collapsed ? 'h-6 w-6' : 'h-5 w-5',
                      "shrink-0 transition-all duration-200 group-hover:scale-110",
                      activeTab === item.value && 'scale-110'
                    )} />
                    <span className={`text-sm leading-tight flex-1 transition-all duration-200 ${
                      isEffectivelyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                    }`}>
                      {item.title}
                    </span>
                    {isEffectivelyExpanded && (
                      <span title="Right-click to unpin">
                        <Star className="h-3 w-3 fill-primary text-primary opacity-0 group-hover:opacity-100 transition-all group-hover:rotate-12" />
                      </span>
                    )}
                  </SidebarMenuButton>
                </TooltipTrigger>
                {!isEffectivelyExpanded && (
                  <TooltipContent side="right">
                    <span className="font-medium">{item.title}</span>
                  </TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
