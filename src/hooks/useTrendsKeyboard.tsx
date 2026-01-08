import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcut } from './useKeyboardShortcut';

interface UseTrendsKeyboardProps {
  trendIds: string[];
  onDrilldown?: (trendId: string) => void;
  onBack?: () => void;
  isInDrilldown: boolean;
}

export function useTrendsKeyboard({
  trendIds,
  onDrilldown,
  onBack,
  isInDrilldown,
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

  useKeyboardShortcut([
    {
      key: 'k',
      callback: navigateUp,
      description: 'Previous trend',
    },
    {
      key: 'j',
      callback: navigateDown,
      description: 'Next trend',
    },
    {
      key: 'ArrowUp',
      callback: navigateUp,
      description: 'Previous trend',
    },
    {
      key: 'ArrowDown',
      callback: navigateDown,
      description: 'Next trend',
    },
    {
      key: 'Enter',
      callback: selectCurrent,
      description: 'View trend details',
    },
    {
      key: 'Escape',
      callback: goBack,
      description: 'Go back',
    },
  ]);

  return {
    selectedIndex,
    setSelectedIndex,
    selectedTrendId: selectedIndex >= 0 ? trendIds[selectedIndex] : null,
  };
}
