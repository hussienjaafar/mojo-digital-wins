import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subDays, format } from 'date-fns';

export type ChannelFilter = 'all' | 'meta' | 'sms' | 'donations';
export type ViewMode = 'overview' | 'detailed';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DashboardState {
  // Date range
  dateRange: DateRange;
  setDateRange: (startDate: string, endDate: string) => void;
  
  // Channel filter
  selectedChannel: ChannelFilter;
  setSelectedChannel: (channel: ChannelFilter) => void;
  
  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Refresh mechanism
  refreshKey: number;
  triggerRefresh: () => void;
  
  // Comparison mode
  comparisonEnabled: boolean;
  toggleComparison: () => void;
  
  // Selected KPI for drill-down
  selectedKPI: string | null;
  setSelectedKPI: (kpi: string | null) => void;
  
  // Reset to defaults
  resetFilters: () => void;
}

const getDefaultDateRange = (): DateRange => ({
  startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
});

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      // Date range
      dateRange: getDefaultDateRange(),
      setDateRange: (startDate, endDate) =>
        set({ dateRange: { startDate, endDate } }),

      // Channel filter
      selectedChannel: 'all',
      setSelectedChannel: (channel) => set({ selectedChannel: channel }),

      // View mode
      viewMode: 'overview',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Refresh mechanism
      refreshKey: 0,
      triggerRefresh: () =>
        set((state) => ({ refreshKey: state.refreshKey + 1 })),

      // Comparison mode
      comparisonEnabled: false,
      toggleComparison: () =>
        set((state) => ({ comparisonEnabled: !state.comparisonEnabled })),

      // Selected KPI
      selectedKPI: null,
      setSelectedKPI: (kpi) => set({ selectedKPI: kpi }),

      // Reset
      resetFilters: () =>
        set({
          dateRange: getDefaultDateRange(),
          selectedChannel: 'all',
          viewMode: 'overview',
          comparisonEnabled: false,
          selectedKPI: null,
        }),
    }),
    {
      name: 'dashboard-store',
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedChannel: state.selectedChannel,
        viewMode: state.viewMode,
        comparisonEnabled: state.comparisonEnabled,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useDateRange = () => useDashboardStore((s) => s.dateRange);
export const useSelectedChannel = () => useDashboardStore((s) => s.selectedChannel);
export const useViewMode = () => useDashboardStore((s) => s.viewMode);
export const useRefreshKey = () => useDashboardStore((s) => s.refreshKey);
export const useComparisonEnabled = () => useDashboardStore((s) => s.comparisonEnabled);
