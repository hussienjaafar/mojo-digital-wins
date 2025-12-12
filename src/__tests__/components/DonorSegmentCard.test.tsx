import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DonorSegmentCard } from '@/components/client/DonorSegmentCard';
import { mockDonorSegmentCardData } from '../mocks/fixtures';
import type { DonorSegmentSummary } from '@/queries/useDonorJourneyQuery';

describe('DonorSegmentCard', () => {
  const mockSegment: DonorSegmentSummary = mockDonorSegmentCardData as DonorSegmentSummary;

  const defaultProps = {
    segment: mockSegment,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders segment name', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });

    it('renders segment description', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(
        screen.getByText('High-value recurring donors with strong engagement')
      ).toBeInTheDocument();
    });

    it('renders donor count', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Donors')).toBeInTheDocument();
      expect(screen.getByText('145')).toBeInTheDocument();
    });

    it('renders total value formatted as currency', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Total Value')).toBeInTheDocument();
      expect(screen.getByText('$425,000')).toBeInTheDocument();
    });

    it('renders average donation formatted as currency', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Avg Donation')).toBeInTheDocument();
      expect(screen.getByText('$2,931')).toBeInTheDocument();
    });

    it('renders retention rate with percentage', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Retention')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('renders trend indicator', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('+8.5%')).toBeInTheDocument();
    });

    it('renders health badge', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });
  });

  describe('health variants', () => {
    it('renders healthy health badge', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('renders growing health badge', () => {
      const growingSegment = { ...mockSegment, health: 'growing' as const };
      render(<DonorSegmentCard {...defaultProps} segment={growingSegment} />);

      expect(screen.getByText('Growing')).toBeInTheDocument();
    });

    it('renders at_risk health badge', () => {
      const atRiskSegment = { ...mockSegment, health: 'at_risk' as const };
      render(<DonorSegmentCard {...defaultProps} segment={atRiskSegment} />);

      expect(screen.getByText('At Risk')).toBeInTheDocument();
    });

    it('renders churned health badge', () => {
      const churnedSegment = { ...mockSegment, health: 'churned' as const };
      render(<DonorSegmentCard {...defaultProps} segment={churnedSegment} />);

      expect(screen.getByText('Churned')).toBeInTheDocument();
    });
  });

  describe('trend display', () => {
    it('shows positive trend with up arrow', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      // Positive trend
      expect(screen.getByText('+8.5%')).toBeInTheDocument();
    });

    it('shows negative trend without plus sign', () => {
      const negativeSegment = { ...mockSegment, trend: -5.2 };
      render(<DonorSegmentCard {...defaultProps} segment={negativeSegment} />);

      expect(screen.getByText('-5.2%')).toBeInTheDocument();
    });

    it('shows zero trend', () => {
      const flatSegment = { ...mockSegment, trend: 0 };
      render(<DonorSegmentCard {...defaultProps} segment={flatSegment} />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  describe('tier display', () => {
    it('handles whale tier', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      // Whale tier uses Heart icon - component renders correctly
      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });

    it('handles dolphin tier', () => {
      const dolphinSegment = { ...mockSegment, tier: 'dolphin' as const };
      render(<DonorSegmentCard {...defaultProps} segment={dolphinSegment} />);

      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });

    it('handles fish tier', () => {
      const fishSegment = { ...mockSegment, tier: 'fish' as const };
      render(<DonorSegmentCard {...defaultProps} segment={fishSegment} />);

      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });

    it('handles minnow tier', () => {
      const minnowSegment = { ...mockSegment, tier: 'minnow' as const };
      render(<DonorSegmentCard {...defaultProps} segment={minnowSegment} />);

      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(<DonorSegmentCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('article'));

      expect(onSelect).toHaveBeenCalledWith(mockSegment);
    });

    it('calls onSelect on Enter key', () => {
      const onSelect = vi.fn();
      render(<DonorSegmentCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockSegment);
    });

    it('calls onSelect on Space key', () => {
      const onSelect = vi.fn();
      render(<DonorSegmentCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: ' ' });

      expect(onSelect).toHaveBeenCalledWith(mockSegment);
    });

    it('calls onInviteToCampaign when invite button clicked', () => {
      const onInviteToCampaign = vi.fn();
      render(
        <DonorSegmentCard
          {...defaultProps}
          onInviteToCampaign={onInviteToCampaign}
        />
      );

      const inviteBtn = screen.getByRole('button', { name: /invite to campaign/i });
      fireEvent.click(inviteBtn);

      expect(onInviteToCampaign).toHaveBeenCalledWith(mockSegment);
    });

    it('stops propagation when invite button clicked', () => {
      const onSelect = vi.fn();
      const onInviteToCampaign = vi.fn();
      render(
        <DonorSegmentCard
          {...defaultProps}
          onSelect={onSelect}
          onInviteToCampaign={onInviteToCampaign}
        />
      );

      const inviteBtn = screen.getByRole('button', { name: /invite to campaign/i });
      fireEvent.click(inviteBtn);

      expect(onInviteToCampaign).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('optional callbacks', () => {
    it('does not render invite button when onInviteToCampaign not provided', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(
        screen.queryByRole('button', { name: /invite to campaign/i })
      ).not.toBeInTheDocument();
    });

    it('works without onSelect callback', () => {
      render(<DonorSegmentCard segment={mockSegment} />);

      // Should render without errors
      expect(screen.getByText('Major Donors')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has article role', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('has accessible label with segment name and donor count', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAccessibleName(/Major Donors.*145 donors/i);
    });

    it('is focusable via tabIndex', () => {
      render(<DonorSegmentCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('tabindex', '0');
    });
  });
});
