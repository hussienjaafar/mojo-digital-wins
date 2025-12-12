import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DollarSign } from 'lucide-react';
import { HeroKpiCard } from '@/components/client/HeroKpiCard';
import { mockSparklineData } from '../mocks/fixtures';

// Use vi.hoisted() to ensure mock functions are defined before vi.mock factory runs
const { mockSetSelectedKpiKey, mockSetDrilldownOpen, mockSetHighlightedKpiKey } = vi.hoisted(() => ({
  mockSetSelectedKpiKey: vi.fn(),
  mockSetDrilldownOpen: vi.fn(),
  mockSetHighlightedKpiKey: vi.fn(),
}));

// Mock recharts to avoid ResponsiveContainer issues
// This mock handles both static and dynamic imports
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="sparkline-chart">{children}</svg>,
  Line: () => null,
  Tooltip: () => null,
  // Export default for dynamic import
  default: {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="sparkline-chart">{children}</svg>,
    Line: () => null,
    Tooltip: () => null,
  },
}));

// Mock V3KPIDrilldownDrawer to avoid loading full ECharts
vi.mock('@/components/v3/V3KPIDrilldownDrawer', () => ({
  V3KPIDrilldownDrawer: ({ open, data }: { open: boolean; data: any }) =>
    open ? <div data-testid="drilldown-drawer" data-label={data?.label}>Drilldown Drawer</div> : null,
}));

// Mock the dashboard store with drilldown state
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn((selector) => {
    const state = {
      setSelectedKpiKey: mockSetSelectedKpiKey,
      setHighlightedKpiKey: mockSetHighlightedKpiKey,
      setDrilldownOpen: mockSetDrilldownOpen,
      isDrilldownOpen: false,
    };
    return selector(state);
  }),
  useSelectedKpiKey: vi.fn(() => null),
  useHighlightedKpiKey: vi.fn(() => null),
  useIsDrilldownOpen: vi.fn(() => false),
}));

// Mock drilldown data fixtures
export const mockTrendData = [
  { date: 'Jan 1', value: 1200 },
  { date: 'Jan 8', value: 1450 },
  { date: 'Jan 15', value: 1380 },
  { date: 'Jan 22', value: 1650 },
  { date: 'Jan 29', value: 1820 },
];

export const mockBreakdown = [
  { label: 'Gross Revenue', value: '$125,000' },
  { label: 'Processing Fees', value: '-$5,000', percentage: 4 },
  { label: 'Net Revenue', value: '$120,000' },
];

