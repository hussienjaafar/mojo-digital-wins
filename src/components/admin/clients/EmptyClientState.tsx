import React from 'react';
import { Building2, Plus, Search, Filter } from 'lucide-react';
import { V3Button } from '@/components/v3/V3Button';

interface EmptyClientStateProps {
  type: 'no_clients' | 'no_results' | 'filtered_empty';
  onCreateClient?: () => void;
  onClearFilters?: () => void;
}

export function EmptyClientState({ type, onCreateClient, onClearFilters }: EmptyClientStateProps) {
  if (type === 'no_clients') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          Create your first client organization to get started with onboarding and configuration.
        </p>
        {onCreateClient && (
          <V3Button onClick={onCreateClient} className="gap-2">
            <Plus className="h-4 w-4" />
            Onboard First Client
          </V3Button>
        )}
      </div>
    );
  }

  if (type === 'no_results') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No matching clients</h3>
        <p className="text-muted-foreground max-w-sm">
          Try adjusting your search query to find what you're looking for.
        </p>
      </div>
    );
  }

  if (type === 'filtered_empty') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Filter className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No clients match filters</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          No clients match your current filter criteria.
        </p>
        {onClearFilters && (
          <V3Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </V3Button>
        )}
      </div>
    );
  }

  return null;
}
