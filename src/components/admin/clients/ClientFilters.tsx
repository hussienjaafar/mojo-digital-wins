import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';
import { V3Badge } from '@/components/v3/V3Badge';
import type { OnboardingEffectiveStatus } from './OnboardingStatusBadge';

export type OnboardingFilter = 'all' | OnboardingEffectiveStatus | 'needs_attention';
export type ActiveFilter = 'all' | 'active' | 'inactive';

interface ClientFiltersProps {
  onboardingFilter: OnboardingFilter;
  setOnboardingFilter: (filter: OnboardingFilter) => void;
  activeFilter: ActiveFilter;
  setActiveFilter: (filter: ActiveFilter) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ONBOARDING_OPTIONS: { value: OnboardingFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const ACTIVE_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: 'all', label: 'All Clients' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];

export function ClientFilters({
  onboardingFilter,
  setOnboardingFilter,
  activeFilter,
  setActiveFilter,
  hasActiveFilters,
  onClearFilters,
}: ClientFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <V3Badge variant="blue" size="sm" className="ml-1">
                Active
              </V3Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Onboarding Status</DropdownMenuLabel>
          {ONBOARDING_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={onboardingFilter === option.value}
              onCheckedChange={() => setOnboardingFilter(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Client Status</DropdownMenuLabel>
          {ACTIVE_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={activeFilter === option.value}
              onCheckedChange={() => setActiveFilter(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
