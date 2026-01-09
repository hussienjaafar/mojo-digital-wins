import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Circle,
  ExternalLink,
  Building2
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  IntegrationSummary, 
  IntegrationDetail, 
  IntegrationHealthStatus,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_ICONS 
} from '@/types/integrations';
import { IntegrationDetailCard } from './IntegrationDetailCard';

interface IntegrationDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: IntegrationSummary | null;
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
  onAddIntegration: (orgId: string) => void;
}

const healthConfig: Record<IntegrationHealthStatus, { 
  icon: React.ReactNode; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  needs_attention: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Needs Attention',
    color: 'text-[hsl(var(--portal-error))]',
    bgColor: 'bg-[hsl(var(--portal-error)/0.1)]',
  },
  healthy: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Healthy',
    color: 'text-[hsl(var(--portal-success))]',
    bgColor: 'bg-[hsl(var(--portal-success)/0.1)]',
  },
  untested: {
    icon: <Clock className="h-4 w-4" />,
    label: 'Untested',
    color: 'text-[hsl(var(--portal-warning))]',
    bgColor: 'bg-[hsl(var(--portal-warning)/0.1)]',
  },
  no_setup: {
    icon: <Circle className="h-4 w-4" />,
    label: 'No Integrations',
    color: 'text-[hsl(var(--portal-text-tertiary))]',
    bgColor: 'bg-[hsl(var(--portal-bg-elevated))]',
  },
  all_disabled: {
    icon: <Circle className="h-4 w-4" />,
    label: 'All Disabled',
    color: 'text-[hsl(var(--portal-text-tertiary))]',
    bgColor: 'bg-[hsl(var(--portal-bg-elevated))]',
  },
};

export function IntegrationDetailDrawer({
  open,
  onOpenChange,
  organization,
  onTest,
  onToggle,
  onEdit,
  onAddIntegration,
}: IntegrationDetailDrawerProps) {
  if (!organization) return null;

  const health = healthConfig[organization.health_status];
  const hasIntegrations = organization.integrations.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg p-0 border-l border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg))]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[hsl(var(--portal-bg-card))] border-b border-[hsl(var(--portal-border))]">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                  <Building2 className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] truncate">
                    {organization.organization_name}
                  </SheetTitle>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5">
                    {organization.organization_slug}
                  </p>
                </div>
              </div>
              
              {/* Status badge */}
              <Badge 
                variant="secondary"
                className={cn(
                  "shrink-0 gap-1.5",
                  health.bgColor,
                  health.color
                )}
              >
                {health.icon}
                {health.label}
              </Badge>
            </div>
          </SheetHeader>

          {/* Quick stats */}
          <div className="px-6 pb-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--portal-text-tertiary))]">Integrations:</span>
              <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                {organization.total_count}
              </span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--portal-text-tertiary))]">Healthy:</span>
              <span className="font-medium text-[hsl(var(--portal-success))]">
                {organization.healthy_count}
              </span>
            </div>
            {organization.error_count > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[hsl(var(--portal-text-tertiary))]">Failing:</span>
                  <span className="font-medium text-[hsl(var(--portal-error))]">
                    {organization.error_count}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-4">
            {hasIntegrations ? (
              <AnimatePresence mode="popLayout">
                {organization.integrations.map((integration, index) => (
                  <motion.div
                    key={integration.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <IntegrationDetailCard
                      integration={integration}
                      onTest={onTest}
                      onToggle={onToggle}
                      onEdit={onEdit}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 rounded-full bg-[hsl(var(--portal-bg-elevated))] flex items-center justify-center mx-auto mb-4">
                  <Circle className="h-8 w-8 text-[hsl(var(--portal-text-tertiary))]" />
                </div>
                <h3 className="text-lg font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                  No integrations configured
                </h3>
                <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-4">
                  Add an integration to start syncing data
                </p>
              </motion.div>
            )}

            {/* Add integration button */}
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.05)]"
              onClick={() => onAddIntegration(organization.organization_id)}
            >
              <Plus className="h-4 w-4" />
              Add Integration
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
