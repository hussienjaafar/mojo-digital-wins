import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ClientShell } from '@/components/client/ClientShell';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock supabase client with proper async chain
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        // Immediately call with session
        callback('SIGNED_IN', {
          user: { id: 'user-123', email: 'test@example.com' },
          access_token: 'token',
        });
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'token',
          },
        },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'org-1', name: 'Test Org', logo_url: null },
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

// Mock the hooks
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: vi.fn(() => ({ isAdmin: true, isLoading: false })),
}));

vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({
    impersonatedOrgId: null,
    impersonatedUserId: null,
    impersonatedUserName: null,
    impersonatedOrgName: null,
    isImpersonating: false,
    setImpersonation: vi.fn(),
    clearImpersonation: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: vi.fn(() => ({ theme: 'dark', setTheme: vi.fn() })),
}));

// Mock sidebar components to avoid complex rendering
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) => (
    <button aria-label={ariaLabel} data-testid="sidebar-trigger">Toggle</button>
  ),
}));

vi.mock('@/components/client/AppSidebar', () => ({
  AppSidebar: () => <nav data-testid="app-sidebar" role="navigation">Sidebar</nav>,
}));

vi.mock('@/components/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}));

vi.mock('@/components/accessibility/SkipNavigation', () => ({
  SkipNavigation: () => <a href="#main-content" data-testid="skip-nav">Skip to main content</a>,
}));

vi.mock('@/components/client/OrganizationSelector', () => ({
  OrganizationSelector: () => <div data-testid="org-selector" />,
}));

vi.mock('@/components/v3', () => ({
  V3DateRangePicker: () => <div data-testid="date-picker" />,
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    img: ({ children, ...props }: React.HTMLAttributes<HTMLImageElement>) => <img {...props} />,
    button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ClientShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('date controls', () => {
    it('hides date picker when showDateControls is false', async () => {
      render(
        <TestWrapper>
          <ClientShell showDateControls={false}>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      // Date picker should not be in the document
      expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
    });
  });

  describe('admin features', () => {
    it('shows Back to Admin button when impersonating', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
      });
    });
  });

  describe('theme toggle', () => {
    it('renders theme toggle button', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeInTheDocument();
      });
    });
  });

  describe('logout', () => {
    it('renders logout button', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has banner role for header', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('banner')).toBeInTheDocument();
      });
    });

    it('has main role for content area', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('id', 'main-content');
      });
    });

    it('sidebar trigger has accessible label', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: 'org-123',
        impersonatedUserId: 'user-123',
        impersonatedUserName: 'Test User',
        impersonatedOrgName: 'Test Org',
        isImpersonating: true,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /toggle navigation/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('loading state accessibility (WCAG compliance)', () => {
    it('has main landmark during loading state', async () => {
      // Reset to default mock to keep loading state (organization not loaded)
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: null,
        impersonatedUserId: null,
        impersonatedUserName: null,
        impersonatedOrgName: null,
        isImpersonating: false,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      // Loading state should have main landmark
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('has h1 heading during loading state', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: null,
        impersonatedUserId: null,
        impersonatedUserName: null,
        impersonatedOrgName: null,
        isImpersonating: false,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      // Loading state should have h1 (visually hidden but accessible)
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('sr-only');
    });

    it('uses pageTitle in loading state h1 when provided', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: null,
        impersonatedUserId: null,
        impersonatedUserName: null,
        impersonatedOrgName: null,
        isImpersonating: false,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell pageTitle="Alerts Dashboard">
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Alerts Dashboard');
    });

    it('uses fallback text in loading state h1 when pageTitle not provided', async () => {
      const { useImpersonation } = await import('@/contexts/ImpersonationContext');
      vi.mocked(useImpersonation).mockReturnValue({
        impersonatedOrgId: null,
        impersonatedUserId: null,
        impersonatedUserName: null,
        impersonatedOrgName: null,
        isImpersonating: false,
        setImpersonation: vi.fn(),
        clearImpersonation: vi.fn(),
      });

      render(
        <TestWrapper>
          <ClientShell>
            <div>Content</div>
          </ClientShell>
        </TestWrapper>
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Loading dashboard');
    });
  });
});
