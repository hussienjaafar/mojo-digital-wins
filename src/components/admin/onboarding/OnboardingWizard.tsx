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
  
  const [organizationId, setOrganizationId] = useState<string | null>(resumeOrgId);
  const [organizationSlug, setOrganizationSlug] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  
  const {
    currentStep,
    completedSteps,
    stepData,
    isLoading,
    goToStep,
    completeStep,
    initializeOnboarding,
    loadOnboardingState,
    canNavigateToStep,
  } = useOnboardingWizard({ organizationId: organizationId || undefined });

  // Handle Step 1 completion - org created
  // IMPORTANT: initialize onboarding state BEFORE setting organizationId to avoid a race with
  // the hook's auto-load effect (which can temporarily read "no state" and reset to step 1).
  const handleStep1Complete = async (orgId: string, data: CreateOrgData) => {
    setOrganizationSlug(data.slug);
    setWebsiteUrl(data.website_url || '');

    await initializeOnboarding(orgId);
    setOrganizationId(orgId);
  };

  // Handle Step 2 completion
  const handleStep2Complete = async (data: OrgProfileData) => {
    await completeStep(2, data as unknown as Record<string, unknown>);
  };

  // Generic step complete handler for steps 3-6
  const handleStepComplete = async (step: WizardStep, data: Record<string, unknown>) => {
    await completeStep(step, data);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStep);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      <WizardProgress 
        currentStep={currentStep} 
        completedSteps={completedSteps} 
        onStepClick={goToStep}
        canNavigateToStep={canNavigateToStep}
      />

      <div className="max-w-3xl">
        {currentStep === 1 && (
          <Step1CreateOrg 
            initialData={stepData.step1 as Partial<CreateOrgData>}
            onComplete={handleStep1Complete} 
          />
        )}
        {currentStep === 2 && organizationId && (
          <Step2OrgProfile 
            organizationId={organizationId} 
            websiteUrl={websiteUrl}
            initialData={stepData.step2 as Partial<OrgProfileData>}
            onComplete={handleStep2Complete} 
            onBack={handleBack} 
          />
        )}
        {currentStep === 3 && organizationId && (
          <Step3Users 
            organizationId={organizationId} 
            stepData={stepData.step3 as Record<string, unknown> || {}} 
            onComplete={handleStepComplete} 
            onBack={handleBack} 
          />
        )}
        {currentStep === 4 && organizationId && (
          <Step4Integrations 
            organizationId={organizationId} 
            stepData={stepData.step4 as Record<string, unknown> || {}} 
            onComplete={handleStepComplete} 
            onBack={handleBack} 
          />
        )}
        {currentStep === 5 && organizationId && (
          <Step5Watchlists 
            organizationId={organizationId} 
            stepData={stepData.step5 as Record<string, unknown> || {}} 
            onComplete={handleStepComplete} 
            onBack={handleBack} 
          />
        )}
        {currentStep === 6 && organizationId && (
          <Step6Activation 
            organizationId={organizationId} 
            organizationSlug={organizationSlug} 
            stepData={stepData.step6 as Record<string, unknown> || {}} 
            onComplete={handleStepComplete} 
            onBack={handleBack} 
          />
        )}
      </div>
    </div>
  );
}
