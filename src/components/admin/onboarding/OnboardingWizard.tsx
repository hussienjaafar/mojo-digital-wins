import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard';
import { WizardProgress } from './WizardProgress';
import { Step1CreateOrg } from './steps/Step1CreateOrg';
import { Step2OrgProfile } from './steps/Step2OrgProfile';
import { Step3Users } from './steps/Step3Users';
import { Step4Integrations } from './steps/Step4Integrations';
import { Step5Watchlists } from './steps/Step5Watchlists';
import { Step6Activation } from './steps/Step6Activation';
import { WizardStep, CreateOrgData, OrgProfileData } from './types';
import { ArrowLeft, Loader2 } from 'lucide-react';

export function OnboardingWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resumeOrgId = searchParams.get('resume');
  
  const { state, isLoading, loadOnboardingState, initializeOnboarding, completeStep } = useOnboardingWizard();

  const [organizationId, setOrganizationId] = useState<string | null>(resumeOrgId);
  const [organizationSlug, setOrganizationSlug] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [stepData, setStepData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (resumeOrgId) {
      loadOnboardingState(resumeOrgId).then((existingState) => {
        if (existingState) {
          setCurrentStep(existingState.current_step);
          setStepData(existingState.step_data || {});
        }
      });
    }
  }, [resumeOrgId, loadOnboardingState]);

  const handleStep1Complete = async (orgId: string, data: CreateOrgData) => {
    setOrganizationId(orgId);
    setOrganizationSlug(data.slug);
    await initializeOnboarding(orgId);
    setStepData(prev => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = async (data: OrgProfileData) => {
    if (!organizationId) return;
    await completeStep(organizationId, 2, data as unknown as Record<string, unknown>);
    setStepData(prev => ({ ...prev, step2: data }));
    setCurrentStep(3);
  };

  const handleStepComplete = async (step: WizardStep, data: Record<string, unknown>) => {
    if (!organizationId) return;
    await completeStep(organizationId, step, data);
    setStepData(prev => ({ ...prev, [`step${step}`]: data }));
    if (step < 6) setCurrentStep((step + 1) as WizardStep);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as WizardStep);
  };

  const handleNavigateToStep = (step: WizardStep) => {
    if (state && state.completed_steps.includes(step)) setCurrentStep(step);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedSteps = state?.completed_steps || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin?tab=clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{resumeOrgId ? 'Resume Client Setup' : 'New Client Setup'}</h1>
          <p className="text-muted-foreground">Complete all steps to fully onboard a new organization</p>
        </div>
      </div>

      <WizardProgress currentStep={currentStep} completedSteps={completedSteps} onNavigate={handleNavigateToStep} />

      <div className="max-w-3xl">
        {currentStep === 1 && (
          <Step1CreateOrg stepData={stepData.step1 as Record<string, unknown> || {}} onComplete={handleStep1Complete} />
        )}
        {currentStep === 2 && organizationId && (
          <Step2OrgProfile organizationId={organizationId} stepData={stepData.step2 as Record<string, unknown> || {}} onComplete={handleStep2Complete} onBack={handleBack} />
        )}
        {currentStep === 3 && organizationId && (
          <Step3Users organizationId={organizationId} stepData={stepData.step3 as Record<string, unknown> || {}} onComplete={handleStepComplete} onBack={handleBack} />
        )}
        {currentStep === 4 && organizationId && (
          <Step4Integrations organizationId={organizationId} stepData={stepData.step4 as Record<string, unknown> || {}} onComplete={handleStepComplete} onBack={handleBack} />
        )}
        {currentStep === 5 && organizationId && (
          <Step5Watchlists organizationId={organizationId} stepData={stepData.step5 as Record<string, unknown> || {}} onComplete={handleStepComplete} onBack={handleBack} />
        )}
        {currentStep === 6 && organizationId && (
          <Step6Activation organizationId={organizationId} organizationSlug={organizationSlug} stepData={stepData.step6 as Record<string, unknown> || {}} onComplete={handleStepComplete} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}
