import React from 'react';
import { Plug, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IntegrationEmptyStateProps {
  variant: 'no-clients' | 'no-results' | 'no-integrations';
  searchQuery?: string;
  onClearFilters?: () => void;
  onAddIntegration?: () => void;
  className?: string;
}

const emptyStateConfig = {
  'no-clients': {
    icon: Plug,
    title: 'No clients yet',
    description: 'Get started by creating your first client organization and setting up their integrations.',
    primaryAction: 'Add First Client',
    showSecondaryAction: false,
  },
  'no-results': {
    icon: Plug,
    title: 'No matching clients',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
    primaryAction: 'Clear Filters',
    showSecondaryAction: false,
  },
  'no-integrations': {
    icon: Plug,
    title: 'No integrations configured',
    description: 'This client doesn\'t have any integrations set up yet.',
    primaryAction: 'Add Integration',
    showSecondaryAction: true,
  },
};

export function IntegrationEmptyState({ 
  variant, 
  searchQuery,
  onClearFilters, 
  onAddIntegration,
  className 
}: IntegrationEmptyStateProps) {
  const config = emptyStateConfig[variant];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-8 text-center',
      'border-2 border-dashed rounded-xl bg-muted/20',
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        {variant === 'no-results' && searchQuery 
          ? `No clients found matching "${searchQuery}"`
          : config.description}
      </p>

      <div className="flex items-center gap-3">
        {variant === 'no-results' && onClearFilters && (
          <Button onClick={onClearFilters} variant="outline">
            {config.primaryAction}
          </Button>
        )}
        
        {variant === 'no-clients' && onAddIntegration && (
          <Button onClick={onAddIntegration}>
            <Plus className="h-4 w-4 mr-2" />
            {config.primaryAction}
          </Button>
        )}
        
        {variant === 'no-integrations' && onAddIntegration && (
          <Button onClick={onAddIntegration} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {config.primaryAction}
          </Button>
        )}
      </div>

      {variant === 'no-clients' && (
        <div className="mt-8 pt-6 border-t w-full max-w-md">
          <p className="text-sm text-muted-foreground mb-3">Quick start guide:</p>
          <ol className="text-sm text-left space-y-2">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
              <span>Create a client organization in the Onboarding Wizard</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
              <span>Add their platform integrations (Meta Ads, ActBlue, etc.)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">3</span>
              <span>Test connections and start syncing data</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
