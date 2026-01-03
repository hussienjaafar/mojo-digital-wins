import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

interface SidebarSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
  isEffectivelyExpanded?: boolean;
}

export function SidebarSearch({ searchTerm, onSearchChange, onKeyDown, collapsed, isEffectivelyExpanded = true }: SidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search is initiated
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        onSearchChange("");
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSearchChange]);

  return (
    <div className={`px-3 pb-4 transition-all duration-200 ${!isEffectivelyExpanded ? 'px-2' : ''}`}>
      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))] transition-all duration-200 ${isEffectivelyExpanded ? 'left-3' : 'left-1/2 -translate-x-1/2'}`} />
        <Input
          ref={inputRef}
          type="text"
          placeholder={isEffectivelyExpanded ? "Search navigation... (Ctrl+K)" : ""}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={`h-10 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-muted))] transition-all duration-200 ${
            isEffectivelyExpanded ? 'pl-9 pr-9' : 'pl-2 pr-2 w-10 text-transparent caret-transparent cursor-pointer'
          }`}
          aria-label="Search navigation items"
        />
        {searchTerm && isEffectivelyExpanded && (
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
      {isEffectivelyExpanded && searchTerm && (
        <p className="text-xs portal-text-muted mt-2 px-1">
          Use ↑↓ to navigate, Enter to select
        </p>
      )}
    </div>
  );
}
