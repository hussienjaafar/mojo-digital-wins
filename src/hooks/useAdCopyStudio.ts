/**
 * useAdCopyStudio - Main wizard state management hook
 *
 * Manages the multi-step Ad Copy Studio wizard:
 * - Session persistence to ad_copy_studio_sessions table
 * - Step navigation with validation
 * - Optimistic UI updates
 * - Progress tracking
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  AdCopyStudioSession,
  AdCopyStudioStep,
  SessionStepData,
  SessionStatus,
} from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface UseAdCopyStudioOptions {
  organizationId: string;
  userId: string;
}

export interface UseAdCopyStudioReturn {
  // State
  session: AdCopyStudioSession | null;
  currentStep: AdCopyStudioStep;
  completedSteps: AdCopyStudioStep[];
  stepData: SessionStepData;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  // Actions
  initializeSession: () => Promise<void>;
  goToStep: (step: AdCopyStudioStep) => void;
  completeStep: (step: AdCopyStudioStep, data?: Partial<SessionStepData>) => Promise<void>;
  updateStepData: (data: Partial<SessionStepData>) => Promise<void>;
  canNavigateToStep: (step: AdCopyStudioStep) => boolean;
  isStepCompleted: (step: AdCopyStudioStep) => boolean;
  getProgressPercentage: () => number;
  resetSession: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const TOTAL_STEPS = 5;
const STEP_ORDER: AdCopyStudioStep[] = [1, 2, 3, 4, 5];

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAdCopyStudio(
  options: UseAdCopyStudioOptions
): UseAdCopyStudioReturn {
  const { organizationId, userId } = options;
  const { toast } = useToast();

  // State
  const [session, setSession] = useState<AdCopyStudioSession | null>(null);
  const [currentStep, setCurrentStep] = useState<AdCopyStudioStep>(1);
  const [completedSteps, setCompletedSteps] = useState<AdCopyStudioStep[]>([]);
  const [stepData, setStepData] = useState<SessionStepData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track if initial load has happened
  const hasInitialized = useRef(false);

  // =========================================================================
  // Database Operations
  // =========================================================================

  /**
   * Load existing in-progress session or create a new one
   */
  const loadOrCreateSession = useCallback(async () => {
    if (!organizationId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, try to find an existing in-progress session
      const { data: existingSession, error: fetchError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingSession) {
        // Load existing session
        setSession(existingSession as AdCopyStudioSession);
        setCurrentStep(existingSession.current_step as AdCopyStudioStep);
        setCompletedSteps((existingSession.completed_steps || []) as AdCopyStudioStep[]);
        setStepData(existingSession.step_data || {});
        console.log('[useAdCopyStudio] Loaded existing session:', existingSession.id);
      } else {
        // No existing session - just set defaults, session will be created on first action
        setSession(null);
        setCurrentStep(1);
        setCompletedSteps([]);
        setStepData({});
        console.log('[useAdCopyStudio] No existing session found, ready to create new one');
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to load session';
      setError(message);
      console.error('[useAdCopyStudio] Error loading session:', err);
      toast({
        title: 'Error',
        description: 'Failed to load Ad Copy Studio session',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, userId, toast]);

  /**
   * Create a new session in the database
   */
  const createSession = useCallback(async (): Promise<AdCopyStudioSession | null> => {
    if (!organizationId || !userId) return null;

    try {
      const batchId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { data: newSession, error: insertError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          current_step: 1,
          batch_id: batchId,
          video_ids: [],
          transcript_ids: [],
          step_data: {},
          completed_steps: [],
          status: 'in_progress',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('[useAdCopyStudio] Created new session:', newSession.id);
      return newSession as AdCopyStudioSession;
    } catch (err: any) {
      console.error('[useAdCopyStudio] Error creating session:', err);
      throw err;
    }
  }, [organizationId, userId]);

  /**
   * Update session in the database
   */
  const updateSession = useCallback(async (
    sessionId: string,
    updates: Partial<AdCopyStudioSession>
  ): Promise<void> => {
    try {
      const { error: updateError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;
    } catch (err: any) {
      console.error('[useAdCopyStudio] Error updating session:', err);
      throw err;
    }
  }, []);

  // =========================================================================
  // Public Actions
  // =========================================================================

  /**
   * Initialize a new session explicitly
   */
  const initializeSession = useCallback(async () => {
    if (session) {
      console.log('[useAdCopyStudio] Session already exists');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newSession = await createSession();
      if (newSession) {
        setSession(newSession);
        setCurrentStep(1);
        setCompletedSteps([]);
        setStepData({});
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to initialize session';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, createSession, toast]);

  /**
   * Navigate to a specific step
   */
  const goToStep = useCallback((step: AdCopyStudioStep) => {
    // Validate step is reachable
    if (step === 1 || completedSteps.includes(step)) {
      setCurrentStep(step);
      return;
    }

    // Allow going to next step after last completed
    const maxCompleted = completedSteps.length > 0
      ? Math.max(...completedSteps)
      : 0;

    if (step <= maxCompleted + 1) {
      setCurrentStep(step);
    }
  }, [completedSteps]);

  /**
   * Mark a step as completed and optionally update step data
   */
  const completeStep = useCallback(async (
    step: AdCopyStudioStep,
    data?: Partial<SessionStepData>
  ): Promise<void> => {
    setIsSaving(true);
    setError(null);

    // Optimistic update
    const newCompletedSteps = [...new Set([...completedSteps, step])].sort((a, b) => a - b) as AdCopyStudioStep[];
    const nextStep = Math.min(step + 1, TOTAL_STEPS) as AdCopyStudioStep;
    const newStepData = data ? { ...stepData, ...data } : stepData;

    setCompletedSteps(newCompletedSteps);
    setCurrentStep(nextStep);
    setStepData(newStepData);

    try {
      // Ensure we have a session
      let currentSession = session;
      if (!currentSession) {
        currentSession = await createSession();
        if (!currentSession) {
          throw new Error('Failed to create session');
        }
        setSession(currentSession);
      }

      // Determine if wizard is complete
      const isComplete = newCompletedSteps.length === TOTAL_STEPS;
      const newStatus: SessionStatus = isComplete ? 'completed' : 'in_progress';

      // Persist to database
      await updateSession(currentSession.id, {
        current_step: nextStep,
        completed_steps: newCompletedSteps,
        step_data: newStepData,
        status: newStatus,
      });

      // Update local session state
      setSession({
        ...currentSession,
        current_step: nextStep,
        completed_steps: newCompletedSteps,
        step_data: newStepData,
        status: newStatus,
      });

      console.log(`[useAdCopyStudio] Completed step ${step}, moving to step ${nextStep}`);
    } catch (err: any) {
      // Revert optimistic update on error
      setCompletedSteps(completedSteps);
      setCurrentStep(step);
      setStepData(stepData);

      const message = err?.message || 'Failed to save progress';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, completedSteps, stepData, createSession, updateSession, toast]);

  /**
   * Update step data without completing the step
   */
  const updateStepData = useCallback(async (
    data: Partial<SessionStepData>
  ): Promise<void> => {
    const newStepData = { ...stepData, ...data };

    // Optimistic update
    setStepData(newStepData);

    // Only persist if we have a session
    if (!session) {
      console.log('[useAdCopyStudio] No session yet, step data stored locally');
      return;
    }

    try {
      await updateSession(session.id, {
        step_data: newStepData,
      });

      setSession({
        ...session,
        step_data: newStepData,
      });
    } catch (err: any) {
      // Revert on error
      setStepData(stepData);
      console.error('[useAdCopyStudio] Failed to save step data:', err);
    }
  }, [session, stepData, updateSession]);

  /**
   * Check if navigation to a step is allowed
   */
  const canNavigateToStep = useCallback((step: AdCopyStudioStep): boolean => {
    // Can always go to step 1 or any completed step
    if (step === 1 || completedSteps.includes(step)) return true;

    // Can go to the next step after the last completed
    const maxCompleted = completedSteps.length > 0
      ? Math.max(...completedSteps)
      : 0;

    return step <= maxCompleted + 1;
  }, [completedSteps]);

  /**
   * Check if a step is completed
   */
  const isStepCompleted = useCallback((step: AdCopyStudioStep): boolean => {
    return completedSteps.includes(step);
  }, [completedSteps]);

  /**
   * Get overall progress percentage
   */
  const getProgressPercentage = useCallback((): number => {
    return Math.round((completedSteps.length / TOTAL_STEPS) * 100);
  }, [completedSteps]);

  /**
   * Reset/abandon current session and start fresh
   */
  const resetSession = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    setError(null);

    try {
      // Mark current session as abandoned if it exists
      if (session) {
        await updateSession(session.id, {
          status: 'abandoned',
        });
      }

      // Reset local state
      setSession(null);
      setCurrentStep(1);
      setCompletedSteps([]);
      setStepData({});

      console.log('[useAdCopyStudio] Session reset');
    } catch (err: any) {
      const message = err?.message || 'Failed to reset session';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, updateSession, toast]);

  // =========================================================================
  // Effects
  // =========================================================================

  // Load session on mount or when IDs change
  useEffect(() => {
    if (organizationId && userId && !hasInitialized.current) {
      hasInitialized.current = true;
      loadOrCreateSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId]);

  // Reset initialization flag when IDs change
  useEffect(() => {
    hasInitialized.current = false;
  }, [organizationId, userId]);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // State
    session,
    currentStep,
    completedSteps,
    stepData,
    isLoading,
    isSaving,
    error,
    // Actions
    initializeSession,
    goToStep,
    completeStep,
    updateStepData,
    canNavigateToStep,
    isStepCompleted,
    getProgressPercentage,
    resetSession,
  };
}
