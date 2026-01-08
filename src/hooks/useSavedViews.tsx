import { useState, useCallback, useMemo } from 'react';
import type { FilterState } from '@/components/admin/v3/TrendsFilterRail';

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  isDefault?: boolean;
  createdAt: string;
}

const DEFAULT_VIEWS: SavedView[] = [
  {
    id: 'default',
    name: 'Default',
    isDefault: true,
    filters: {
      timeWindow: '24h',
      sources: { news: true, social: true },
      highConfidenceOnly: false,
      geography: 'all',
      topics: [],
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fundraising',
    name: 'Fundraising',
    filters: {
      timeWindow: '24h',
      sources: { news: true, social: true },
      highConfidenceOnly: true,
      geography: 'all',
      topics: ['Fundraising', 'Donations', 'Campaign Finance'],
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'opposition',
    name: 'Opposition',
    filters: {
      timeWindow: '6h',
      sources: { news: true, social: true },
      highConfidenceOnly: false,
      geography: 'all',
      topics: ['Opposition', 'Attacks', 'Criticism'],
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'local',
    name: 'Local Focus',
    filters: {
      timeWindow: '24h',
      sources: { news: true, social: true },
      highConfidenceOnly: false,
      geography: 'state',
      topics: [],
    },
    createdAt: new Date().toISOString(),
  },
];

interface UseSavedViewsOptions {
  organizationId?: string;
}

export function useSavedViews(options: UseSavedViewsOptions = {}) {
  // In production, this would fetch from DB based on organizationId
  const [views, setViews] = useState<SavedView[]>(DEFAULT_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string>('default');

  const activeView = useMemo(
    () => views.find(v => v.id === activeViewId) || views[0],
    [views, activeViewId]
  );

  const selectView = useCallback((viewId: string) => {
    setActiveViewId(viewId);
  }, []);

  const createView = useCallback((name: string, filters: FilterState) => {
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name,
      filters,
      createdAt: new Date().toISOString(),
    };
    setViews(prev => [...prev, newView]);
    setActiveViewId(newView.id);
    return newView;
  }, []);

  const updateView = useCallback((viewId: string, updates: Partial<Pick<SavedView, 'name' | 'filters'>>) => {
    setViews(prev => prev.map(v => 
      v.id === viewId ? { ...v, ...updates } : v
    ));
  }, []);

  const deleteView = useCallback((viewId: string) => {
    const view = views.find(v => v.id === viewId);
    if (view?.isDefault) return; // Can't delete default views
    
    setViews(prev => prev.filter(v => v.id !== viewId));
    if (activeViewId === viewId) {
      setActiveViewId('default');
    }
  }, [views, activeViewId]);

  return {
    views,
    activeView,
    activeViewId,
    selectView,
    createView,
    updateView,
    deleteView,
  };
}

export type { FilterState };