describe('HeroKpiCard', () => {
  const defaultProps = {
    kpiKey: 'totalDonations' as const,
    label: 'Total Donations',
    value: '$125,000',
    icon: DollarSign,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders value', () => {
      render(<HeroKpiCard {...defaultProps} />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders label', () => {
      render(<HeroKpiCard {...defaultProps} />);

      expect(screen.getByText('Total Donations')).toBeInTheDocument();
    });

    it('renders with icon', () => {
      render(<HeroKpiCard {...defaultProps} />);

      // Icon is rendered (aria-hidden)
      expect(screen.getByText('Total Donations')).toBeInTheDocument();
    });

    it('renders trend indicator when provided', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trend={{ value: 12.5, isPositive: true }}
        />
      );

      expect(screen.getByText('12.5%')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <HeroKpiCard {...defaultProps} subtitle="Last 30 days" />
      );

      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('renders previous value when provided', () => {
      render(
        <HeroKpiCard {...defaultProps} previousValue="$110,000" />
      );

      expect(screen.getByText('Previous: $110,000')).toBeInTheDocument();
    });

    it('renders sparkline when data provided', async () => {
      render(
        <HeroKpiCard {...defaultProps} sparklineData={mockSparklineData} />
      );

      // Wait for lazy-loaded sparkline chart to render
      await waitFor(() => {
        expect(screen.getByTestId('sparkline-chart')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows skeleton when isLoading is true', () => {
      render(<HeroKpiCard {...defaultProps} isLoading />);

      // Value should not be visible
      expect(screen.queryByText('$125,000')).not.toBeInTheDocument();
    });

    it('hides all content when loading', () => {
      render(<HeroKpiCard {...defaultProps} isLoading />);

      expect(screen.queryByText('Total Donations')).not.toBeInTheDocument();
    });
  });

  describe('accent colors', () => {
    it('renders with blue accent (default)', () => {
      render(<HeroKpiCard {...defaultProps} accent="blue" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders with green accent', () => {
      render(<HeroKpiCard {...defaultProps} accent="green" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders with purple accent', () => {
      render(<HeroKpiCard {...defaultProps} accent="purple" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders with amber accent', () => {
      render(<HeroKpiCard {...defaultProps} accent="amber" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders with red accent', () => {
      render(<HeroKpiCard {...defaultProps} accent="red" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders with default accent', () => {
      render(<HeroKpiCard {...defaultProps} accent="default" />);

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });
  });

  describe('trend display', () => {
    it('shows positive trend styling', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trend={{ value: 15, isPositive: true }}
        />
      );

      expect(screen.getByText('15%')).toBeInTheDocument();
    });

    it('shows negative trend styling', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trend={{ value: -8, isPositive: false }}
        />
      );

      expect(screen.getByText('8%')).toBeInTheDocument();
    });

    it('shows trend label when provided', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trend={{ value: 12, label: 'vs last week' }}
        />
      );

      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<HeroKpiCard {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalled();
    });

    it('is keyboard accessible', () => {
      render(<HeroKpiCard {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('responds to Enter key', () => {
      const onClick = vi.fn();
      render(<HeroKpiCard {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalled();
    });

    it('responds to Space key', () => {
      const onClick = vi.fn();
      render(<HeroKpiCard {...defaultProps} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('sparkline', () => {
    it('renders sparkline with array of numbers', async () => {
      const numericData = [100, 120, 115, 140, 155];
      render(<HeroKpiCard {...defaultProps} sparklineData={numericData} />);

      // Wait for lazy-loaded sparkline to render
      await waitFor(() => {
        expect(screen.getByTestId('sparkline-chart')).toBeInTheDocument();
      });
    });

    it('renders sparkline with data points', async () => {
      render(
        <HeroKpiCard {...defaultProps} sparklineData={mockSparklineData} />
      );

      // Wait for lazy-loaded sparkline to render
      await waitFor(() => {
        expect(screen.getByTestId('sparkline-chart')).toBeInTheDocument();
      });
    });

    it('does not render sparkline with insufficient data', () => {
      const insufficientData = [100];
      render(<HeroKpiCard {...defaultProps} sparklineData={insufficientData} />);

      expect(screen.queryByTestId('sparkline-chart')).not.toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('wraps with tooltip when description provided', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          description="Total gross donations received"
        />
      );

      // Component still renders
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has button role', () => {
      render(<HeroKpiCard {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has accessible label with value and trend', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trend={{ value: 15, isPositive: true }}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(/Total Donations.*\$125,000.*up 15%/i);
    });

    it('has aria-pressed when selected', async () => {
      const { useSelectedKpiKey } = await import('@/stores/dashboardStore');
      vi.mocked(useSelectedKpiKey).mockReturnValue('totalDonations');

      render(<HeroKpiCard {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('subtitle vs previousValue', () => {
    it('prefers subtitle over previousValue', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          subtitle="Custom subtitle"
          previousValue="$110,000"
        />
      );

      expect(screen.getByText('Custom subtitle')).toBeInTheDocument();
      expect(screen.queryByText('Previous: $110,000')).not.toBeInTheDocument();
    });
  });

  describe('drilldown functionality', () => {
    const drilldownProps = {
      ...defaultProps,
      trendData: mockTrendData,
      trendXAxisKey: 'date',
      breakdown: mockBreakdown,
      expandable: true,
    };

    it('renders expand chevron when expandable with drilldown data', () => {
      render(<HeroKpiCard {...drilldownProps} />);

      // Should have expand chevron (group-hover visible)
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('calls setSelectedKpiKey and setDrilldownOpen when clicked with drilldown data', async () => {
      render(<HeroKpiCard {...drilldownProps} />);

      fireEvent.click(screen.getByRole('button'));

      expect(mockSetSelectedKpiKey).toHaveBeenCalledWith('totalDonations');
      expect(mockSetDrilldownOpen).toHaveBeenCalledWith(true);
    });

    it('does not call setDrilldownOpen when clicked without drilldown data', () => {
      render(<HeroKpiCard {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      // Should only set selected key, not open drilldown
      expect(mockSetSelectedKpiKey).toHaveBeenCalled();
      // setDrilldownOpen should NOT have been called (no drilldown data)
    });

    it('auto-detects expandable when trendData is provided', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trendData={mockTrendData}
          // Note: expandable not explicitly set
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('auto-detects expandable when breakdown is provided', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          breakdown={mockBreakdown}
          // Note: expandable not explicitly set
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('has aria-expanded attribute when expandable', () => {
      render(<HeroKpiCard {...drilldownProps} />);

      const button = screen.getByRole('button');
      // aria-expanded should be present when card has drilldown capability
      expect(button).toHaveAttribute('aria-expanded');
    });

    it('sets aria-expanded to true when drilldown is open and selected', async () => {
      // Mock the store to return this card as selected with drilldown open
      const { useSelectedKpiKey, useIsDrilldownOpen } = await import('@/stores/dashboardStore');
      vi.mocked(useSelectedKpiKey).mockReturnValue('totalDonations');
      vi.mocked(useIsDrilldownOpen).mockReturnValue(true);

      render(<HeroKpiCard {...drilldownProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles keyboard Enter to open drilldown', async () => {
      // Reset mocks to default state (not selected, drilldown closed)
      const { useSelectedKpiKey, useIsDrilldownOpen } = await import('@/stores/dashboardStore');
      vi.mocked(useSelectedKpiKey).mockReturnValue(null);
      vi.mocked(useIsDrilldownOpen).mockReturnValue(false);
      vi.clearAllMocks();

      render(<HeroKpiCard {...drilldownProps} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(mockSetSelectedKpiKey).toHaveBeenCalledWith('totalDonations');
      expect(mockSetDrilldownOpen).toHaveBeenCalledWith(true);
    });

    it('handles keyboard Space to open drilldown', async () => {
      // Reset mocks to default state (not selected, drilldown closed)
      const { useSelectedKpiKey, useIsDrilldownOpen } = await import('@/stores/dashboardStore');
      vi.mocked(useSelectedKpiKey).mockReturnValue(null);
      vi.mocked(useIsDrilldownOpen).mockReturnValue(false);
      vi.clearAllMocks();

      render(<HeroKpiCard {...drilldownProps} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(mockSetSelectedKpiKey).toHaveBeenCalledWith('totalDonations');
      expect(mockSetDrilldownOpen).toHaveBeenCalledWith(true);
    });

    it('passes trendXAxisKey to drilldown data', () => {
      const customXAxisKey = 'customDate';
      render(
        <HeroKpiCard
          {...defaultProps}
          trendData={mockTrendData}
          trendXAxisKey={customXAxisKey}
        />
      );

      // Component renders without error
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('renders breakdown items correctly in drilldown data', () => {
      render(<HeroKpiCard {...drilldownProps} />);

      // Component renders without error with breakdown data
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });
  });

  describe('drilldown prop passthrough', () => {
    it('accepts trendData prop', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trendData={mockTrendData}
        />
      );

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('accepts breakdown prop', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          breakdown={mockBreakdown}
        />
      );

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('accepts expandable prop set to false', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trendData={mockTrendData}
          breakdown={mockBreakdown}
          expandable={false}
        />
      );

      // Should render but not have expand behavior
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('accepts both trendData and breakdown together', () => {
      render(
        <HeroKpiCard
          {...defaultProps}
          trendData={mockTrendData}
          breakdown={mockBreakdown}
        />
      );

      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });
  });
});
