/**
 * Authentication Test Utilities and Mocks
 *
 * This module provides comprehensive utilities for testing authentication flows
 * including mock Supabase auth methods, session helpers, and user factories.
 */

import { vi } from 'vitest';
import type { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface MockUser {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
  role?: string;
  aud: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities?: any[];
  factors?: any[];
  is_anonymous?: boolean;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: 'bearer';
  user: MockUser;
}

export interface MockInvitation {
  id: string;
  email: string;
  invitation_type: 'platform_admin' | 'client_user';
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  token?: string;
}

export interface MockClientUser {
  id: string;
  organization_id: string;
  role: string;
  email: string;
  full_name: string;
  last_login_at: string | null;
  created_at: string;
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock user with customizable properties
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const defaultUser: MockUser = {
    id: 'user-test-123',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: null,
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updated_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
  };

  return { ...defaultUser, ...overrides };
}

/**
 * Create a mock session with customizable properties
 */
export function createMockSession(
  userOverrides: Partial<MockUser> = {},
  sessionOverrides: Partial<MockSession> = {}
): MockSession {
  const user = createMockUser(userOverrides);
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600; // 1 hour

  const defaultSession: MockSession = {
    access_token: 'mock-access-token-' + Math.random().toString(36).substr(2, 9),
    refresh_token: 'mock-refresh-token-' + Math.random().toString(36).substr(2, 9),
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    token_type: 'bearer',
    user,
  };

  return { ...defaultSession, ...sessionOverrides, user };
}

/**
 * Create a mock session that is about to expire (for testing refresh flows)
 */
export function createExpiringSession(minutesUntilExpiry: number = 5): MockSession {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = minutesUntilExpiry * 60;

  return createMockSession({}, {
    expires_in: expiresIn,
    expires_at: now + expiresIn,
  });
}

/**
 * Create an expired mock session
 */
export function createExpiredSession(): MockSession {
  const now = Math.floor(Date.now() / 1000);

  return createMockSession({}, {
    expires_in: 0,
    expires_at: now - 3600, // Expired 1 hour ago
  });
}

/**
 * Create a mock invitation
 */
export function createMockInvitation(overrides: Partial<MockInvitation> = {}): MockInvitation {
  const defaultInvitation: MockInvitation = {
    id: 'inv-test-123',
    email: 'invited@example.com',
    invitation_type: 'client_user',
    organization_id: 'org-test-123',
    organization_name: 'Test Organization',
    role: 'member',
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    token: 'test-invitation-token-123',
  };

  return { ...defaultInvitation, ...overrides };
}

/**
 * Create an expired invitation
 */
export function createExpiredInvitation(): MockInvitation {
  return createMockInvitation({
    status: 'pending',
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  });
}

/**
 * Create an accepted invitation
 */
export function createAcceptedInvitation(): MockInvitation {
  return createMockInvitation({
    status: 'accepted',
  });
}

/**
 * Create a revoked invitation
 */
export function createRevokedInvitation(): MockInvitation {
  return createMockInvitation({
    status: 'revoked',
  });
}

/**
 * Create a platform admin invitation
 */
export function createAdminInvitation(): MockInvitation {
  return createMockInvitation({
    invitation_type: 'platform_admin',
    organization_id: null,
    organization_name: null,
    role: null,
  });
}

/**
 * Create a mock client user
 */
export function createMockClientUser(overrides: Partial<MockClientUser> = {}): MockClientUser {
  const defaultClientUser: MockClientUser = {
    id: 'user-test-123',
    organization_id: 'org-test-123',
    role: 'member',
    email: 'test@example.com',
    full_name: 'Test User',
    last_login_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  };

  return { ...defaultClientUser, ...overrides };
}

// ============================================================================
// Mock Auth Error Factory
// ============================================================================

export function createAuthError(
  message: string,
  status: number = 400,
  code?: string
): AuthError {
  const error = new Error(message) as AuthError;
  error.name = 'AuthError';
  error.status = status;
  if (code) {
    (error as any).code = code;
  }
  return error;
}

// ============================================================================
// Supabase Auth Mock Factory
// ============================================================================

type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

export interface MockSupabaseAuth {
  getSession: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
  _triggerAuthChange: (event: AuthChangeEvent, session: Session | null) => void;
  _callbacks: Set<AuthStateChangeCallback>;
}

/**
 * Create a mock Supabase auth object with all common methods
 */
export function createMockSupabaseAuth(initialSession: MockSession | null = null): MockSupabaseAuth {
  const callbacks = new Set<AuthStateChangeCallback>();
  let currentSession = initialSession;

  const triggerAuthChange = (event: AuthChangeEvent, session: Session | null) => {
    currentSession = session as MockSession | null;
    callbacks.forEach((cb) => cb(event, session));
  };

  return {
    getSession: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: { session: currentSession },
        error: null,
      })
    ),

    getUser: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: { user: currentSession?.user ?? null },
        error: null,
      })
    ),

    signInWithPassword: vi.fn().mockImplementation(({ email, password }) => {
      // Default success behavior - can be overridden in tests
      const session = createMockSession({ email });
      currentSession = session;
      triggerAuthChange('SIGNED_IN', session as Session);
      return Promise.resolve({
        data: { user: session.user, session },
        error: null,
      });
    }),

    signUp: vi.fn().mockImplementation(({ email, password }) => {
      const session = createMockSession({ email });
      return Promise.resolve({
        data: { user: session.user, session },
        error: null,
      });
    }),

    signOut: vi.fn().mockImplementation(() => {
      currentSession = null;
      triggerAuthChange('SIGNED_OUT', null);
      return Promise.resolve({ error: null });
    }),

    setSession: vi.fn().mockImplementation(({ access_token, refresh_token }) => {
      const session = createMockSession({}, { access_token, refresh_token });
      currentSession = session;
      triggerAuthChange('TOKEN_REFRESHED', session as Session);
      return Promise.resolve({
        data: { user: session.user, session },
        error: null,
      });
    }),

    refreshSession: vi.fn().mockImplementation(() => {
      if (currentSession) {
        const newSession = createMockSession(currentSession.user);
        currentSession = newSession;
        triggerAuthChange('TOKEN_REFRESHED', newSession as Session);
        return Promise.resolve({
          data: { user: newSession.user, session: newSession },
          error: null,
        });
      }
      return Promise.resolve({
        data: { user: null, session: null },
        error: createAuthError('No session to refresh', 401),
      });
    }),

    onAuthStateChange: vi.fn().mockImplementation((callback: AuthStateChangeCallback) => {
      callbacks.add(callback);
      // Immediately call with current session state
      if (currentSession) {
        callback('INITIAL_SESSION', currentSession as Session);
      }
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn().mockImplementation(() => {
              callbacks.delete(callback);
            }),
          },
        },
      };
    }),

    _triggerAuthChange: triggerAuthChange,
    _callbacks: callbacks,
  };
}

