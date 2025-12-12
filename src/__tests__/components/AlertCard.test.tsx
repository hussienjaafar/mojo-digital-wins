import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertCard } from '@/components/client/AlertCard';
import { mockAlertCardData } from '../mocks/fixtures';
import type { ClientAlert } from '@/queries/useClientAlertsQuery';

describe('AlertCard', () => {
  const mockAlert: ClientAlert = mockAlertCardData as ClientAlert;

  const defaultProps = {
    alert: mockAlert,
    onSelect: vi.fn(),
    onMarkRead: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders entity name', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('Climate Action Bill')).toBeInTheDocument();
    });

    it('renders severity badge', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('renders alert type badge', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('Velocity Spike')).toBeInTheDocument();
    });

    it('renders metrics row with mentions', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('1250 mentions')).toBeInTheDocument();
    });

    it('renders velocity when available', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('45.2/hr')).toBeInTheDocument();
    });

    it('renders suggested action preview', () => {
      render(<AlertCard {...defaultProps} />);

      expect(
        screen.getByText(/Consider issuing a public statement/)
      ).toBeInTheDocument();
    });

    it('renders actionable score', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
    });

    it('shows "New" badge for unread alerts', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('shows "Actionable" badge when is_actionable', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('Actionable')).toBeInTheDocument();
    });
  });

  describe('read state', () => {
    it('does not show "New" badge for read alerts', () => {
      const readAlert = { ...mockAlert, is_read: true };
      render(<AlertCard {...defaultProps} alert={readAlert} />);

      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('does not show "Mark read" button for already read alerts', () => {
      const readAlert = { ...mockAlert, is_read: true };
      render(<AlertCard {...defaultProps} alert={readAlert} />);

      expect(
        screen.queryByRole('button', { name: /mark.*read/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('severity variants', () => {
    it('renders high severity styling', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('renders medium severity styling', () => {
      const mediumAlert = { ...mockAlert, severity: 'medium' as const };
      render(<AlertCard {...defaultProps} alert={mediumAlert} />);

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders low severity styling', () => {
      const lowAlert = { ...mockAlert, severity: 'low' as const };
      render(<AlertCard {...defaultProps} alert={lowAlert} />);

      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(<AlertCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('article'));

      expect(onSelect).toHaveBeenCalledWith(mockAlert);
    });

    it('calls onSelect on Enter key', () => {
      const onSelect = vi.fn();
      render(<AlertCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockAlert);
    });

    it('calls onSelect on Space key', () => {
      const onSelect = vi.fn();
      render(<AlertCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByRole('article'), { key: ' ' });

      expect(onSelect).toHaveBeenCalledWith(mockAlert);
    });

    it('calls onMarkRead when mark read button clicked', () => {
      const onMarkRead = vi.fn();
      render(<AlertCard {...defaultProps} onMarkRead={onMarkRead} />);

      const markReadBtn = screen.getByRole('button', { name: /mark.*read/i });
      fireEvent.click(markReadBtn);

      expect(onMarkRead).toHaveBeenCalledWith(mockAlert.id);
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<AlertCard {...defaultProps} onDismiss={onDismiss} />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalledWith(mockAlert.id);
    });

    it('stops propagation when action buttons clicked', () => {
      const onSelect = vi.fn();
      const onDismiss = vi.fn();
      render(
        <AlertCard {...defaultProps} onSelect={onSelect} onDismiss={onDismiss} />
      );

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissBtn);

      expect(onDismiss).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('disables mark read button when isMarkingRead', () => {
      render(<AlertCard {...defaultProps} isMarkingRead />);

      const markReadBtn = screen.getByRole('button', { name: /mark.*read/i });
      expect(markReadBtn).toBeDisabled();
    });

    it('disables dismiss button when isDismissing', () => {
      render(<AlertCard {...defaultProps} isDismissing />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissBtn).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('has article role', () => {
      render(<AlertCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('has accessible label with entity name and severity', () => {
      render(<AlertCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAccessibleName(/Climate Action Bill.*Critical.*Velocity Spike/i);
    });

    it('is focusable via tabIndex', () => {
      render(<AlertCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('tabindex', '0');
    });
  });
});
