/**
 * Test Utilities for Edge Functions
 *
 * Provides mock objects and helper functions for testing Supabase Edge Functions.
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Creates a mock Request object for testing
 */
export function createMockRequest(
  options: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
    authToken?: string;
  } = {}
): Request {
  const {
    method = 'POST',
    url = 'http://localhost/test',
    body,
    headers = {},
    authToken,
  } = options;

  const requestHeaders = new Headers(headers);

  if (authToken) {
    requestHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  if (!requestHeaders.has('Content-Type') && body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (!requestHeaders.has('Origin')) {
    requestHeaders.set('Origin', 'http://localhost:3000');
  }

  return new Request(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Creates mock environment variables for testing
 */
export function setupMockEnv(vars: Record<string, string>): () => void {
  const originalValues: Record<string, string | undefined> = {};

  // Store original values and set mocks
  for (const [key, value] of Object.entries(vars)) {
    originalValues[key] = Deno.env.get(key);
    Deno.env.set(key, value);
  }

  // Return cleanup function
  return () => {
    for (const [key, originalValue] of Object.entries(originalValues)) {
      if (originalValue === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, originalValue);
      }
    }
  };
}

/**
 * Parses a Response and returns the JSON body
 */
export async function parseResponse<T>(response: Response): Promise<{
  status: number;
  data: T;
  headers: Headers;
}> {
  const text = await response.text();
  let data: T;

  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text as unknown as T;
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * Asserts that a response has the expected status code
 */
export function assertStatus(response: Response, expectedStatus: number): void {
  assertEquals(
    response.status,
    expectedStatus,
    `Expected status ${expectedStatus} but got ${response.status}`
  );
}

/**
 * Asserts that a response contains CORS headers
 */
export function assertCorsHeaders(response: Response): void {
  assertExists(
    response.headers.get('Access-Control-Allow-Origin'),
    'Response should have CORS origin header'
  );
  assertExists(
    response.headers.get('Access-Control-Allow-Methods'),
    'Response should have CORS methods header'
  );
}

/**
 * Asserts that a response is a JSON error with specific message
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedMessage?: string
): Promise<void> {
  assertStatus(response, expectedStatus);

  const body = await response.json();
  assertExists(body.error, 'Error response should have error field');

  if (expectedMessage) {
    assertStringIncludes(
      body.error.toLowerCase(),
      expectedMessage.toLowerCase(),
      `Error message should contain "${expectedMessage}"`
    );
  }
}

/**
 * Creates a mock Supabase client for testing
 */
export function createMockSupabaseClient(overrides: Partial<MockSupabaseClient> = {}): MockSupabaseClient {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'mock-id' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      admin: {
        getUserById: () => Promise.resolve({ data: { user: null }, error: null }),
        deleteUser: () => Promise.resolve({ error: null }),
      },
    },
    ...overrides,
  };
}

interface MockSupabaseClient {
  from: (table: string) => unknown;
  auth: {
    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
    admin: {
      getUserById: () => Promise<{ data: { user: unknown }; error: unknown }>;
      deleteUser: () => Promise<{ error: unknown }>;
    };
  };
}

/**
 * Helper to run async tests with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Test timed out'
): Promise<T> {
  let timeoutId: number;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Generates a mock JWT token for testing (NOT for production use)
 */
export function generateMockJwt(payload: {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: payload.exp || now + 3600,
    aud: 'authenticated',
    role: payload.role || 'authenticated',
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

  // Note: This is NOT a valid signature, only for testing structure
  return `${encode(header)}.${encode(fullPayload)}.mock-signature`;
}

/**
 * Waits for a specified duration (for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
