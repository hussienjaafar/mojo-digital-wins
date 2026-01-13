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

// Escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Safe React component for highlighting search matches - avoids dangerouslySetInnerHTML
function HighlightedText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  
  const escapedSearch = escapeRegex(search);
  const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark
            key={i}
            className="bg-[hsl(var(--portal-accent-blue)/0.3)] text-[hsl(var(--portal-text-primary))] rounded px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
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
        <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider portal-text-muted px-3 py-2">
          Search Results ({items.length})
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {items.map((item, index) => (
              <SidebarMenuItem key={item.value}>
                <SidebarMenuButton
                  onClick={() => onTabChange(item.value)}
                  isActive={activeTab === item.value}
                  tooltip={!isEffectivelyExpanded ? item.title : undefined}
                  aria-current={activeTab === item.value ? 'page' : undefined}
                  className={cn(
                    "relative w-full min-h-[44px] group transition-colors",
                    collapsed ? 'justify-center px-2' : 'justify-start px-3',
                    "gap-3 py-2.5 rounded-md",
                    "hover:bg-[hsl(var(--portal-bg-hover))]",
                    selectedIndex === index && 'ring-2 ring-[hsl(var(--portal-accent-blue))] ring-offset-2 ring-offset-[hsl(var(--portal-bg-primary))]',
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
                    <span className="flex-1 truncate text-sm">
                      <HighlightedText text={item.title} search={searchTerm} />
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
