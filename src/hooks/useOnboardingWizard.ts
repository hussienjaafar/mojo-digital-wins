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
      } else {
        // No existing state - start fresh
        setCurrentStep(1);
        setCompletedSteps([]);
        setStatus('not_started');
        setStepData({});
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
  }, [toast]);

  // Initialize onboarding for a new org - marks step 1 as complete and advances to step 2
  const initializeOnboarding = useCallback(async (orgId: string) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      // Step 1 is already complete (org was just created), so we start at step 2
      const { data, error: insertError } = await (supabase as any)
        .from('org_onboarding_state')
        .upsert({
          organization_id: orgId,
          current_step: 2,
          completed_steps: [1],
          step_data: {},
          status: 'in_progress',
          created_by: userId,
          last_updated_by: userId,
        }, {
          onConflict: 'organization_id',
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      setStateId(data.id);
      setCurrentStep(2);
      setCompletedSteps([1]);
      setStatus('in_progress');
      setStepData({});
      
      // Log the action
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
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  // Complete a step
  const completeStep = useCallback(async (
    step: WizardStep, 
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!organizationId || !stateId) return false;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      const newCompletedSteps = [...new Set([...completedSteps, step])].sort() as WizardStep[];
      const nextStep = Math.min(step + 1, 6) as WizardStep;
      const isComplete = newCompletedSteps.length === 6;
      
      const newStepData = data 
        ? { ...stepData, [`step${step}`]: data }
        : stepData;
      
      const { error: updateError } = await (supabase as any)
        .from('org_onboarding_state')
        .update({
          current_step: nextStep,
          completed_steps: newCompletedSteps,
          step_data: newStepData,
          status: isComplete ? 'completed' : 'in_progress',
          last_updated_by: userId,
        })
        .eq('id', stateId);
      
      if (updateError) throw updateError;
      
      setCompletedSteps(newCompletedSteps);
      setCurrentStep(nextStep);
      setStepData(newStepData);
      if (isComplete) setStatus('completed');
      
      // Log the action
      await supabase.rpc('log_onboarding_action', {
        _organization_id: organizationId,
        _action_type: 'step_completed',
        _step: step,
        _details: data ? JSON.parse(JSON.stringify(data)) : null,
      });
      
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
  }, [organizationId, stateId, completedSteps, stepData, toast]);

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
    if (canNavigateToStep(step)) {
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
