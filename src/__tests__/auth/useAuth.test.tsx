/**
 * Unit Tests for useAuth Hook (Session Management)
 *
 * Tests session loading, refresh, auth state changes, and sign out functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as React from 'react';
import {
  createMockSupabaseClient,
  createMockSession,
  createMockUser,
  createMockClientUser,
  createAuthError,
  waitForAuthStateChange,
  MockSupabaseClient,
} from '../utils/authMocks';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mock client
let mockClient: MockSupabaseClient;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockClient;
  },
}));

// Import after mocks
const { useAuth } = await import('@/hooks/useAuth');

// Test wrapper with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockClient = createMockSupabaseClient();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Session Loading', () => {
    it('should start with loading state true', () => {
      // Setup with no session
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      expect(result.current.loading).toBe(true);
    });

    it('should load existing session on mount', async () => {
      const mockSession = createMockSession({ email: 'existing@example.com' });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.email).toBe('existing@example.com');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle no existing session', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle session loading error gracefully', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: createAuthError('Session retrieval failed', 500),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Auth State Changes', () => {
    it('should update state on SIGNED_IN event', async () => {
      const mockSession = createMockSession({ email: 'newuser@example.com' });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger auth state change
      act(() => {
        mockClient.auth._triggerAuthChange('SIGNED_IN', mockSession as any);
      });

      await waitFor(() => {
        expect(result.current.user?.email).toBe('newuser@example.com');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should update state on SIGNED_OUT event', async () => {
      const mockSession = createMockSession();

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Trigger sign out
      act(() => {
        mockClient.auth._triggerAuthChange('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.session).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should handle TOKEN_REFRESHED event', async () => {
      const initialSession = createMockSession();
      const refreshedSession = createMockSession({}, {
        access_token: 'new-refreshed-token',
      });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: initialSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Trigger token refresh
      act(() => {
        mockClient.auth._triggerAuthChange('TOKEN_REFRESHED', refreshedSession as any);
      });

      await waitFor(() => {
        expect(result.current.session?.access_token).toBe('new-refreshed-token');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should unsubscribe from auth changes on unmount', async () => {
      const unsubscribeMock = vi.fn();

      mockClient.auth.onAuthStateChange.mockReturnValue({
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { unmount } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        // Wait for initial setup
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Organizations Fetching', () => {
    it('should fetch user organizations after login', async () => {
      const mockSession = createMockSession({ id: 'user-123', email: 'test@example.com' });
      const mockOrgData = [
        {
          organization_id: 'org-1',
          role: 'admin',
          client_organizations: {
            id: 'org-1',
            name: 'Test Organization',
            logo_url: null,
          },
        },
      ];

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation((table) => {
        if (table === 'client_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockOrgData,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.organizations).toHaveLength(1);
        expect(result.current.organizations[0].name).toBe('Test Organization');
        expect(result.current.organizations[0].role).toBe('admin');
      });
    });

    it('should handle organization fetch error', async () => {
      const mockSession = createMockSession();

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.organizations).toEqual([]);
    });

    it('should clear organizations on sign out', async () => {
      const mockSession = createMockSession();
      const mockOrgData = [
        {
          organization_id: 'org-1',
          role: 'member',
          client_organizations: {
            id: 'org-1',
            name: 'Test Org',
            logo_url: null,
          },
        },
      ];

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockOrgData,
          error: null,
        }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.organizations).toHaveLength(1);
      });

      // Trigger sign out
      act(() => {
        mockClient.auth._triggerAuthChange('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.organizations).toEqual([]);
      });
    });
  });

  describe('Logout Function', () => {
    it('should call signOut and clear state', async () => {
      const mockSession = createMockSession();

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      mockClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/client-login');
    });

    it('should clear localStorage on logout', async () => {
      localStorage.setItem('selectedOrganizationId', 'org-123');
      const mockSession = createMockSession();

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      mockClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(localStorage.getItem('selectedOrganizationId')).toBeNull();
    });

    it('should handle logout error gracefully', async () => {
      const mockSession = createMockSession();

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      mockClient.auth.signOut.mockResolvedValue({
        error: createAuthError('Logout failed', 500),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Should not throw
      await act(async () => {
        await result.current.logout();
      });

      // Error handled gracefully - no navigation
    });
  });

  describe('Update Last Login', () => {
    it('should update last login timestamp', async () => {
      const mockSession = createMockSession({ id: 'user-123' });

      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const updateMock = vi.fn().mockReturnThis();
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        update: updateMock,
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      await act(async () => {
        await result.current.updateLastLogin();
      });

      expect(mockClient.from).toHaveBeenCalledWith('client_users');
    });

    it('should not update last login when no user', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateLastLogin();
      });

      // from should not be called for update when no user
      const fromCalls = mockClient.from.mock.calls.filter(
        (call) => call[0] === 'client_users'
      );
      // Only called for organizations fetch, not update
      expect(fromCalls.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid auth state changes', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Rapid fire auth changes
      const session1 = createMockSession({ email: 'user1@example.com' });
      const session2 = createMockSession({ email: 'user2@example.com' });

      act(() => {
        mockClient.auth._triggerAuthChange('SIGNED_IN', session1 as any);
        mockClient.auth._triggerAuthChange('SIGNED_OUT', null);
        mockClient.auth._triggerAuthChange('SIGNED_IN', session2 as any);
      });

      await waitFor(() => {
        // Should settle on the last state
        expect(result.current.user?.email).toBe('user2@example.com');
      });
    });

    it('should handle concurrent session checks', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      let callCount = 0;
      mockClient.auth.getSession.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? firstPromise : secondPromise;
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

      // Resolve in reverse order
      resolveSecond!({
        data: { session: createMockSession({ email: 'second@example.com' }) },
        error: null,
      });

      await waitForAuthStateChange(10);

      resolveFirst!({
        data: { session: createMockSession({ email: 'first@example.com' }) },
        error: null,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
