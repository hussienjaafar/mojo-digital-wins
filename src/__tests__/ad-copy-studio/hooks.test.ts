/**
 * Unit Tests for useAdCopyStudio Hook (Session Management)
 *
 * Tests session loading, step navigation, step completion, and data persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  createMockSupabaseClient,
  MockSupabaseClient,
} from '../utils/authMocks';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Create mock client
let mockClient: MockSupabaseClient;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockClient;
  },
}));

// Import after mocks
const { useAdCopyStudio } = await import('@/hooks/useAdCopyStudio');

// =============================================================================
// Test Data
// =============================================================================

const TEST_ORG_ID = 'org-test-123';
const TEST_USER_ID = 'user-test-456';
const TEST_SESSION_ID = 'session-test-789';
const TEST_BATCH_ID = 'batch-test-abc';

function createMockSession(overrides = {}) {
  return {
    id: TEST_SESSION_ID,
    organization_id: TEST_ORG_ID,
    user_id: TEST_USER_ID,
    current_step: 1,
    batch_id: TEST_BATCH_ID,
    video_ids: [],
    transcript_ids: [],
    step_data: {},
    completed_steps: [],
    status: 'in_progress',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('useAdCopyStudio Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockClient = createMockSupabaseClient();

    // Default mock for from() that returns chainable query builder
    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Session Management Tests
  // ===========================================================================

  describe('Session Management', () => {
    it('should load existing in-progress session', async () => {
      const existingSession = createMockSession({
        current_step: 2,
        completed_steps: [1],
        step_data: { videos: [] },
      });

      // Mock Supabase to return existing session
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have loaded the existing session
      expect(result.current.session?.id).toBe(TEST_SESSION_ID);
      expect(result.current.currentStep).toBe(2);
      expect(result.current.completedSteps).toEqual([1]);
    });

    it('should start fresh if no session exists', async () => {
      // Mock Supabase to return no session
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have default state (no session yet, but ready to create)
      expect(result.current.session).toBeNull();
      expect(result.current.currentStep).toBe(1);
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.stepData).toEqual({});
    });

    it('should handle session loading error gracefully', async () => {
      // Mock Supabase to return an error
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have error state
      expect(result.current.error).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('should not load when organizationId is missing', async () => {
      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: '', userId: TEST_USER_ID })
      );

      // When organizationId is empty, the useEffect guard prevents loading from starting
      // isLoading stays true initially because loadOrCreateSession is never called
      // However, the session should not be set and the hook should be in a safe state
      expect(result.current.session).toBeNull();
      expect(result.current.currentStep).toBe(1);
      expect(result.current.error).toBeNull();

      // Verify database was not called (this is the key assertion)
      expect(mockClient.from).not.toHaveBeenCalledWith('ad_copy_studio_sessions');
    });
  });

  // ===========================================================================
  // Step Navigation Tests
  // ===========================================================================

  describe('Step Navigation', () => {
    it('should allow navigation to step 1 always', async () => {
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Step 1 should always be navigable
      expect(result.current.canNavigateToStep(1)).toBe(true);
    });

    it('should allow navigation to completed steps', async () => {
      const existingSession = createMockSession({
        current_step: 3,
        completed_steps: [1, 2],
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Completed steps should be navigable
      expect(result.current.canNavigateToStep(1)).toBe(true);
      expect(result.current.canNavigateToStep(2)).toBe(true);
      // Current step (next after completed) should be navigable
      expect(result.current.canNavigateToStep(3)).toBe(true);
    });

    it('should prevent navigation to uncompleted future steps', async () => {
      const existingSession = createMockSession({
        current_step: 2,
        completed_steps: [1],
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Future steps (3, 4, 5) should not be navigable yet
      expect(result.current.canNavigateToStep(3)).toBe(false);
      expect(result.current.canNavigateToStep(4)).toBe(false);
      expect(result.current.canNavigateToStep(5)).toBe(false);
    });

    it('should update current step when goToStep is called', async () => {
      const existingSession = createMockSession({
        current_step: 3,
        completed_steps: [1, 2],
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Navigate back to step 1
      act(() => {
        result.current.goToStep(1);
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not navigate to invalid step', async () => {
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Try to navigate to step 5 (not allowed from step 1)
      act(() => {
        result.current.goToStep(5);
      });

      // Should stay on step 1
      expect(result.current.currentStep).toBe(1);
    });
  });

  // ===========================================================================
  // Step Completion Tests
  // ===========================================================================

  describe('Step Completion', () => {
    it('should mark step as completed and advance', async () => {
      const newSession = createMockSession();

      // Setup mocks for session creation and update
      let _insertCalled = false;
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockImplementation(() => {
          _insertCalled = true;
          return Promise.resolve({ data: newSession, error: null });
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Complete step 1
      await act(async () => {
        await result.current.completeStep(1, { videos: [] });
      });

      // Should have advanced to step 2
      expect(result.current.currentStep).toBe(2);
      // Step 1 should be marked as completed
      expect(result.current.completedSteps).toContain(1);
    });

    it('should persist step data to database', async () => {
      const existingSession = createMockSession({
        current_step: 1,
        completed_steps: [],
      });

      let updatePayload: Record<string, unknown> | null = null;
      const updateMock = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ad_copy_studio_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: updateMock,
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingSession,
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: existingSession,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.session).not.toBeNull();
      });

      // Complete step 1 with video data
      const testVideoData = { videos: [{ id: 'video-1', filename: 'test.mp4' }] };
      await act(async () => {
        await result.current.completeStep(1, testVideoData);
      });

      // Verify update was called with correct data
      expect(updateMock).toHaveBeenCalled();
      expect(updatePayload).toMatchObject({
        current_step: 2,
        completed_steps: [1],
        step_data: testVideoData,
      });
    });

    it('should handle completion error with rollback', async () => {
      const existingSession = createMockSession({
        current_step: 1,
        completed_steps: [],
      });

      const updateMock = vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }));

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Try to complete step 1
      await act(async () => {
        await result.current.completeStep(1);
      });

      // Should rollback to previous state on error
      expect(result.current.currentStep).toBe(1);
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.error).toBeTruthy();
    });

    it('should mark wizard as completed when all steps are done', async () => {
      const existingSession = createMockSession({
        current_step: 5,
        completed_steps: [1, 2, 3, 4],
      });

      let updatePayload: Record<string, unknown> | null = null;
      const updateMock = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Complete final step
      await act(async () => {
        await result.current.completeStep(5);
      });

      // Verify session status is set to completed
      expect(updatePayload).toMatchObject({
        status: 'completed',
        completed_steps: [1, 2, 3, 4, 5],
      });
    });
  });

  // ===========================================================================
  // Data Persistence Tests
  // ===========================================================================

  describe('Data Persistence', () => {
    it('should updateStepData and save to database', async () => {
      const existingSession = createMockSession({
        current_step: 2,
        completed_steps: [1],
        step_data: { videos: [] },
      });

      let updatePayload: Record<string, unknown> | null = null;
      const updateMock = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update step data
      const newData = { config: { actblue_form_name: 'Test Form' } };
      await act(async () => {
        await result.current.updateStepData(newData);
      });

      // Verify update was called
      expect(updateMock).toHaveBeenCalled();
      expect(updatePayload.step_data).toMatchObject({
        videos: [],
        config: { actblue_form_name: 'Test Form' },
      });
    });

    it('should store step data locally when no session exists yet', async () => {
      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update step data without session
      const newData = { videos: [{ id: 'v1' }] };
      await act(async () => {
        await result.current.updateStepData(newData);
      });

      // Should update local state without database call
      expect(result.current.stepData).toMatchObject(newData);
    });

    it('should return correct progress percentage', async () => {
      const existingSession = createMockSession({
        current_step: 3,
        completed_steps: [1, 2],
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 2 out of 5 steps completed = 40%
      expect(result.current.getProgressPercentage()).toBe(40);
    });

    it('should correctly report step completion status', async () => {
      const existingSession = createMockSession({
        current_step: 3,
        completed_steps: [1, 2],
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isStepCompleted(1)).toBe(true);
      expect(result.current.isStepCompleted(2)).toBe(true);
      expect(result.current.isStepCompleted(3)).toBe(false);
      expect(result.current.isStepCompleted(4)).toBe(false);
      expect(result.current.isStepCompleted(5)).toBe(false);
    });
  });

  // ===========================================================================
  // Reset Session Tests
  // ===========================================================================

  describe('Reset Session', () => {
    it('should reset session and mark as abandoned', async () => {
      const existingSession = createMockSession({
        current_step: 3,
        completed_steps: [1, 2],
      });

      let updatePayload: Record<string, unknown> | null = null;
      const updateMock = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: updateMock,
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingSession,
          error: null,
        }),
      }));

      const { result } = renderHook(() =>
        useAdCopyStudio({ organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Reset session
      await act(async () => {
        await result.current.resetSession();
      });

      // Verify update was called with abandoned status
      expect(updatePayload).toMatchObject({
        status: 'abandoned',
      });

      // Local state should be reset
      expect(result.current.session).toBeNull();
      expect(result.current.currentStep).toBe(1);
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.stepData).toEqual({});
    });
  });
});
