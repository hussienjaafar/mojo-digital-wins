/**
 * HierarchyLevelTabs Component
 * 
 * Tab bar for switching between Campaign, Ad Set, and Ad views
 * Similar to Meta Ads Manager's level selector
 */

import { cn } from '@/lib/utils';
import { LayoutGrid, Layers, Image } from 'lucide-react';
import type { HierarchyLevel } from '@/types/adHierarchy';

interface HierarchyLevelTabsProps {
  activeLevel: HierarchyLevel;
  onLevelChange: (level: HierarchyLevel) => void;
  campaignCount: number;
  adsetCount: number;
  adCount: number;
  selectedCampaigns: string[];
  selectedAdsets: string[];
  className?: string;
}

const tabs: { level: HierarchyLevel; label: string; icon: typeof LayoutGrid }[] = [
  { level: 'campaign', label: 'Campaigns', icon: LayoutGrid },
  { level: 'adset', label: 'Ad Sets', icon: Layers },
  { level: 'ad', label: 'Ads', icon: Image },
];

export function HierarchyLevelTabs({
  activeLevel,
  onLevelChange,
  campaignCount,
  adsetCount,
  adCount,
  selectedCampaigns,
  selectedAdsets,
  className,
}: HierarchyLevelTabsProps) {
  const getCount = (level: HierarchyLevel) => {
    switch (level) {
      case 'campaign':
        return campaignCount;
      case 'adset':
        return adsetCount;
      case 'ad':
        return adCount;
    }
  };

  const getSelectedCount = (level: HierarchyLevel) => {
    switch (level) {
      case 'campaign':
        return selectedCampaigns.length;
      case 'adset':
        return selectedAdsets.length;
      case 'ad':
        return 0;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 rounded-lg',
        'bg-[hsl(var(--portal-bg-tertiary))]',
        'border border-[hsl(var(--portal-border))]',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeLevel === tab.level;
        const count = getCount(tab.level);
        const selectedCount = getSelectedCount(tab.level);
        const Icon = tab.icon;

        return (
          <button
            key={tab.level}
            onClick={() => onLevelChange(tab.level)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-[hsl(var(--portal-bg-primary))] text-[hsl(var(--portal-text-primary))] shadow-sm'
                : 'text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-hover))]'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center',
                isActive
                  ? 'bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]'
                  : 'bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-muted))]'
              )}
            >
              {selectedCount > 0 ? `${selectedCount}/${count}` : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
