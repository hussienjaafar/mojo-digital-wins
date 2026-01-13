import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpportunityCard } from '@/components/client/OpportunityCard';
import { mockOpportunityCardData } from '../mocks/fixtures';
import type { Opportunity } from '@/queries/useOpportunitiesQuery';

// Mock useClientOrganization hook used by FeedbackButtons
vi.mock('@/hooks/useClientOrganization', () => ({
  useClientOrganization: () => ({ organizationId: 'test-org-123' }),
}));

// Create a wrapper with QueryClientProvider for testing
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Custom render function with QueryClient wrapper
const renderWithClient = (ui: React.ReactElement) => {
  return render(ui, { wrapper: createTestWrapper() });
};

describe('OpportunityCard', () => {
  const mockOpportunity: Opportunity = mockOpportunityCardData as Opportunity;

  const defaultProps = {
    opportunity: mockOpportunity,
    onSelect: vi.fn(),
    onMarkComplete: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders entity name', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('Infrastructure Bill Vote')).toBeInTheDocument();
    });

    it('renders entity type', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('legislation')).toBeInTheDocument();
    });

    it('renders opportunity score', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
    });

    it('renders status badge', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders priority badge', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      // Score 85 = high priority
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });

    it('renders opportunity type badge', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('Trending')).toBeInTheDocument();
    });

    it('renders velocity metric', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('32.5% velocity')).toBeInTheDocument();
    });

    it('renders mentions count', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('890 mentions')).toBeInTheDocument();
    });

    it('renders estimated value', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('$15,000')).toBeInTheDocument();
    });

    it('renders historical context', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(
        screen.getByText(/Similar events raised funds 3 time\(s\)/)
      ).toBeInTheDocument();
      expect(screen.getByText(/72% success rate/)).toBeInTheDocument();
    });
  });

  describe('priority levels', () => {
    it('shows "High Priority" for score >= 80', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });

    it('shows "Medium" for score 50-79', () => {
      const mediumOpp = { ...mockOpportunity, opportunity_score: 65 };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={mediumOpp} />);

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows "Low" for score < 50', () => {
      const lowOpp = { ...mockOpportunity, opportunity_score: 35 };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={lowOpp} />);

      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('status variants', () => {
    it('renders "Live" status', () => {
      const liveOpp = { ...mockOpportunity, status: 'live' as const };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={liveOpp} />);

      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('renders "Completed" status', () => {
      const completedOpp = {
        ...mockOpportunity,
        status: 'completed' as const,
        is_active: false,
      };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={completedOpp} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders "Dismissed" status', () => {
      const dismissedOpp = {
        ...mockOpportunity,
        status: 'dismissed' as const,
        is_active: false,
      };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={dismissedOpp} />);

      expect(screen.getByText('Dismissed')).toBeInTheDocument();
    });
  });

  describe('active vs inactive', () => {
    it('shows action buttons for active opportunities', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /mark as complete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss opportunity/i })).toBeInTheDocument();
    });

    it('hides action buttons for inactive opportunities', () => {
      const inactiveOpp = { ...mockOpportunity, is_active: false };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={inactiveOpp} />);

      expect(screen.queryByRole('button', { name: /mark as complete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /dismiss opportunity/i })).not.toBeInTheDocument();
    });

    it('applies reduced opacity for inactive opportunities', () => {
      const inactiveOpp = { ...mockOpportunity, is_active: false };
      renderWithClient(<OpportunityCard {...defaultProps} opportunity={inactiveOpp} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('opacity-60');
    });
  });

  describe('interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      renderWithClient(<OpportunityCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('article'));

      expect(onSelect).toHaveBeenCalledWith(mockOpportunity);
    });

    it('calls onSelect on Enter key', () => {
      const onSelect = vi.fn();
      renderWithClient(<OpportunityCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockOpportunity);
    });

    it('calls onMarkComplete when done button clicked', () => {
      const onMarkComplete = vi.fn();
      renderWithClient(<OpportunityCard {...defaultProps} onMarkComplete={onMarkComplete} />);

      const doneBtn = screen.getByRole('button', { name: /mark as complete/i });
      fireEvent.click(doneBtn);

      expect(onMarkComplete).toHaveBeenCalledWith(mockOpportunity.id);
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      renderWithClient(<OpportunityCard {...defaultProps} onDismiss={onDismiss} />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss opportunity/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalledWith(mockOpportunity.id);
    });

    it('calls onCopyMessage when copy button clicked', async () => {
      const onCopyMessage = vi.fn();
      renderWithClient(
        <OpportunityCard {...defaultProps} onCopyMessage={onCopyMessage} />
      );

      const copyBtn = screen.getByRole('button', { name: /copy suggested message/i });
      fireEvent.click(copyBtn);

      expect(onCopyMessage).toHaveBeenCalledWith(mockOpportunity);
    });

    it('stops propagation when action buttons clicked', () => {
      const onSelect = vi.fn();
      const onDismiss = vi.fn();
      renderWithClient(
        <OpportunityCard {...defaultProps} onSelect={onSelect} onDismiss={onDismiss} />
      );

      const dismissBtn = screen.getByRole('button', { name: /dismiss opportunity/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('disables complete button when isMarking', () => {
      renderWithClient(<OpportunityCard {...defaultProps} isMarking />);

      const doneBtn = screen.getByRole('button', { name: /mark as complete/i });
      expect(doneBtn).toBeDisabled();
    });

    it('disables dismiss button when isDismissing', () => {
      renderWithClient(<OpportunityCard {...defaultProps} isDismissing />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss opportunity/i });
      expect(dismissBtn).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('has article role', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('has accessible label with entity name and priority', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAccessibleName(/Infrastructure Bill Vote.*High Priority/i);
    });

    it('is focusable via tabIndex', () => {
      renderWithClient(<OpportunityCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('tabindex', '0');
    });
  });
});
