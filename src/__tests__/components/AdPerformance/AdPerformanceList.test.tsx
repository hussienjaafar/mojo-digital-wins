import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdPerformanceList } from '../../../components/client/AdPerformance/AdPerformanceList';
import { AdPerformanceData } from '../../../queries/useAdPerformanceQuery';
import { AdPerformanceCardSkeleton } from '../../../components/client/AdPerformance/AdPerformanceCardSkeleton';

// Mock the AdPerformanceCard, V3EmptyState, V3ErrorState for isolated testing
jest.mock('../../../components/client/AdPerformance/AdPerformanceCard', () => ({
  AdPerformanceCard: ({ ad }: any) => (
    <div data-testid={`mock-ad-card-${ad.ad_id}`}>{ad.ref_code}</div>
  ),
}));
jest.mock('../../../components/client/AdPerformance/AdPerformanceCardSkeleton', () => ({
  AdPerformanceCardSkeleton: () => <div data-testid="mock-ad-card-skeleton">Loading Ad Card</div>,
}));
jest.mock('../../../design-system/V3EmptyState', () => ({
  V3EmptyState: ({ title, message }: any) => (
    <div data-testid="v3-empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  ),
}));
jest.mock('../../../design-system/V3ErrorState', () => ({
  V3ErrorState: ({ title, message, onRetry }: any) => (
    <div data-testid="v3-error-state">
      <h3>{title}</h3>
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

describe('AdPerformanceList', () => {
  const mockAds: AdPerformanceData[] = [
    { ad_id: 'ad-1', ref_code: 'REF001', status: 'ACTIVE', spend: 100, raised: 200, roas: 2, profit: 100, roi_pct: 100, cpa: 50 },
    { ad_id: 'ad-2', ref_code: 'REF002', status: 'PAUSED', spend: 50, raised: 25, roas: 0.5, profit: -25, roi_pct: -50, cpa: 25 },
  ];

  it('renders a list of AdPerformanceCards when data is provided', () => {
    render(<AdPerformanceList ads={mockAds} isLoading={false} isError={false} />);

    expect(screen.getByTestId('mock-ad-card-ad-1')).toHaveTextContent('REF001');
    expect(screen.getByTestId('mock-ad-card-ad-2')).toHaveTextContent('REF002');
    expect(screen.queryByTestId('v3-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('v3-error-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-ad-card-skeleton')).not.toBeInTheDocument();
  });

  it('renders V3EmptyState when no ads are provided and not loading/error', () => {
    render(<AdPerformanceList ads={[]} isLoading={false} isError={false} />);

    expect(screen.getByTestId('v3-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Ad Performance Data Available')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-ad-card-ad-1')).not.toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<AdPerformanceList isLoading={true} isError={false} />);

    expect(screen.getAllByTestId('mock-ad-card-skeleton')).toHaveLength(6);
    expect(screen.queryByTestId('v3-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('v3-error-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-ad-card-ad-1')).not.toBeInTheDocument();
  });

  it('renders V3ErrorState when isError is true', () => {
    const error = new Error('Failed to fetch ads');
    render(<AdPerformanceList isLoading={false} isError={true} error={error} />);

    expect(screen.getByTestId('v3-error-state')).toBeInTheDocument();
    expect(screen.getByText('Failed to Load Ad Performance')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch ads')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-ad-card-ad-1')).not.toBeInTheDocument();
  });

  it('calls onRetry when button in V3ErrorState is clicked', () => {
    // Mock window.location.reload as it's called in V3ErrorState
    const reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<AdPerformanceList isLoading={false} isError={true} error={new Error('Test error')} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
