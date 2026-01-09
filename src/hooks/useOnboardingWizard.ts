import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { 
  OnboardingState, 
  OnboardingSummary, 
  WizardStep,
  OnboardingStatus 
} from '@/components/admin/onboarding/types';

interface UseOnboardingWizardOptions {
  organizationId?: string;
}

interface UseOnboardingWizardReturn {
  // State
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  status: OnboardingStatus;
  stepData: Record<string, unknown>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  goToStep: (step: WizardStep) => void;
  completeStep: (step: WizardStep, data?: Record<string, unknown>) => Promise<boolean>;
  updateStepData: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  initializeOnboarding: (orgId: string) => Promise<void>;
  loadOnboardingState: (orgId: string) => Promise<void>;
  
  // Helpers
  isStepCompleted: (step: WizardStep) => boolean;
  canNavigateToStep: (step: WizardStep) => boolean;
  getProgressPercentage: () => number;
}

export function useOnboardingWizard(
  options: UseOnboardingWizardOptions = {}
): UseOnboardingWizardReturn {
  const { organizationId } = options;
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [status, setStatus] = useState<OnboardingStatus>('not_started');
  const [stepData, setStepData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);

  // Internal helper: create (or re-create) onboarding state if it doesn't exist yet.
  // This makes the wizard resilient to partial failures (e.g. org created but state insert failed).
  const upsertOnboardingState = useCallback(async (params: {
    orgId: string;
    userId: string | null | undefined;
    current_step: WizardStep;
    completed_steps: WizardStep[];
    step_data: Record<string, unknown>;
    status: OnboardingStatus;
  }) => {
    const { data, error } = await (supabase as any)
      .from('org_onboarding_state')
      .upsert({
        organization_id: params.orgId,
        current_step: params.current_step,
        completed_steps: params.completed_steps,
        step_data: params.step_data,
        status: params.status,
        created_by: params.userId,
        last_updated_by: params.userId,
      }, {
        onConflict: 'organization_id',
      })
      .select('id, current_step, completed_steps, status, step_data')
      .single();

    if (error) throw error;
    return data as {
      id: string;
      current_step: number;
      completed_steps: WizardStep[];
      status: OnboardingStatus;
      step_data: Record<string, unknown>;
    };
  }, []);

  // Load existing onboarding state
  const loadOnboardingState = useCallback(async (orgId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('org_onboarding_state')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setStateId(data.id);
        setCurrentStep(data.current_step as WizardStep);
        setCompletedSteps(data.completed_steps || []);
        setStatus(data.status as OnboardingStatus);
        setStepData(data.step_data || {});
        return;
      }

      // No existing state.
      // IMPORTANT: if an orgId is present, Step 1 is implicitly complete (the org exists).
      // We attempt to (re)create the onboarding state record, but we never reset the UI to step 1.
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;

        const record = await upsertOnboardingState({
          orgId,
          userId,
          current_step: 2,
          completed_steps: [1],
          step_data: {},
          status: 'in_progress',
        });

        setStateId(record.id);
        setCurrentStep(record.current_step as WizardStep);
        setCompletedSteps((record.completed_steps || [1]) as WizardStep[]);
        setStatus(record.status as OnboardingStatus);
        setStepData(record.step_data || {});
      } catch (err: any) {
        // If persistence isn't available (e.g. permissions), keep the wizard moving in the UI.
        setStateId(null);
        setCurrentStep(2);
        setCompletedSteps([1]);
        setStatus('in_progress');
        setStepData({});

        toast({
          title: 'Onboarding state unavailable',
          description: err?.message || 'Could not load/create onboarding progress. You can continue, but progress may not be saved.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load onboarding state');
      toast({
        title: 'Error',
        description: 'Failed to load onboarding progress',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, upsertOnboardingState]);

  // Initialize onboarding for a new org - marks step 1 as complete and advances to step 2
  // IMPORTANT: we optimistically advance the UI even if persistence fails, so admins never get stuck.
  const initializeOnboarding = useCallback(async (orgId: string) => {
    setIsSaving(true);
    setError(null);

    // Optimistic UI: step 1 is already done once the org exists
    setCurrentStep(2);
    setCompletedSteps([1]);
    setStatus('in_progress');
    setStepData({});

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const record = await upsertOnboardingState({
        orgId,
        userId,
        current_step: 2,
        completed_steps: [1],
        step_data: {},
        status: 'in_progress',
      });

      setStateId(record.id);

      // Log the action (non-blocking)
      await supabase.rpc('log_onboarding_action', {
        _organization_id: orgId,
        _action_type: 'started',
        _step: 1,
        _details: { initialized: true, step1_completed: true },
      });
    } catch (err: any) {
      const message = err?.message || 'Failed to initialize onboarding';
      setError(message);
      toast({
        title: 'Onboarding state not saved',
        description: message,
        variant: 'destructive',
      });
      // NOTE: we intentionally do NOT revert the optimistic UI.
    } finally {
      setIsSaving(false);
    }
  }, [toast, upsertOnboardingState]);

  // Complete a step
  const completeStep = useCallback(async (
    step: WizardStep,
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!organizationId) return false;

    setIsSaving(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // Ensure we have a state record to update.
      // If we can't create/update it (permissions/etc.), we still advance the UI so admins aren't blocked.
      let ensuredStateId: string | null = stateId;
      if (!ensuredStateId) {
        try {
          const record = await upsertOnboardingState({
            orgId: organizationId,
            userId,
            current_step: currentStep,
            completed_steps: completedSteps.length ? completedSteps : [1],
            step_data: stepData,
            status: status === 'completed' ? 'completed' : 'in_progress',
          });
          ensuredStateId = record.id;
          setStateId(record.id);
        } catch (err: any) {
          ensuredStateId = null;
          toast({
            title: 'Progress not saved',
            description: err?.message || 'Could not create onboarding state. You can continue, but progress may not be saved.',
            variant: 'destructive',
          });
        }
      }

      const newCompletedSteps = [...new Set([...completedSteps, step])].sort() as WizardStep[];
      const nextStep = Math.min(step + 1, 6) as WizardStep;
      const isComplete = newCompletedSteps.length === 6;

      const newStepData = data
        ? { ...stepData, [`step${step}`]: data }
        : stepData;

      if (ensuredStateId) {
        const { error: updateError } = await (supabase as any)
          .from('org_onboarding_state')
          .update({
            current_step: nextStep,
            completed_steps: newCompletedSteps,
            step_data: newStepData,
            status: isComplete ? 'completed' : 'in_progress',
            last_updated_by: userId,
          })
          .eq('id', ensuredStateId);

        if (updateError) throw updateError;

        // Log the action (best-effort)
        await supabase.rpc('log_onboarding_action', {
          _organization_id: organizationId,
          _action_type: 'step_completed',
          _step: step,
          _details: data ? JSON.parse(JSON.stringify(data)) : null,
        });
      }

      // Always advance UI
      setCompletedSteps(newCompletedSteps);
      setCurrentStep(nextStep);
      setStepData(newStepData);
      setStatus(isComplete ? 'completed' : 'in_progress');

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to complete step');
      toast({
        title: 'Error',
        description: 'Failed to save progress',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, stateId, currentStep, completedSteps, stepData, status, toast, upsertOnboardingState]);

  // Update step data without completing
  const updateStepData = useCallback(async (
    step: WizardStep, 
    data: Record<string, unknown>
  ) => {
    if (!stateId) return;
    
    const newStepData = { ...stepData, [`step${step}`]: data };
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      await (supabase as any)
        .from('org_onboarding_state')
        .update({
          step_data: newStepData,
          last_updated_by: userId,
        })
        .eq('id', stateId);
      
      setStepData(newStepData);
    } catch (err) {
      console.error('Failed to save step data:', err);
    }
  }, [stateId, stepData]);

  // Navigation
  const goToStep = useCallback((step: WizardStep) => {
    // Mirror canNavigateToStep logic here to avoid referencing it before declaration.
    if (step === 1 || completedSteps.includes(step)) {
      setCurrentStep(step);
      return;
    }

    const maxCompleted = Math.max(0, ...completedSteps);
    if (step <= maxCompleted + 1) {
      setCurrentStep(step);
    }
  }, [completedSteps]);

  // Helpers
  const isStepCompleted = useCallback((step: WizardStep) => {
    return completedSteps.includes(step);
  }, [completedSteps]);

  const canNavigateToStep = useCallback((step: WizardStep) => {
    // Can always go to step 1 or any completed step
    if (step === 1 || completedSteps.includes(step)) return true;
    // Can go to the next step after the last completed
    const maxCompleted = Math.max(0, ...completedSteps);
    return step <= maxCompleted + 1;
  }, [completedSteps]);

  const getProgressPercentage = useCallback(() => {
    return Math.round((completedSteps.length / 6) * 100);
  }, [completedSteps]);

  // Load state when organizationId changes
  useEffect(() => {
    if (organizationId) {
      loadOnboardingState(organizationId);
    }
  }, [organizationId, loadOnboardingState]);

  return {
    currentStep,
    completedSteps,
    status,
    stepData,
    isLoading,
    isSaving,
    error,
    goToStep,
    completeStep,
    updateStepData,
    initializeOnboarding,
    loadOnboardingState,
    isStepCompleted,
    canNavigateToStep,
    getProgressPercentage,
  };
}
