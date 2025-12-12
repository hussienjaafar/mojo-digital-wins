import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, RenderHookOptions, RenderHookResult } from '@testing-library/react';

/**
 * Creates a fresh QueryClient configured for testing.
 * - Disables retries to make tests faster and more predictable
 * - Sets short stale/gc times for faster test cleanup
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component that provides QueryClientProvider for testing hooks.
 */
export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Custom renderHook that wraps the hook with QueryClientProvider.
 * Returns the same result as @testing-library/react renderHook but with query client access.
 */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & { queryClient?: QueryClient }
): RenderHookResult<TResult, TProps> & { queryClient: QueryClient } {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const wrapper = createWrapper(queryClient);

  const result = renderHook(hook, {
    ...options,
    wrapper,
  });

  return {
    ...result,
    queryClient,
  };
}

/**
 * Helper to wait for a hook to finish loading.
 * Use with waitFor from @testing-library/react.
 */
export function waitForQueryToSettle() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
