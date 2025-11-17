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
import { Search } from "lucide-react";

interface FlatSearchResultsProps {
  items: NavigationItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  searchTerm: string;
  selectedIndex: number;
  collapsed?: boolean;
  isEffectivelyExpanded?: boolean;
}

function highlightMatch(text: string, search: string): string {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  return text.replace(regex, '<mark class="bg-primary/30 text-foreground rounded px-0.5 font-semibold">$1</mark>');
}

export function FlatSearchResults({
  items,
  activeTab,
  onTabChange,
  searchTerm,
  selectedIndex,
  collapsed,
  isEffectivelyExpanded = true,
}: FlatSearchResultsProps) {
  if (items.length === 0) {
    return (
      <SidebarGroup className="mb-4">
        <SidebarGroupContent>
          {isEffectivelyExpanded && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="mb-4">
      {isEffectivelyExpanded && (
        <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-4 py-2">
          Search Results ({items.length})
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {items.map((item, index) => {
            const itemTitle = highlightMatch(item.title, searchTerm);
            
            return (
              <SidebarMenuItem key={item.value}>
                <SidebarMenuButton
                  onClick={() => onTabChange(item.value)}
                  isActive={activeTab === item.value}
                  tooltip={!isEffectivelyExpanded ? item.title : undefined}
                  aria-current={activeTab === item.value ? 'page' : undefined}
                  className={cn(
                    "relative w-full min-h-[48px]",
                    collapsed ? 'justify-center px-0' : 'justify-start px-4',
                    "gap-3 py-3 rounded-lg transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
                    selectedIndex === index && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    activeTab === item.value 
                      ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground font-semibold shadow-lg border-l-4 border-primary-foreground/50' 
                      : 'text-foreground hover:font-medium hover:shadow-sm'
                  )}
                >
                  <item.icon className={cn(
                    collapsed ? 'h-6 w-6' : 'h-5 w-5',
                    "shrink-0 transition-transform duration-200 group-hover:scale-110",
                    activeTab === item.value && 'scale-110'
                  )} />
                  <span 
                    className={`text-sm leading-tight transition-all duration-200 ${
                      isEffectivelyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                    }`}
                    dangerouslySetInnerHTML={{ __html: itemTitle }}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
