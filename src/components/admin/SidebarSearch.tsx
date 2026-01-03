import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
  isEffectivelyExpanded?: boolean;
  onExpandSidebar?: () => void;
}

export function SidebarSearch({ 
  searchTerm, 
  onSearchChange, 
  onKeyDown, 
  collapsed, 
  isEffectivelyExpanded = true,
  onExpandSidebar 
}: SidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search is initiated
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        // If collapsed, expand first then focus
        if (!isEffectivelyExpanded && onExpandSidebar) {
          onExpandSidebar();
          // Focus after expansion animation
          setTimeout(() => inputRef.current?.focus(), 250);
        } else {
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        onSearchChange("");
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSearchChange, isEffectivelyExpanded, onExpandSidebar]);

  // When collapsed, show only a search icon button
  if (!isEffectivelyExpanded) {
    return (
      <div className="flex justify-center pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 hover:bg-[hsl(var(--portal-bg-hover))]"
              onClick={onExpandSidebar}
              aria-label="Expand sidebar to search"
            >
              <Search className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>Search (Ctrl+K)</span>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search navigation... (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-10 pl-9 pr-9 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-muted))]"
          aria-label="Search navigation items"
          data-sidebar-search
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-[hsl(var(--portal-bg-hover))]"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {searchTerm && (
        <p className="text-xs portal-text-muted mt-2 px-1">
          Use ↑↓ to navigate, Enter to select
        </p>
      )}
    </div>
  );
}
