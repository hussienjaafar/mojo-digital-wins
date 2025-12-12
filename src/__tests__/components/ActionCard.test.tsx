import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionCard } from '@/components/client/ActionCard';
import { mockActionCardData } from '../mocks/fixtures';
import type { SuggestedAction } from '@/queries/useSuggestedActionsQuery';

describe('ActionCard', () => {
  const mockAction: SuggestedAction = mockActionCardData as SuggestedAction;

  const defaultProps = {
    action: mockAction,
    onSelect: vi.fn(),
    onCopy: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders topic/title', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('GOTV Reminder for Early Voting')).toBeInTheDocument();
    });

    it('renders urgency badge', () => {
      render(<ActionCard {...defaultProps} />);

      // 75% urgency should show "Urgent" (>= 70 is high)
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('renders action type badge', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('renders SMS preview', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('SMS Preview')).toBeInTheDocument();
      expect(
        screen.getByText(/Early voting starts tomorrow/)
      ).toBeInTheDocument();
    });

    it('renders character count', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('98/160')).toBeInTheDocument();
    });

    it('renders relevance score', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('Relevance')).toBeInTheDocument();
    });

    it('renders urgency percentage', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('Urgency: 75%')).toBeInTheDocument();
    });

    it('renders estimated impact', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('renders value proposition', () => {
      render(<ActionCard {...defaultProps} />);

      expect(
        screen.getByText(/Timely reminder expected to boost turnout/)
      ).toBeInTheDocument();
    });

    it('renders related entity context', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('Related to:')).toBeInTheDocument();
      expect(screen.getByText('Early Voting')).toBeInTheDocument();
    });

    it('shows "High Relevance" badge when score >= 70', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByText('High Relevance')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    it('renders compact variant for used actions', () => {
      const usedAction = { ...mockAction, status: 'used' as const };
      render(<ActionCard {...defaultProps} action={usedAction} variant="compact" />);

      expect(screen.getByText('Used')).toBeInTheDocument();
    });

    it('shows simplified layout in compact mode', () => {
      render(<ActionCard {...defaultProps} variant="compact" />);

      // Compact variant has less detail
      expect(screen.queryByText('SMS Preview')).not.toBeInTheDocument();
    });
  });

  describe('urgency levels', () => {
    it('shows "Urgent" for high urgency (>= 70)', () => {
      const highUrgency = { ...mockAction, urgency_score: 85 };
      render(<ActionCard {...defaultProps} action={highUrgency} />);

      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('shows "Medium" for medium urgency (40-69)', () => {
      const mediumUrgency = { ...mockAction, urgency_score: 55 };
      render(<ActionCard {...defaultProps} action={mediumUrgency} />);

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows "Low" for low urgency (< 40)', () => {
      const lowUrgency = { ...mockAction, urgency_score: 25 };
      render(<ActionCard {...defaultProps} action={lowUrgency} />);

      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(<ActionCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('article'));

      expect(onSelect).toHaveBeenCalledWith(mockAction);
    });

    it('calls onSelect on Enter key', () => {
      const onSelect = vi.fn();
      render(<ActionCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockAction);
    });

    it('calls onCopy when copy button clicked', async () => {
      const onCopy = vi.fn().mockResolvedValue(undefined);
      render(<ActionCard {...defaultProps} onCopy={onCopy} />);

      const copyBtn = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyBtn);

      expect(onCopy).toHaveBeenCalledWith(mockAction);
    });

    it('shows "Copied!" feedback after copy', async () => {
      const onCopy = vi.fn().mockResolvedValue(undefined);
      render(<ActionCard {...defaultProps} onCopy={onCopy} />);

      const copyBtn = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<ActionCard {...defaultProps} onDismiss={onDismiss} />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalledWith(mockAction.id);
    });

    it('stops propagation when action buttons clicked', () => {
      const onSelect = vi.fn();
      const onDismiss = vi.fn();
      render(
        <ActionCard {...defaultProps} onSelect={onSelect} onDismiss={onDismiss} />
      );

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('disables copy button when isCopying', () => {
      render(<ActionCard {...defaultProps} isCopying />);

      const copyBtn = screen.getByRole('button', { name: /copy/i });
      expect(copyBtn).toBeDisabled();
    });

    it('disables dismiss button when isDismissing', () => {
      render(<ActionCard {...defaultProps} isDismissing />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissBtn).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('has article role', () => {
      render(<ActionCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('has accessible label with topic and urgency', () => {
      render(<ActionCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAccessibleName(/GOTV Reminder.*Urgent/i);
    });

    it('is focusable via tabIndex', () => {
      render(<ActionCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('tabindex', '0');
    });
  });
});