// ============================================================================
// Supabase Client Mock Factory
// ============================================================================

export interface MockSupabaseClient {
  auth: MockSupabaseAuth;
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Supabase client with auth and database methods
 */
export function createMockSupabaseClient(
  initialSession: MockSession | null = null
): MockSupabaseClient {
  const auth = createMockSupabaseAuth(initialSession);

  // Create chainable query builder
  const createQueryBuilder = (data: any = null, error: any = null) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn().mockResolvedValue({ data, error }),
  });

  return {
    auth,
    from: vi.fn().mockImplementation((table: string) => createQueryBuilder()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for auth state to propagate (useful after triggering auth changes)
 */
export async function waitForAuthStateChange(ms: number = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Setup mock for testing login success
 */
export function setupLoginSuccessMock(
  mockAuth: MockSupabaseAuth,
  user?: Partial<MockUser>
): MockSession {
  const session = createMockSession(user);
  mockAuth.signInWithPassword.mockResolvedValue({
    data: { user: session.user, session },
    error: null,
  });
  return session;
}

/**
 * Setup mock for testing login failure
 */
export function setupLoginFailureMock(
  mockAuth: MockSupabaseAuth,
  errorMessage: string = 'Invalid login credentials'
): void {
  mockAuth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: createAuthError(errorMessage, 400),
  });
}

/**
 * Setup mock for testing network errors
 */
export function setupNetworkErrorMock(mockAuth: MockSupabaseAuth): void {
  const networkError = new Error('Network request failed');
  networkError.name = 'NetworkError';
  mockAuth.signInWithPassword.mockRejectedValue(networkError);
  mockAuth.signOut.mockRejectedValue(networkError);
  mockAuth.getSession.mockRejectedValue(networkError);
}

/**
 * Setup mock for invitation RPC calls
 */
export function setupInvitationMock(
  mockClient: MockSupabaseClient,
  invitation: MockInvitation | null = null
): void {
  mockClient.rpc.mockImplementation((funcName: string, params: any) => {
    if (funcName === 'get_invitation_by_token') {
      if (invitation) {
        return Promise.resolve({ data: [invitation], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }
    if (funcName === 'accept_invitation') {
      return Promise.resolve({
        data: { success: true, invitation_type: invitation?.invitation_type, organization_id: invitation?.organization_id },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

// ============================================================================
// Constants for Testing
// ============================================================================

export const TEST_USER_EMAIL = 'test@example.com';
export const TEST_USER_PASSWORD = 'TestPassword123!';
export const TEST_WEAK_PASSWORD = 'weak';
export const TEST_STRONG_PASSWORD = 'StrongP@ssw0rd123!';
export const TEST_ORG_ID = 'org-test-123';
export const TEST_INVITATION_TOKEN = 'test-invitation-token-123';
