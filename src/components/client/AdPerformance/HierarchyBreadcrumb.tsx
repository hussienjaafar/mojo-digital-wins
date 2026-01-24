/**
 * HierarchyBreadcrumb Component
 * 
 * Shows navigation path: All Campaigns > [Selected Campaign] > [Selected Ad Set]
 */

import { ChevronRight, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HierarchyLevel, BreadcrumbItem } from '@/types/adHierarchy';

interface HierarchyBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (level: HierarchyLevel, id?: string) => void;
  className?: string;
}

export function HierarchyBreadcrumb({
  breadcrumbs,
  onNavigate,
  className,
}: HierarchyBreadcrumbProps) {
  return (
    <nav
      className={cn(
        'flex items-center gap-1 text-sm',
        className
      )}
      aria-label="Hierarchy navigation"
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <div key={`${crumb.level}-${crumb.id || 'root'}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            )}
            {isLast ? (
              <span className="font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-1.5">
                {index === 0 && <LayoutGrid className="h-4 w-4" />}
                {crumb.name}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))]"
                onClick={() => onNavigate(crumb.level, crumb.id)}
              >
                {index === 0 && <LayoutGrid className="h-4 w-4 mr-1.5" />}
                {crumb.name}
              </Button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
