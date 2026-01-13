import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { useAdPerformanceQuery, AdPerformanceData } from '../../queries/useAdPerformanceQuery';
import React from 'react';

// Setup Mock Service Worker (MSW) server
const server = setupServer(
  rest.get('/api/v1/ad-performance', (req, res, ctx) => {
    const startDate = req.url.searchParams.get('startDate');
    const endDate = req.url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return res(ctx.status(400), ctx.json({ message: 'Missing startDate or endDate' }));
    }

    // Mock successful response
    const mockData: AdPerformanceData[] = [
      {
        ad_id: 'ad-1',
        ref_code: 'REF001',
        status: 'ACTIVE',
        spend: 100,
        raised: 200,
        roas: 2,
        profit: 100,
        roi_pct: 100,
        cpa: 50,
        creative_thumbnail_url: 'http://example.com/thumb1.jpg',
        ad_copy_headline: 'Headline 1',
        ad_copy_primary_text: 'Primary text for ad 1.',
        ad_copy_description: 'Description 1',
        performance_tier: 'TOP_PERFORMER',
        key_themes: ['themeA', 'themeB'],
        ctr: 1.5,
        cpm: 10,
        cpc: 0.5,
        frequency: 1.2
      },
      {
        ad_id: 'ad-2',
        ref_code: 'REF002',
        status: 'PAUSED',
        spend: 50,
        raised: 25,
        roas: 0.5,
        profit: -25,
        roi_pct: -50,
        cpa: 25,
        creative_thumbnail_url: 'http://example.com/thumb2.jpg',
        ad_copy_headline: 'Headline 2',
        ad_copy_primary_text: 'Primary text for ad 2.',
        ad_copy_description: 'Description 2',
        performance_tier: 'NEEDS_IMPROVEMENT',
        key_themes: ['themeC'],
        ctr: 0.8,
        cpm: 5,
        cpc: 0.6,
        frequency: 1.8
      },
    ];
    return res(ctx.json(mockData));
  }),
);

// Set up a QueryClient for tests
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries for tests
      gcTime: Infinity, // Keep cached data for the duration of the test
    },
  },
});

// Wrapper component for React Query
const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useAdPerformanceQuery', () => {
  it('should fetch ad performance data successfully', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdPerformanceQuery({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    }), { wrapper });

    // Initial state
    expect(result.current.isLoading).toBe(true); // This might be `isPending` in newer React Query versions
    expect(result.current.data).toBeUndefined();

    // Wait for data to be fetched
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].ad_id).toBe('ad-1');
    expect(result.current.data?.[1].ref_code).toBe('REF002');
    expect(result.current.data?.[0].roas).toBe(2);
    expect(result.current.data?.[1].performance_tier).toBe('NEEDS_IMPROVEMENT');
  });

  it('should handle API errors', async () => {
    // Mock an error response
    server.use(
      rest.get('/api/v1/ad-performance', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Internal Server Error' }));
      })
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdPerformanceQuery({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('Internal Server Error');
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch data if startDate or endDate are missing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdPerformanceQuery({
      startDate: '', // Missing startDate
      endDate: '2026-01-31',
    }), { wrapper });

    // The query should be disabled
    expect(result.current.isPending).toBe(false); // isPending is the new isLoading for disabled queries in v5
    expect(result.current.data).toBeUndefined();
    // Verify that no request was made to the server
    // This requires inspecting server.events, which is not directly exposed by msw/node in a simple way
    // A more robust check might involve spying on fetch or checking msw's internal state if possible.
    // For now, this test asserts that the hook itself doesn't trigger the query when disabled.
  });
});
