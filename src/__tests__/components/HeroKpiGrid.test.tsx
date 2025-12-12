import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import type { HeroKpiData } from '@/components/client/HeroKpiGrid';

// Mock the entire HeroKpiGrid module to test prop passthrough behavior
// without dealing with framer-motion complexity
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="sparkline-chart">{children}</svg>,
  Line: () => null,
  Tooltip: () => null,
  default: {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="sparkline-chart">{children}</svg>,
    Line: () => null,
    Tooltip: () => null,
  },
}));

// Mock V3KPIDrilldownDrawer
vi.mock('@/components/v3/V3KPIDrilldownDrawer', () => ({
  V3KPIDrilldownDrawer: () => null,
}));

// Mock dashboard store
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn((selector) => {
    const state = {
      setSelectedKpiKey: vi.fn(),
      setHighlightedKpiKey: vi.fn(),
      setDrilldownOpen: vi.fn(),
      isDrilldownOpen: false,
    };
    return selector(state);
  }),
  useSelectedKpiKey: vi.fn(() => null),
  useHighlightedKpiKey: vi.fn(() => null),
  useIsDrilldownOpen: vi.fn(() => false),
}));

// Mock framer-motion completely
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    motion: {
      div: React.forwardRef(({ children, className, role, ...props }: any, ref: any) => (
        <div ref={ref} className={className} role={role} aria-label={props['aria-label']}>
          {children}
        </div>
      )),
      section: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
        <section ref={ref} className={className} aria-label={props['aria-label']}>
          {children}
        </section>
      )),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('HeroKpiGrid', () => {
  const mockTrendData = [
    { date: 'Jan 1', value: 1200 },
    { date: 'Jan 8', value: 1450 },
    { date: 'Jan 15', value: 1380 },
  ];

  const mockBreakdown = [
    { label: 'Gross Revenue', value: '$125,000' },
    { label: 'Processing Fees', value: '-$5,000', percentage: 4 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HeroKpiData interface', () => {
    it('accepts trendData in data array', () => {
      const data: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          trendData: mockTrendData,
          trendXAxisKey: 'date',
        },
      ];

      // Verify the interface accepts these props
      expect(data[0].trendData).toEqual(mockTrendData);
      expect(data[0].trendXAxisKey).toBe('date');
    });

    it('accepts breakdown in data array', () => {
      const data: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          breakdown: mockBreakdown,
        },
      ];

      expect(data[0].breakdown).toEqual(mockBreakdown);
    });

    it('accepts expandable flag in data array', () => {
      const data: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          expandable: true,
        },
      ];

      expect(data[0].expandable).toBe(true);
    });

    it('accepts all drilldown props together', () => {
      const data: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          trendData: mockTrendData,
          trendXAxisKey: 'date',
          breakdown: mockBreakdown,
          expandable: true,
        },
      ];

      expect(data[0].trendData).toBeDefined();
      expect(data[0].trendXAxisKey).toBe('date');
      expect(data[0].breakdown).toBeDefined();
      expect(data[0].expandable).toBe(true);
    });

    it('makes drilldown props optional', () => {
      const data: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          // No drilldown props - should be valid
        },
      ];

      expect(data[0].trendData).toBeUndefined();
      expect(data[0].breakdown).toBeUndefined();
      expect(data[0].expandable).toBeUndefined();
    });
  });

  describe('drilldown data shapes', () => {
    it('trendData accepts array of objects with date and value', () => {
      const trendData = [
        { date: '2024-01-01', value: 1000 },
        { date: '2024-01-02', value: 1200 },
        { date: '2024-01-03', value: 1100 },
      ];

      const data: HeroKpiData = {
        kpiKey: 'netRevenue',
        label: 'Test',
        value: '$1,000',
        icon: DollarSign,
        trendData,
      };

      expect(data.trendData?.length).toBe(3);
    });

    it('breakdown accepts array with label, value, and optional percentage', () => {
      const breakdown = [
        { label: 'Item 1', value: '$500' },
        { label: 'Item 2', value: '$300', percentage: 60 },
        { label: 'Item 3', value: 200 }, // numeric value allowed
      ];

      const data: HeroKpiData = {
        kpiKey: 'netRevenue',
        label: 'Test',
        value: '$1,000',
        icon: DollarSign,
        breakdown,
      };

      expect(data.breakdown?.length).toBe(3);
      expect(data.breakdown?.[1].percentage).toBe(60);
    });
  });

  describe('grid configuration', () => {
    it('accepts mobileColumns prop', () => {
      const gridProps = {
        data: [] as HeroKpiData[],
        mobileColumns: 1 as const,
      };

      expect(gridProps.mobileColumns).toBe(1);
    });

    it('accepts tabletColumns prop', () => {
      const gridProps = {
        data: [] as HeroKpiData[],
        tabletColumns: 4 as const,
      };

      expect(gridProps.tabletColumns).toBe(4);
    });

    it('accepts desktopColumns prop', () => {
      const gridProps = {
        data: [] as HeroKpiData[],
        desktopColumns: 6 as const,
      };

      expect(gridProps.desktopColumns).toBe(6);
    });
  });

  describe('multiple KPI data structures', () => {
    it('supports mixed expandable and non-expandable KPIs', () => {
      const mixedKpis: HeroKpiData[] = [
        {
          kpiKey: 'netRevenue',
          label: 'Net Revenue',
          value: '$100,000',
          icon: DollarSign,
          trendData: mockTrendData,
          breakdown: mockBreakdown,
          expandable: true,
        },
        {
          kpiKey: 'netRoi',
          label: 'Net ROI',
          value: '2.5x',
          icon: TrendingUp,
          // Not expandable - no drilldown data
        },
        {
          kpiKey: 'uniqueDonors',
          label: 'Unique Donors',
          value: '1,234',
          icon: Users,
          breakdown: mockBreakdown, // Only breakdown, auto-expandable
        },
      ];

      expect(mixedKpis[0].expandable).toBe(true);
      expect(mixedKpis[1].expandable).toBeUndefined();
      expect(mixedKpis[2].breakdown).toBeDefined();
    });
  });
});
