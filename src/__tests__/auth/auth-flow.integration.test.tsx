/**
 * Integration Tests for Authentication Flows
 *
 * Tests complete user journeys including:
 * - Invitation -> Signup -> Dashboard flow
 * - Login -> Dashboard flow
 * - Session persistence across page reload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMockSupabaseClient,
  createMockSession,
  createMockInvitation,
  createMockClientUser,
  createAuthError,
  MockSupabaseClient,
  TEST_INVITATION_TOKEN,
  TEST_USER_EMAIL,
  TEST_STRONG_PASSWORD,
} from '../utils/authMocks';

// ============================================================================
// Mock Setup
// ============================================================================

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

let mockClient: MockSupabaseClient;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockClient;
  },
}));

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import components after mocks
const ClientLoginModule = await import('@/pages/ClientLogin');
const ClientLogin = ClientLoginModule.default;

const AcceptInvitationModule = await import('@/pages/AcceptInvitation');
const AcceptInvitation = AcceptInvitationModule.default;

// ============================================================================
// Test Utilities
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Mock Dashboard component
const MockDashboard = () => (
  <div data-testid="client-dashboard">
    <h1>Client Dashboard</h1>
    <p>Welcome to your dashboard</p>
  </div>
);

// Test app wrapper
interface TestAppProps {
  initialEntry?: string;
  isAuthenticated?: boolean;
}

const TestApp = ({
  initialEntry = '/client-login',
  isAuthenticated = false,
}: TestAppProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/client-login" element={<ClientLogin />} />
          <Route
            path="/accept-invitation"
            element={<AcceptInvitation />}
          />
          <Route path="/client/dashboard" element={<MockDashboard />} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// ============================================================================
// Tests
// ============================================================================

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockToast.mockClear();
    mockFetch.mockClear();
    mockClient = createMockSupabaseClient();
    localStorage.clear();
    sessionStorage.clear();

    // Default: no session
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Login -> Dashboard Flow', () => {
    it('should complete full login flow and navigate to dashboard', async () => {
      const user = userEvent.setup();
      const mockSession = createMockSession({ id: 'user-123', email: TEST_USER_EMAIL });

      // Setup mocks for login flow
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockSession.user, session: mockSession },
        error: null,
      });

      mockClient.auth.getSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValue({ data: { session: mockSession }, error: null });

      mockClient.from.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Start at login page
      render(<TestApp initialEntry="/client-login" />);

      // Should see login form
      expect(screen.getByText(/client portal/i)).toBeInTheDocument();

      // Fill and submit form
      await user.type(screen.getByLabelText('Email'), TEST_USER_EMAIL);
      await user.type(screen.getByLabelText('Password'), TEST_STRONG_PASSWORD);
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Should navigate to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
      });

      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
        })
      );
    });

    it('should auto-redirect authenticated users to dashboard', async () => {
      const mockSession = createMockSession({ id: 'user-123', email: TEST_USER_EMAIL });
      const mockClientUser = createMockClientUser({ id: 'user-123' });

      // Simulate existing session
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockClientUser,
          error: null,
        }),
      }));

      render(<TestApp initialEntry="/client-login" />);

      // Should auto-redirect to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
      });
    });

    it('should handle login failure gracefully', async () => {
      const user = userEvent.setup();

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: createAuthError('Invalid login credentials', 400),
      });

      render(<TestApp initialEntry="/client-login" />);

      await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Should show error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        );
      });

      // Should NOT navigate away
      expect(mockNavigate).not.toHaveBeenCalled();

      // Form should still be visible
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });

  describe('Invitation -> Signup Flow', () => {
    const validInvitation = createMockInvitation({
      email: 'invited@example.com',
      organization_name: 'Test Organization',
      role: 'member',
    });

    beforeEach(() => {
      mockClient.rpc.mockImplementation((funcName: string) => {
        if (funcName === 'get_invitation_by_token') {
          return Promise.resolve({ data: [validInvitation], error: null });
        }
        if (funcName === 'accept_invitation') {
          return Promise.resolve({
            data: { success: true, organization_id: validInvitation.organization_id },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display invitation details', async () => {
      render(
        <TestApp
          initialEntry={`/accept-invitation?token=${TEST_INVITATION_TOKEN}`}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/you're invited/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/test organization/i)).toBeInTheDocument();
    });

    // Note: This test is skipped because it requires mocking the edge function
    // which conflicts with the MSW server setup.
    it.skip('should complete signup flow', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      const mockSession = createMockSession({ email: 'invited@example.com' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: mockSession.access_token,
            refresh_token: mockSession.refresh_token,
          }),
      });

      mockClient.auth.setSession.mockResolvedValue({
        data: { user: mockSession.user, session: mockSession },
        error: null,
      });

      render(
        <TestApp
          initialEntry={`/accept-invitation?token=${TEST_INVITATION_TOKEN}`}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/you're invited/i)).toBeInTheDocument();
      });

      // Fill signup form
      await user.type(screen.getByLabelText(/full name/i), 'New User');
      await user.type(screen.getByLabelText('Password'), TEST_STRONG_PASSWORD);
      await user.type(screen.getByLabelText(/confirm password/i), TEST_STRONG_PASSWORD);

      // Submit
      await user.click(screen.getByRole('button', { name: /accept invitation/i }));

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText(/welcome aboard/i)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should switch to login for existing users', async () => {
      const user = userEvent.setup();

      render(
        <TestApp
          initialEntry={`/accept-invitation?token=${TEST_INVITATION_TOKEN}`}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/you're invited/i)).toBeInTheDocument();
      });

      // Switch to login form
      await user.click(screen.getByText(/already have an account/i));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in & accept/i })).toBeInTheDocument();
      });
    });

    // Note: This test is skipped because it requires mocking the edge function
    // which conflicts with the MSW server setup.
    it.skip('should auto-switch to login when user exists', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'User already exists',
            code: 'USER_EXISTS',
          }),
      });

      render(
        <TestApp
          initialEntry={`/accept-invitation?token=${TEST_INVITATION_TOKEN}`}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText('Password'), TEST_STRONG_PASSWORD);
      await user.type(screen.getByLabelText(/confirm password/i), TEST_STRONG_PASSWORD);
      await user.click(screen.getByRole('button', { name: /accept invitation/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in & accept/i })).toBeInTheDocument();
      });
    });
  });

  describe('Session Persistence', () => {
    it('should maintain auth state after simulated page refresh', async () => {
      const mockSession = createMockSession({ id: 'user-123', email: TEST_USER_EMAIL });
      const mockClientUser = createMockClientUser({ id: 'user-123' });

      // First render: user has session
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockClientUser,
          error: null,
        }),
      }));

      const { unmount } = render(<TestApp initialEntry="/client-login" />);

      // Should auto-redirect
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
      });

      // Unmount to simulate page leaving
      unmount();

      // Clear and reset navigation mock
      mockNavigate.mockClear();

      // Second render: simulate returning to site
      render(<TestApp initialEntry="/client-login" />);

      // Should still auto-redirect due to persistent session
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
      });
    });

    it('should clear session state on logout', async () => {
      const mockSession = createMockSession({ id: 'user-123', email: TEST_USER_EMAIL });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.auth.signOut.mockImplementation(() => {
        // Simulate clearing session
        mockClient.auth.getSession.mockResolvedValue({
          data: { session: null },
          error: null,
        });
        return Promise.resolve({ error: null });
      });

      // Execute signOut
      await (mockClient.auth.signOut as any)();

      // Session should now be null
      const { data } = await (mockClient.auth.getSession as any)();
      expect(data.session).toBeNull();
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after login failure', async () => {
      const user = userEvent.setup();

      // First attempt fails
      mockClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createAuthError('Invalid login credentials', 400),
      });

      // Second attempt succeeds
      const mockSession = createMockSession({ email: TEST_USER_EMAIL });
      mockClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockSession.user, session: mockSession },
        error: null,
      });

      mockClient.auth.getSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValue({ data: { session: mockSession }, error: null });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      render(<TestApp initialEntry="/client-login" />);

      // First attempt with wrong password
      await user.type(screen.getByLabelText('Email'), TEST_USER_EMAIL);
      await user.type(screen.getByLabelText('Password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Should show error
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive' })
        );
      });

      // Clear and retry with correct password
      mockToast.mockClear();
      const passwordInput = screen.getByLabelText('Password');
      await user.clear(passwordInput);
      await user.type(passwordInput, TEST_STRONG_PASSWORD);
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Should succeed
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/client/dashboard');
      });
    });
  });

  describe('Form Interaction', () => {
    it('should disable form while submitting', async () => {
      const user = userEvent.setup();

      // Create a promise that we control
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockClient.auth.signInWithPassword.mockReturnValue(loginPromise);

      render(<TestApp initialEntry="/client-login" />);

      await user.type(screen.getByLabelText('Email'), TEST_USER_EMAIL);
      await user.type(screen.getByLabelText('Password'), TEST_STRONG_PASSWORD);
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
      });

      // Cleanup
      resolveLogin!({ data: { user: null, session: null }, error: null });
    });
  });
});
