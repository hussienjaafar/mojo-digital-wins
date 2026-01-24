import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export type ChannelFilter = 'all' | 'meta' | 'sms' | 'donations';
export type ViewMode = 'overview' | 'detailed';

export type KpiKey =
  // Dashboard KPIs
  | 'netRevenue'
  | 'netRoi'
  | 'refundRate'
  | 'currentMrr'
  | 'newMrr'
  | 'uniqueDonors'
  // Creative Intelligence KPIs
  | 'totalCreatives'
  | 'activeVariations'
  | 'avgRoas'
  | 'topPerformers'
  | 'needsWork'
  | 'aiAnalyzed'
  | 'videos'
  | 'images'
  | 'total'
  | 'variations';

export type SeriesKey =
  | 'donations'
  | 'netDonations'
  | 'refunds'
  | 'metaSpend'
  | 'smsSpend';

interface DateRange {
  startDate: string;
  endDate: string;
}

// ============================================================================
// KPI to Series Mapping (for cross-highlighting)
// ============================================================================

/**
 * Maps each KPI to the chart series it directly represents.
 * Used for cross-highlighting: when a KPI is hovered, related series are highlighted.
 *
 * IMPORTANT: Only map KPIs to series that directly display the same data.
 * Calculated/derived metrics should have empty arrays to avoid misleading highlights.
 *
 * Mapping rationale:
 * - netRevenue → netDonations (direct: same data)
 * - netRoi → [] (derived from netDonations ÷ spend, not a single series)
 * - refundRate → refunds, donations (derived from these components)
 * - recurringHealth → [] (no recurring-only series in chart today)
 * - attributionQuality → [] (no attribution series in chart today)
 * - uniqueDonors → [] (no donor count series in chart today)
 */
export const KPI_TO_SERIES_MAP: Record<KpiKey, SeriesKey[]> = {
  // Dashboard KPIs
  netRevenue: ['netDonations'],
  netRoi: [], // Derived metric - highlighting spend series would be misleading
  refundRate: ['refunds', 'donations'],
  currentMrr: [], // No recurring-specific series in Fundraising chart
  newMrr: [], // No recurring-specific series in Fundraising chart
  uniqueDonors: [], // No donor count series in Fundraising chart
  // Creative Intelligence KPIs (no chart series associations)
  totalCreatives: [],
  activeVariations: [],
  avgRoas: [],
  topPerformers: [],
  needsWork: [],
  aiAnalyzed: [],
  videos: [],
  images: [],
  total: [],
  variations: [],
};

/**
 * Reverse mapping: Series to KPIs
 * Used when chart series is hovered to highlight related KPIs
 *
 * Only includes mappings where the series directly represents the KPI data.
 * Keep in sync with KPI_TO_SERIES_MAP above.
 */
export const SERIES_TO_KPI_MAP: Record<SeriesKey, KpiKey[]> = {
  donations: ['refundRate'], // Used in refund rate calculation
  netDonations: ['netRevenue'],
  refunds: ['refundRate'],
  metaSpend: [], // Spend series - no direct KPI (ROI is derived)
  smsSpend: [], // Spend series - no direct KPI (ROI is derived)
};

// ============================================================================
// Constants
// ============================================================================

/** Session staleness threshold: 24 hours in milliseconds */
const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Store Interface
// ============================================================================

interface DashboardState {
  // Date range
  dateRange: DateRange;
  setDateRange: (startDate: string, endDate: string) => void;

  // Last accessed timestamp (for session freshness check)
  lastAccessedAt: number | null;

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

  // Selected KPI for drill-down (click state)
  selectedKpiKey: KpiKey | null;
  setSelectedKpiKey: (kpi: KpiKey | null) => void;

  // Highlighted KPI for cross-highlighting (hover state)
  highlightedKpiKey: KpiKey | null;
  setHighlightedKpiKey: (kpi: KpiKey | null) => void;

  // Highlighted date for chart interaction
  highlightedDate: string | null;
  setHighlightedDate: (date: string | null) => void;

