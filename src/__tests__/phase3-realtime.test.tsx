import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeTrends } from '@/hooks/useRealtimeTrends';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('Phase 3: Real-time Features', () => {
  let mockChannel: any;

  beforeEach(() => {
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.channel).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useRealtimeTrends', () => {
    it('should fetch initial trending topics', async () => {
      const mockTrends = [
        {
          id: '1',
          topic: 'Climate Change',
          is_trending: true,
          velocity: 85.5,
          mentions_last_hour: 200,
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockTrends, error: null }),
      } as any);

      const { result } = renderHook(() => useRealtimeTrends());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.trends).toEqual(mockTrends);
    });

    it('should subscribe to realtime updates', () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderHook(() => useRealtimeTrends());

      expect(supabase.channel).toHaveBeenCalledWith('bluesky_trends_realtime');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'bluesky_trends',
          filter: 'is_trending=eq.true',
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle INSERT events correctly', async () => {
      const mockCallback = vi.fn();
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      mockChannel.on.mockImplementation((event: string, config: any, callback: any) => {
        mockCallback.mockImplementation(callback);
        return mockChannel;
      });

      const { result } = renderHook(() => useRealtimeTrends());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newTrend = {
        id: '2',
        topic: 'AI Regulation',
        is_trending: true,
        velocity: 120,
      };

      mockCallback({ eventType: 'INSERT', new: newTrend });

      await waitFor(() => {
        expect(result.current.trends).toContainEqual(newTrend);
      });
    });
  });

  describe('useRealtimeAlerts', () => {
    it('should fetch initial alerts', async () => {
      const mockAlerts = [
        {
          id: '1',
          title: 'Critical Alert',
          message: 'Test message',
          severity: 'critical',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }),
      } as any);

      const { result } = renderHook(() => useRealtimeAlerts());

      await waitFor(() => {
        expect(result.current.alerts).toEqual(mockAlerts);
        expect(result.current.criticalCount).toBe(1);
      });
    });

    it('should subscribe to realtime alert inserts', () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      renderHook(() => useRealtimeAlerts());

      expect(supabase.channel).toHaveBeenCalledWith('alerts_realtime');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'alert_queue',
        }),
        expect.any(Function)
      );
    });

    it('should limit alerts to 20 items', async () => {
      const mockAlerts = Array.from({ length: 25 }, (_, i) => ({
        id: `${i}`,
        title: `Alert ${i}`,
        message: 'Test',
        severity: 'medium',
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockAlerts.slice(0, 20), error: null }),
      } as any);

      const { result } = renderHook(() => useRealtimeAlerts());

      await waitFor(() => {
        expect(result.current.alerts.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Realtime Performance', () => {
    it('should handle rapid updates efficiently', async () => {
      const mockCallback = vi.fn();
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      mockChannel.on.mockImplementation((event: string, config: any, callback: any) => {
        mockCallback.mockImplementation(callback);
        return mockChannel;
      });

      renderHook(() => useRealtimeTrends());

      // Simulate 100 rapid updates
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        mockCallback({
          eventType: 'INSERT',
          new: { id: `${i}`, topic: `Topic ${i}`, is_trending: true },
        });
      }
      const endTime = performance.now();

      // Should handle 100 updates in under 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network error' },
        }),
      } as any);

      const { result } = renderHook(() => useRealtimeTrends());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.trends).toEqual([]);
      });
    });
  });
});
