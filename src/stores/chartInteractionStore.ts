import { create } from "zustand";

export interface HoveredDataPoint {
  date: string;
  series?: string;
  value?: number;
}

export interface SelectedTimeRange {
  start: string;
  end: string;
}

interface ChartInteractionState {
  // Hover state for cross-highlighting
  hoveredDataPoint: HoveredDataPoint | null;
  
  // Brush/selection state for time range filtering
  selectedTimeRange: SelectedTimeRange | null;
  
  // Highlighted series for legend interaction
  highlightedSeries: string | null;
  
  // Whether brush mode is active
  brushMode: boolean;
  
  // Actions
  setHoveredDataPoint: (point: HoveredDataPoint | null) => void;
  setSelectedTimeRange: (range: SelectedTimeRange | null) => void;
  setHighlightedSeries: (series: string | null) => void;
  setBrushMode: (enabled: boolean) => void;
  clearInteractions: () => void;
}

export const useChartInteractionStore = create<ChartInteractionState>((set) => ({
  hoveredDataPoint: null,
  selectedTimeRange: null,
  highlightedSeries: null,
  brushMode: false,

  setHoveredDataPoint: (point) => set({ hoveredDataPoint: point }),
  
  setSelectedTimeRange: (range) => set({ selectedTimeRange: range }),
  
  setHighlightedSeries: (series) => set({ highlightedSeries: series }),
  
  setBrushMode: (enabled) => set({ brushMode: enabled }),
  
  clearInteractions: () =>
    set({
      hoveredDataPoint: null,
      selectedTimeRange: null,
      highlightedSeries: null,
      brushMode: false,
    }),
}));

// Selector hooks for performance optimization
export const useHoveredDataPoint = () =>
  useChartInteractionStore((state) => state.hoveredDataPoint);

export const useSelectedTimeRange = () =>
  useChartInteractionStore((state) => state.selectedTimeRange);

export const useHighlightedSeries = () =>
  useChartInteractionStore((state) => state.highlightedSeries);

export const useBrushMode = () =>
  useChartInteractionStore((state) => state.brushMode);
