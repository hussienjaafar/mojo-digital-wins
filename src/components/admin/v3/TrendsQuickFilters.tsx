import { useState } from 'react';
import { Zap, Target, SlidersHorizontal, ArrowUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type TrendFilter = 'all' | 'breaking' | 'high_confidence';
export type TrendSort = 'confidence' | 'velocity' | 'recency' | 'sources';

interface TrendsQuickFiltersProps {
  activeFilter: TrendFilter;
  onFilterChange: (filter: TrendFilter) => void;
  activeSort: TrendSort;
  onSortChange: (sort: TrendSort) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: {
    all: number;
    breaking: number;
    highConfidence: number;
  };
  className?: string;
}

const SORT_OPTIONS: { value: TrendSort; label: string }[] = [
  { value: 'confidence', label: 'Confidence' },
  { value: 'velocity', label: 'Velocity' },
  { value: 'recency', label: 'Most Recent' },
  { value: 'sources', label: 'Source Count' },
];

export function TrendsQuickFilters({
  activeFilter,
  onFilterChange,
  activeSort,
  onSortChange,
  searchQuery,
  onSearchChange,
  counts,
  className,
}: TrendsQuickFiltersProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Filter Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={activeFilter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange('all')}
          className="h-8 text-xs"
        >
          All ({counts.all})
        </Button>
        <Button
          variant={activeFilter === 'breaking' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange('breaking')}
          className={cn(
            "h-8 text-xs gap-1.5",
            activeFilter === 'breaking' && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          )}
        >
          <Zap className="h-3 w-3" />
          Breaking ({counts.breaking})
        </Button>
        <Button
          variant={activeFilter === 'high_confidence' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange('high_confidence')}
          className="h-8 text-xs gap-1.5"
        >
          <Target className="h-3 w-3" />
          High Confidence ({counts.highConfidence})
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className={cn(
        "relative transition-all duration-200",
        isSearchOpen ? "w-48" : "w-8"
      )}>
        {isSearchOpen ? (
          <Input
            type="text"
            placeholder="Search trends..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => !searchQuery && setIsSearchOpen(false)}
            autoFocus
            className="h-8 text-xs pr-8"
          />
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            isSearchOpen && "absolute right-0 top-0"
          )}
          onClick={() => setIsSearchOpen(!isSearchOpen)}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowUpDown className="h-3 w-3" />
            <span className="hidden sm:inline">Sort:</span>
            <span className="font-medium">
              {SORT_OPTIONS.find(o => o.value === activeSort)?.label}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuRadioGroup value={activeSort} onValueChange={(v) => onSortChange(v as TrendSort)}>
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
