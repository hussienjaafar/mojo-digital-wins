import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WatchlistEntityCard } from '@/components/client/WatchlistEntityCard';
import { mockWatchlistEntityCardData } from '../mocks/fixtures';
import type { WatchlistEntity } from '@/queries/useWatchlistQuery';

describe('WatchlistEntityCard', () => {
  const mockEntity: WatchlistEntity = mockWatchlistEntityCardData as WatchlistEntity;

  const defaultProps = {
    entity: mockEntity,
    onToggleSentiment: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders entity name', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Senator Jane Doe')).toBeInTheDocument();
    });

    it('renders entity type badge', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Person')).toBeInTheDocument();
    });

    it('renders relevance score', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Score: 85%')).toBeInTheDocument();
    });

    it('renders alert threshold', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Alert threshold:')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('renders aliases when available', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Aliases:')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Sen. Doe')).toBeInTheDocument();
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    it('truncates aliases when more than 3', () => {
      const manyAliases = {
        ...mockEntity,
        aliases: ['Alias 1', 'Alias 2', 'Alias 3', 'Alias 4', 'Alias 5'],
      };
      render(<WatchlistEntityCard {...defaultProps} entity={manyAliases} />);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('does not show aliases section when empty', () => {
      const noAliases = { ...mockEntity, aliases: [] };
      render(<WatchlistEntityCard {...defaultProps} entity={noAliases} />);

      expect(screen.queryByText('Aliases:')).not.toBeInTheDocument();
    });
  });

  describe('entity types', () => {
    it('renders organization type', () => {
      const orgEntity = { ...mockEntity, entity_type: 'organization' as const };
      render(<WatchlistEntityCard {...defaultProps} entity={orgEntity} />);

      expect(screen.getByText('Organization')).toBeInTheDocument();
    });

    it('renders topic type', () => {
      const topicEntity = { ...mockEntity, entity_type: 'topic' as const };
      render(<WatchlistEntityCard {...defaultProps} entity={topicEntity} />);

      expect(screen.getByText('Topic')).toBeInTheDocument();
    });

    it('renders location type', () => {
      const locEntity = { ...mockEntity, entity_type: 'location' as const };
      render(<WatchlistEntityCard {...defaultProps} entity={locEntity} />);

      expect(screen.getByText('Location')).toBeInTheDocument();
    });

    it('renders opposition type', () => {
      const oppEntity = { ...mockEntity, entity_type: 'opposition' as const };
      render(<WatchlistEntityCard {...defaultProps} entity={oppEntity} />);

      expect(screen.getByText('Opposition')).toBeInTheDocument();
    });

    it('renders issue type', () => {
      const issueEntity = { ...mockEntity, entity_type: 'issue' as const };
      render(<WatchlistEntityCard {...defaultProps} entity={issueEntity} />);

      expect(screen.getByText('Issue')).toBeInTheDocument();
    });
  });

  describe('sentiment alerts toggle', () => {
    it('shows "Alerts On" when sentiment alerts enabled', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByText('Alerts On')).toBeInTheDocument();
    });

    it('shows "Alerts Off" when sentiment alerts disabled', () => {
      const disabledEntity = { ...mockEntity, sentiment_alerts_enabled: false };
      render(<WatchlistEntityCard {...defaultProps} entity={disabledEntity} />);

      expect(screen.getByText('Alerts Off')).toBeInTheDocument();
    });

    it('calls onToggleSentiment when toggle clicked', () => {
      const onToggleSentiment = vi.fn();
      render(
        <WatchlistEntityCard {...defaultProps} onToggleSentiment={onToggleSentiment} />
      );

      const toggleBtn = screen.getByRole('button', { name: /disable sentiment alerts/i });
      fireEvent.click(toggleBtn);

      expect(onToggleSentiment).toHaveBeenCalledWith(mockEntity.id, true);
    });

    it('calls onToggleSentiment with correct value when enabling', () => {
      const onToggleSentiment = vi.fn();
      const disabledEntity = { ...mockEntity, sentiment_alerts_enabled: false };
      render(
        <WatchlistEntityCard
          {...defaultProps}
          entity={disabledEntity}
          onToggleSentiment={onToggleSentiment}
        />
      );

      const toggleBtn = screen.getByRole('button', { name: /enable sentiment alerts/i });
      fireEvent.click(toggleBtn);

      expect(onToggleSentiment).toHaveBeenCalledWith(mockEntity.id, false);
    });
  });

  describe('delete functionality', () => {
    it('calls onDelete when delete button clicked', () => {
      const onDelete = vi.fn();
      render(<WatchlistEntityCard {...defaultProps} onDelete={onDelete} />);

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteBtn);

      expect(onDelete).toHaveBeenCalledWith(mockEntity.id);
    });
  });

  describe('loading states', () => {
    it('disables toggle button when isToggling', () => {
      render(<WatchlistEntityCard {...defaultProps} isToggling />);

      const toggleBtn = screen.getByRole('button', { name: /sentiment alerts/i });
      expect(toggleBtn).toBeDisabled();
    });

    it('disables delete button when isDeleting', () => {
      render(<WatchlistEntityCard {...defaultProps} isDeleting />);

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      expect(deleteBtn).toBeDisabled();
    });
  });

  describe('no relevance score', () => {
    it('does not show relevance score badge when 0', () => {
      const noScore = { ...mockEntity, relevance_score: 0 };
      render(<WatchlistEntityCard {...defaultProps} entity={noScore} />);

      expect(screen.queryByText('Score:')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has article role', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('has accessible label with entity name and type', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAccessibleName(/Senator Jane Doe.*Person/i);
    });

    it('delete button has accessible name with entity name', () => {
      render(<WatchlistEntityCard {...defaultProps} />);

      const deleteBtn = screen.getByRole('button', { name: /delete senator jane doe/i });
      expect(deleteBtn).toBeInTheDocument();
    });
  });
});
