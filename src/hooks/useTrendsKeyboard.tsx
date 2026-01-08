import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcut } from './useKeyboardShortcut';

interface UseTrendsKeyboardProps {
  trendIds: string[];
  onDrilldown?: (trendId: string) => void;
  onBack?: () => void;
  isInDrilldown: boolean;
  onToggleDensity?: () => void;
  onToggleFilters?: () => void;
  onRefresh?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
}

export function useTrendsKeyboard({
  trendIds,
  onDrilldown,
  onBack,
  isInDrilldown,
  onToggleDensity,
  onToggleFilters,
  onRefresh,
  onNextTab,
  onPrevTab,
}: UseTrendsKeyboardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Reset selection when trends change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [trendIds.length]);

  const navigateUp = useCallback(() => {
    if (isInDrilldown || trendIds.length === 0) return;
    setSelectedIndex((prev) => {
      if (prev <= 0) return trendIds.length - 1;
      return prev - 1;
    });
  }, [trendIds.length, isInDrilldown]);

  const navigateDown = useCallback(() => {
    if (isInDrilldown || trendIds.length === 0) return;
    setSelectedIndex((prev) => {
      if (prev >= trendIds.length - 1) return 0;
      return prev + 1;
    });
  }, [trendIds.length, isInDrilldown]);

  const selectCurrent = useCallback(() => {
    if (isInDrilldown || selectedIndex < 0 || selectedIndex >= trendIds.length) return;
    const trendId = trendIds[selectedIndex];
    if (trendId && onDrilldown) {
      onDrilldown(trendId);
    }
  }, [selectedIndex, trendIds, onDrilldown, isInDrilldown]);

  const goBack = useCallback(() => {
    if (!isInDrilldown || !onBack) return;
    onBack();
    setSelectedIndex(-1);
  }, [isInDrilldown, onBack]);

  const toggleDensity = useCallback(() => {
    if (onToggleDensity) onToggleDensity();
  }, [onToggleDensity]);

  const toggleFilters = useCallback(() => {
    if (onToggleFilters) onToggleFilters();
  }, [onToggleFilters]);

  const refresh = useCallback(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const nextTab = useCallback(() => {
    if (onNextTab) onNextTab();
  }, [onNextTab]);

  const prevTab = useCallback(() => {
    if (onPrevTab) onPrevTab();
  }, [onPrevTab]);

  const goToFirst = useCallback(() => {
    if (isInDrilldown || trendIds.length === 0) return;
    setSelectedIndex(0);
  }, [trendIds.length, isInDrilldown]);

  const goToLast = useCallback(() => {
    if (isInDrilldown || trendIds.length === 0) return;
    setSelectedIndex(trendIds.length - 1);
  }, [trendIds.length, isInDrilldown]);

  useKeyboardShortcut([
    // Navigation
    { key: 'k', callback: navigateUp, description: 'Previous trend' },
    { key: 'j', callback: navigateDown, description: 'Next trend' },
    { key: 'ArrowUp', callback: navigateUp, description: 'Previous trend' },
    { key: 'ArrowDown', callback: navigateDown, description: 'Next trend' },
    { key: 'Enter', callback: selectCurrent, description: 'View trend details' },
    { key: 'Escape', callback: goBack, description: 'Go back' },
    
    // Quick navigation
    { key: 'g', callback: goToFirst, description: 'Go to first trend' },
    { key: 'G', shiftKey: true, callback: goToLast, description: 'Go to last trend' },
    
    // View controls
    { key: 'd', callback: toggleDensity, description: 'Toggle density' },
    { key: 'f', callback: toggleFilters, description: 'Toggle filters' },
    { key: 'r', callback: refresh, description: 'Refresh trends' },
    
    // Tab navigation
    { key: 'Tab', callback: nextTab, description: 'Next tab' },
    { key: 'Tab', shiftKey: true, callback: prevTab, description: 'Previous tab' },
  ]);

  return {
    selectedIndex,
    setSelectedIndex,
    selectedTrendId: selectedIndex >= 0 ? trendIds[selectedIndex] : null,
  };
}
