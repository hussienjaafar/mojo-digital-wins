import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SidebarSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  collapsed?: boolean;
}

export function SidebarSearch({ searchTerm, onSearchChange, collapsed }: SidebarSearchProps) {
  if (collapsed) return null;

  return (
    <div className="px-3 pb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search navigation..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
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
    </div>
  );
}