  // Drilldown drawer open state
  isDrilldownOpen: boolean;
  setDrilldownOpen: (open: boolean) => void;

  // Clear all interaction state
  clearHighlights: () => void;

  // Reset to defaults
  resetFilters: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const getDefaultDateRange = (): DateRange => ({
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
});

// ============================================================================
// Store
// ============================================================================

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      // Date range - defaults to today
      dateRange: getDefaultDateRange(),
      setDateRange: (startDate, endDate) =>
        set({ 
          dateRange: { startDate, endDate },
          lastAccessedAt: Date.now(), // Update access timestamp on date change
        }),

      // Last accessed timestamp
      lastAccessedAt: null,

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

      // Selected KPI (click state - persists until changed)
      selectedKpiKey: null,
      setSelectedKpiKey: (kpi) => set({ selectedKpiKey: kpi }),

      // Highlighted KPI (hover state - transient)
      highlightedKpiKey: null,
      setHighlightedKpiKey: (kpi) => set({ highlightedKpiKey: kpi }),

      // Highlighted date
      highlightedDate: null,
      setHighlightedDate: (date) => set({ highlightedDate: date }),

      // Drilldown drawer
      isDrilldownOpen: false,
      setDrilldownOpen: (open) => set({ isDrilldownOpen: open }),

      // Clear highlights
      clearHighlights: () =>
        set({
          highlightedKpiKey: null,
          highlightedDate: null,
        }),

      // Reset all filters
      resetFilters: () =>
        set({
          dateRange: getDefaultDateRange(),
          selectedChannel: 'all',
          viewMode: 'overview',
          comparisonEnabled: false,
          selectedKpiKey: null,
          highlightedKpiKey: null,
          highlightedDate: null,
          isDrilldownOpen: false,
          lastAccessedAt: Date.now(),
        }),
    }),
    {
      name: 'dashboard-store',
      // Only persist user preferences, not transient interaction state
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedChannel: state.selectedChannel,
        viewMode: state.viewMode,
        comparisonEnabled: state.comparisonEnabled,
        lastAccessedAt: state.lastAccessedAt,
      }),
      // Handle session freshness on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          const now = Date.now();
          const lastAccess = state.lastAccessedAt;
          
          // If session is stale (>24 hours) or no previous access, reset to today
          if (!lastAccess || (now - lastAccess) > STALENESS_THRESHOLD_MS) {
            state.dateRange = getDefaultDateRange();
          }
          
          // Update last accessed timestamp
          state.lastAccessedAt = now;
        }
      },
    }
  )
);

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

export const useDateRange = () => useDashboardStore((s) => s.dateRange);
export const useSelectedChannel = () => useDashboardStore((s) => s.selectedChannel);
export const useViewMode = () => useDashboardStore((s) => s.viewMode);
export const useRefreshKey = () => useDashboardStore((s) => s.refreshKey);
export const useComparisonEnabled = () => useDashboardStore((s) => s.comparisonEnabled);

// New selectors for cross-highlighting
export const useSelectedKpiKey = () => useDashboardStore((s) => s.selectedKpiKey);
export const useHighlightedKpiKey = () => useDashboardStore((s) => s.highlightedKpiKey);
export const useHighlightedDate = () => useDashboardStore((s) => s.highlightedDate);
export const useIsDrilldownOpen = () => useDashboardStore((s) => s.isDrilldownOpen);

/**
 * Returns the series keys that should be highlighted based on current KPI highlight state
 */
export const useHighlightedSeriesKeys = (): SeriesKey[] => {
  const highlightedKpiKey = useHighlightedKpiKey();
  if (!highlightedKpiKey) return [];
  return KPI_TO_SERIES_MAP[highlightedKpiKey] || [];
};

/**
 * Returns whether a specific series should be dimmed (not highlighted)
 */
export const useIsSeriesDimmed = (seriesKey: SeriesKey): boolean => {
  const highlightedSeries = useHighlightedSeriesKeys();
  if (highlightedSeries.length === 0) return false;
  return !highlightedSeries.includes(seriesKey);
};
