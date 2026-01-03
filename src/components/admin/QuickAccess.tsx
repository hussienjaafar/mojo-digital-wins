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
      <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider portal-text-muted px-3 py-2 flex items-center gap-2">
        <Star className="h-3 w-3 fill-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))]" />
        <span className={`transition-all duration-200 ${isEffectivelyExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          Quick Access
        </span>
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
                      "relative w-full min-h-[44px] group transition-colors",
                      collapsed ? 'justify-center px-2' : 'justify-start px-3',
                      "gap-3 py-2.5 rounded-md",
                      "hover:bg-[hsl(var(--portal-bg-hover))]",
                      activeTab === item.value && [
                        "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                        "text-[hsl(var(--portal-accent-blue))]",
                        "font-medium",
                        "hover:bg-[hsl(var(--portal-accent-blue)/0.15)]",
                        "border-l-2 border-[hsl(var(--portal-accent-blue))]",
                      ],
                      (!activeTab || activeTab !== item.value) && "portal-text-secondary"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 shrink-0",
                      activeTab === item.value 
                        ? "text-[hsl(var(--portal-accent-blue))]" 
                        : "text-[hsl(var(--portal-text-secondary))]"
                    )} />
                    {isEffectivelyExpanded && (
                      <>
                        <span className="flex-1 truncate text-sm">
                          {item.title}
                        </span>
                        <span title="Right-click to unpin">
                          <Star className="h-3 w-3 fill-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </>
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
