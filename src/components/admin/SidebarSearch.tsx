import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

interface SidebarSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  collapsed?: boolean;
}

export function SidebarSearch({ searchTerm, onSearchChange, onKeyDown, collapsed }: SidebarSearchProps) {
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

  if (collapsed) return null;

  return (
    <div className="px-3 pb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search navigation... (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="pl-9 pr-9 h-10 bg-muted/50 border-border/50 focus-visible:ring-primary"
          aria-label="Search navigation items"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {searchTerm && (
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Use ↑↓ to navigate, Enter to select
        </p>
      )}
    </div>
  );
}
