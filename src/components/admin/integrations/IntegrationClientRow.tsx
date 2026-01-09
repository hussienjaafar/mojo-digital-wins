import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, CheckCircle, Circle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { IntegrationSummary } from '@/types/integrations';
import { IntegrationCard } from './IntegrationCard';

interface IntegrationClientRowProps {
  summary: IntegrationSummary;
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
  onAddIntegration: (orgId: string) => void;
  defaultOpen?: boolean;
}

export function IntegrationClientRow({
  summary,
  onTest,
  onToggle,
  onEdit,
  onAddIntegration,
  defaultOpen = false,
}: IntegrationClientRowProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getHealthIcon = () => {
    switch (summary.health_status) {
      case 'needs_attention':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'untested':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = () => {
    if (summary.total_count === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          No integrations
        </Badge>
      );
    }

    if (summary.health_status === 'needs_attention') {
      return (
        <Badge variant="destructive">
          {summary.error_count} of {summary.total_count} failing
        </Badge>
      );
    }

    if (summary.health_status === 'untested') {
      return (
        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
          {summary.untested_count} untested
        </Badge>
      );
    }

    if (summary.health_status === 'all_disabled') {
      return (
        <Badge variant="secondary">
          All disabled
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
        {summary.healthy_count} healthy
      </Badge>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "border rounded-lg transition-colors",
        summary.health_status === 'needs_attention' && "border-destructive/30 bg-destructive/5",
        summary.health_status === 'no_setup' && "border-dashed"
      )}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {getHealthIcon()}
              <span className="font-medium">{summary.organization_name}</span>
              {getHealthBadge()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {summary.total_count} integration{summary.total_count !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {summary.integrations.length > 0 ? (
              <div className="space-y-2 ml-7">
                {summary.integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onTest={onTest}
                    onToggle={onToggle}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            ) : (
              <div className="ml-7 p-4 text-center border border-dashed rounded-lg">
                <p className="text-muted-foreground text-sm mb-2">
                  No integrations configured yet
                </p>
              </div>
            )}
            
            <div className="ml-7 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddIntegration(summary.organization_id)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
