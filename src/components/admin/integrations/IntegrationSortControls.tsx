import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export type SortField = 'status' | 'name' | 'integrations' | 'lastSync';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface IntegrationSortControlsProps {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
}

const SORT_OPTIONS: { field: SortField; label: string; description: string }[] = [
  { field: 'status', label: 'Health Status', description: 'Issues first' },
  { field: 'name', label: 'Client Name', description: 'Alphabetical' },
  { field: 'integrations', label: 'Integration Count', description: 'Most first' },
  { field: 'lastSync', label: 'Last Activity', description: 'Most recent first' },
];

export function IntegrationSortControls({ sort, onSortChange }: IntegrationSortControlsProps) {
  const currentOption = SORT_OPTIONS.find(o => o.field === sort.field);
  
  const handleFieldChange = (field: string) => {
    onSortChange({ 
      field: field as SortField, 
      direction: field === sort.field ? sort.direction : 'desc' 
    });
  };

  const toggleDirection = () => {
    onSortChange({ 
      field: sort.field, 
      direction: sort.direction === 'asc' ? 'desc' : 'asc' 
    });
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sort:</span>
            <span className="font-medium">{currentOption?.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sort.field} onValueChange={handleFieldChange}>
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem 
                key={option.field} 
                value={option.field}
                className="flex justify-between"
              >
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleDirection}
        className="px-2"
        title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sort.direction === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
