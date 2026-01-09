import React from 'react';
import { Search, Filter, X, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { IntegrationHealthStatus, IntegrationStatusCounts, PLATFORM_DISPLAY_NAMES } from '@/types/integrations';

export type SortField = 'status' | 'name' | 'integrations' | 'lastSync';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface IntegrationDiscoveryBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: IntegrationHealthStatus | 'all';
  onStatusFilterChange: (value: IntegrationHealthStatus | 'all') => void;
  platformFilter: string;
  onPlatformFilterChange: (value: string) => void;
  sortConfig: SortConfig;
  onSortChange: (config: SortConfig) => void;
  statusCounts: IntegrationStatusCounts;
  resultCount: number;
  className?: string;
}

const STATUS_OPTIONS: { value: IntegrationHealthStatus | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_attention', label: 'Needs Attention', color: 'bg-[hsl(var(--portal-error))]' },
  { value: 'healthy', label: 'Healthy', color: 'bg-[hsl(var(--portal-success))]' },
  { value: 'untested', label: 'Untested', color: 'bg-[hsl(var(--portal-warning))]' },
  { value: 'no_setup', label: 'No Setup', color: 'bg-[hsl(var(--portal-text-tertiary))]' },
];

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'status', label: 'Status' },
  { field: 'name', label: 'Name' },
  { field: 'integrations', label: 'Integration Count' },
  { field: 'lastSync', label: 'Last Sync' },
];

export function IntegrationDiscoveryBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  platformFilter,
  onPlatformFilterChange,
  sortConfig,
  onSortChange,
  statusCounts,
  resultCount,
  className,
}: IntegrationDiscoveryBarProps) {
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || platformFilter !== 'all';
  const currentSort = SORT_OPTIONS.find(o => o.field === sortConfig.field);

  const clearFilters = () => {
    onSearchChange('');
    onStatusFilterChange('all');
    onPlatformFilterChange('all');
  };

  const getStatusCount = (status: IntegrationHealthStatus | 'all'): number => {
    if (status === 'all') return statusCounts.needsAttention + statusCounts.healthy + statusCounts.noSetup + statusCounts.untested;
    if (status === 'needs_attention') return statusCounts.needsAttention;
    if (status === 'healthy') return statusCounts.healthy;
    if (status === 'untested') return statusCounts.untested;
    if (status === 'no_setup') return statusCounts.noSetup;
    return 0;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-tertiary))]" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search organizations..."
            className="pl-9 bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--portal-text-tertiary))] hover:text-[hsl(var(--portal-text-secondary))]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Platform filter */}
        <Select value={platformFilter} onValueChange={onPlatformFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px] bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))]">
            <Filter className="h-4 w-4 mr-2 text-[hsl(var(--portal-text-tertiary))]" />
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {Object.entries(PLATFORM_DISPLAY_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="default"
              className="gap-2 bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))]"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">Sort:</span>
              <span className="font-medium">{currentSort?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup 
              value={sortConfig.field} 
              onValueChange={(field) => onSortChange({ field: field as SortField, direction: sortConfig.direction })}
            >
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.field} value={option.field}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup 
              value={sortConfig.direction} 
              onValueChange={(dir) => onSortChange({ ...sortConfig, direction: dir as SortDirection })}
            >
              <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map((option) => {
          const count = getStatusCount(option.value);
          const isActive = statusFilter === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onStatusFilterChange(option.value)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                "transition-all duration-200",
                "border",
                isActive 
                  ? "bg-[hsl(var(--portal-accent-blue)/0.1)] border-[hsl(var(--portal-accent-blue))] text-[hsl(var(--portal-accent-blue))]"
                  : "bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:border-[hsl(var(--portal-border-hover))]"
              )}
            >
              {option.color && (
                <span className={cn("w-2 h-2 rounded-full", option.color)} />
              )}
              <span>{option.label}</span>
              <Badge 
                variant="secondary" 
                className={cn(
                  "min-w-[1.25rem] h-5 px-1.5 text-xs",
                  isActive && "bg-[hsl(var(--portal-accent-blue)/0.2)]"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))]"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}

        {/* Results count */}
        <span className="ml-auto text-sm text-[hsl(var(--portal-text-tertiary))]">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
