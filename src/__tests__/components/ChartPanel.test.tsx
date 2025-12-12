import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarChart3 } from 'lucide-react';
import { ChartPanel } from '@/components/charts/ChartPanel';

describe('ChartPanel', () => {
  const defaultProps = {
    title: 'Test Chart',
    children: <div data-testid="chart-content">Chart Content</div>,
  };

  describe('rendering', () => {
    it('renders with required props', () => {
      render(<ChartPanel {...defaultProps} />);

      expect(screen.getByText('Test Chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });

    it('renders title and description', () => {
      render(
        <ChartPanel
          {...defaultProps}
          description="This is a test description"
        />
      );

      expect(screen.getByText('Test Chart')).toBeInTheDocument();
      expect(screen.getByText('This is a test description')).toBeInTheDocument();
    });

    it('renders with icon', () => {
      render(<ChartPanel {...defaultProps} icon={BarChart3} />);

      // Icon should be rendered (hidden from accessibility)
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
    });

    it('renders children in normal mode', () => {
      render(<ChartPanel {...defaultProps} />);

      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
      expect(screen.getByText('Chart Content')).toBeVisible();
    });

    it('renders actions slot', () => {
      render(
        <ChartPanel
          {...defaultProps}
          actions={<button data-testid="action-btn">Action</button>}
        />
      );

      expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    });

    it('renders trend indicator', () => {
      render(
        <ChartPanel
          {...defaultProps}
          trend={{ value: 12.5, isPositive: true, label: 'vs last week' }}
        />
      );

      expect(screen.getByText('+12.5%')).toBeInTheDocument();
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });

    it('renders status badge', () => {
      render(
        <ChartPanel
          {...defaultProps}
          status={{ text: 'Live', variant: 'success' }}
        />
      );

      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows skeleton loader when isLoading is true', () => {
      render(<ChartPanel {...defaultProps} isLoading />);

      // Children should not be visible
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('hides children when loading', () => {
      render(<ChartPanel {...defaultProps} isLoading />);

      expect(screen.queryByText('Chart Content')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when isEmpty is true', () => {
      render(
        <ChartPanel {...defaultProps} isEmpty emptyMessage="No data to display" />
      );

      expect(screen.getByText('No data to display')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('shows default empty message when emptyMessage not provided', () => {
      render(<ChartPanel {...defaultProps} isEmpty />);

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <ChartPanel {...defaultProps} error="Failed to load chart data" />
      );

      expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('shows error message from Error object', () => {
      const error = new Error('Network error occurred');
      render(<ChartPanel {...defaultProps} error={error} />);

      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('shows retry button when onRetry is provided', () => {
      const onRetry = vi.fn();
      render(
        <ChartPanel {...defaultProps} error="Error" onRetry={onRetry} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      render(
        <ChartPanel {...defaultProps} error="Error" onRetry={onRetry} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('has alert role for error state', () => {
      render(<ChartPanel {...defaultProps} error="Error occurred" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has region role with accessible name', () => {
      render(<ChartPanel {...defaultProps} />);

      const region = screen.getByRole('region');
      expect(region).toHaveAccessibleName('Test Chart');
    });

    it('has accessible description when provided', () => {
      render(
        <ChartPanel {...defaultProps} description="Chart description" />
      );

      const region = screen.getByRole('region');
      expect(region).toHaveAccessibleDescription('Chart description');
    });

    it('chart area has figure role with label', () => {
      render(<ChartPanel {...defaultProps} />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAccessibleName('Test Chart chart');
    });
  });

  describe('state priority', () => {
    it('loading takes precedence over empty', () => {
      render(<ChartPanel {...defaultProps} isLoading isEmpty />);

      // Should show loading state, not empty
      expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    });

    it('error takes precedence over empty', () => {
      render(<ChartPanel {...defaultProps} error="Error" isEmpty />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    });

    it('loading takes precedence over error', () => {
      render(<ChartPanel {...defaultProps} isLoading error="Error" />);

      // Should show loading state, not error
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });
  });
});
