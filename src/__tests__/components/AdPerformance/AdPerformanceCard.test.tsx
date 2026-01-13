import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdPerformanceCard } from '../../../components/client/AdPerformance/AdPerformanceCard';
import { AdPerformanceData } from '../../../queries/useAdPerformanceQuery';

// Mock the V3 components and Radix Accordion for testing
// In a real project, these mocks would likely live in a global setup file or a dedicated mocks directory.
jest.mock('../../../design-system/V3Card', () => ({
  V3Card: ({ children, accent, className }: any) => (
    <div data-testid="v3-card" data-accent={accent} className={className}>
      {children}
    </div>
  ),
}));
jest.mock('../../../design-system/V3MetricChip', () => ({
  V3MetricChip: ({ label, value, tooltip }: any) => (
    <div data-testid="v3-metric-chip" data-label={label} data-value={value} title={tooltip}>
      {label}: {value}
    </div>
  ),
}));
jest.mock('../../../design-system/V3Badge', () => ({
  V3Badge: ({ children, variant, tooltip, className }: any) => (
    <span data-testid="v3-badge" data-variant={variant} title={tooltip} className={className}>
      {children}
    </span>
  ),
}));
jest.mock('@radix-ui/react-accordion', () => ({
  Root: ({ children, type, collapsible }: any) => (
    <div data-testid="accordion-root" data-type={type} data-collapsible={collapsible}>{children}</div>
  ),
  Item: ({ children, value }: any) => (
    <div data-testid={`accordion-item-${value}`}>{children}</div>
  ),
  Header: ({ children, className }: any) => {
    // Simulate the state of the accordion header for testing
    const [isOpen, setIsOpen] = React.useState(false);
    return (
      <button
        data-testid="accordion-header"
        className={className}
        data-state={isOpen ? 'open' : 'closed'}
        onClick={() => setIsOpen(!isOpen)}
      >
        {children}
      </button>
    );
  },
  Content: ({ children, className }: any) => {
    // Simulate the state of the accordion content for testing
    const headerButton = screen.queryByTestId('accordion-header');
    const isOpen = headerButton?.getAttribute('data-state') === 'open';
    
    return (
      <div 
        data-testid="accordion-content" 
        className={`${className} ${isOpen ? 'data-[state=open]:animate-slideDown' : 'data-[state=closed]:animate-slideUp'}`}
        style={{ display: isOpen ? 'block' : 'none' }} // Directly control visibility for test
      >
        {children}
      </div>
    );
  },
}));
jest.mock('@radix-ui/react-icons', () => ({
  ChevronDownIcon: () => <span data-testid="chevron-down-icon">↓</span>,
}));


describe('AdPerformanceCard', () => {
  const mockAd: AdPerformanceData = {
    ad_id: 'ad-123',
    ref_code: 'TEST-AD-001',
    status: 'ACTIVE',
    spend: 1500,
    raised: 4500,
    roas: 3,
    profit: 3000,
    roi_pct: 200,
    cpa: 25,
    creative_thumbnail_url: 'https://example.com/thumbnail.jpg',
    ad_copy_headline: 'Amazing Offer!',
    ad_copy_primary_text: 'This is the primary text for a high-performing ad.',
    ad_copy_description: 'Click now to learn more.',
    performance_tier: 'TOP_PERFORMER',
    key_themes: ['Urgency', 'Value'],
    ctr: 2.1,
    cpm: 12.5,
    cpc: 0.7,
    frequency: 1.5,
  };

  it('renders ad details correctly', () => {
    render(<AdPerformanceCard ad={mockAd} />);

    expect(screen.getByText('TEST-AD-001')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Spend: $1,500.00')).toBeInTheDocument();
    expect(screen.getByText('Raised: $4,500.00')).toBeInTheDocument();
    expect(screen.getByText('ROAS: 3.00x')).toBeInTheDocument();
    expect(screen.getByText('CPA: $25.00')).toBeInTheDocument();
    expect(screen.getByText('CTR: 2.1%')).toBeInTheDocument();
    expect(screen.getByText('CPM: $12.50')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /thumbnail for TEST-AD-001/i })).toHaveAttribute('src', mockAd.creative_thumbnail_url);
    expect(screen.getByText('Performance Tier: TOP PERFORMER')).toBeInTheDocument();
    expect(screen.getByText('Urgency')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('displays low spend badge for ads below threshold', () => {
    const lowSpendAd = { ...mockAd, spend: 49 };
    render(<AdPerformanceCard ad={lowSpendAd} />);
    expect(screen.getByText('Low Spend ⓘ')).toBeInTheDocument();
    expect(screen.getByTitle('Statistical Caution: Results may not be significant due to low spend.')).toBeInTheDocument();
  });

  it('hides creative thumbnail if not provided', () => {
    const adWithoutThumbnail = { ...mockAd, creative_thumbnail_url: undefined };
    render(<AdPerformanceCard ad={adWithoutThumbnail} />);
    expect(screen.queryByRole('img', { name: /thumbnail for TEST-AD-001/i })).not.toBeInTheDocument();
  });

  it('displays N/A for undefined ROAS', () => {
    const adWithUndefinedRoas = { ...mockAd, roas: undefined, raised: undefined };
    render(<AdPerformanceCard ad={adWithUndefinedRoas} />);
    expect(screen.getByText('ROAS: N/A')).toBeInTheDocument();
    expect(screen.getByText('Raised: N/A')).toBeInTheDocument();
  });

  it('displays "No attributed donations yet" tooltip for 0 raised', () => {
    const adWithZeroRaised = { ...mockAd, raised: 0, roas: 0 };
    render(<AdPerformanceCard ad={adWithZeroRaised} />);
    expect(screen.getByText('ROAS: 0.00x')).toBeInTheDocument();
    expect(screen.getByTitle('No attributed donations yet')).toBeInTheDocument();
  });

  // Test accordion expansion (with mocked Radix Accordion)
  it('shows message details when accordion header is clicked', () => {
    render(<AdPerformanceCard ad={mockAd} />);
    
    // Initial state: content is hidden
    const accordionContent = screen.getByTestId('accordion-content');
    expect(accordionContent).toHaveStyle('display: none');

    // Click to open
    fireEvent.click(screen.getByTestId('accordion-header'));
    
    // Content should now be visible
    expect(accordionContent).toHaveStyle('display: block');

    expect(screen.getByText('**Headline:** Amazing Offer!')).toBeInTheDocument();
    expect(screen.getByText('**Primary Text:** This is the primary text for a high-performing ad.')).toBeInTheDocument();
    expect(screen.getByText('**Description:** Click now to learn more.')).toBeInTheDocument();
  });
});
