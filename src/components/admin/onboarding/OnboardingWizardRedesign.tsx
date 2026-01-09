import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOnboardingWizard } from '@/hooks/useOnboardingWizard';
import { WizardStepIndicator, WIZARD_STEPS } from './WizardStepIndicator';
import { Step1CreateOrg } from './steps/Step1CreateOrg';
import { Step2OrgProfile } from './steps/Step2OrgProfile';
import { Step3Users } from './steps/Step3Users';
import { Step4Integrations } from './steps/Step4Integrations';
import { Step5Watchlists } from './steps/Step5Watchlists';
import { Step6Activation } from './steps/Step6Activation';
import { WizardStep, CreateOrgData, OrgProfileData } from './types';
import { 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  XCircle,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function OnboardingWizardRedesign() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resumeOrgId = searchParams.get('resume') || searchParams.get('org');
  
  const [organizationId, setOrganizationId] = useState<string | null>(resumeOrgId);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [blockingReason, setBlockingReason] = useState<string | null>(null);
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
    getProgressPercentage,
  } = useOnboardingWizard({ organizationId: organizationId || undefined });

  // Load organization info when we have an ID
  useEffect(() => {
    if (organizationId) {
      supabase
        .from('client_organizations')
        .select('name, slug')
        .eq('id', organizationId)
        .single()
        .then(({ data }) => {
          if (data) {
            setOrganizationName(data.name);
            setOrganizationSlug(data.slug);
          }
        });
    }
  }, [organizationId]);

  const handleStep1Complete = async (orgId: string, data: CreateOrgData) => {
    setOrganizationSlug(data.slug);
    setOrganizationName(data.name);
    setWebsiteUrl(data.website_url || '');
    await initializeOnboarding(orgId);
    setOrganizationId(orgId);
  };

  const handleStep2Complete = async (data: OrgProfileData) => {
    await completeStep(2, data as unknown as Record<string, unknown>);
  };

  const handleStepComplete = async (step: WizardStep, data: Record<string, unknown>) => {
    await completeStep(step, data);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStep);
    }
  };

  const currentStepConfig = WIZARD_STEPS.find(s => s.step === currentStep);
  const progressPercentage = getProgressPercentage?.() ?? (((currentStep - 1) / 6) * 100);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-[hsl(var(--portal-accent-blue))]/20 rounded-full blur-xl animate-pulse" />
          <div className="relative p-4 rounded-full bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--portal-accent-blue))]" />
          </div>
        </div>
        <p className="text-[hsl(var(--portal-text-secondary))] text-sm">Loading setup wizard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/admin?tab=clients')}
          className="text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Exit Setup
        </Button>
        
        {organizationId && organizationName && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <Building2 className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">{organizationName}</span>
              <span className="text-xs text-[hsl(var(--portal-text-muted))]">/{organizationSlug}</span>
            </div>
            <Badge 
              variant="outline" 
              className="border-amber-500/30 text-amber-600 bg-amber-500/5"
            >
              <Clock className="h-3 w-3 mr-1" />
              Onboarding
            </Badge>
          </div>
        )}
      </div>

      {/* Hero Section */}
      <motion.div 
        className="relative overflow-hidden rounded-2xl border border-[hsl(var(--portal-border))] bg-gradient-to-br from-[hsl(var(--portal-bg-card))] to-[hsl(var(--portal-bg-elevated))]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[hsl(var(--portal-accent-blue))]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[hsl(var(--portal-accent-purple))]/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Title + Progress */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[hsl(var(--portal-accent-purple))]" />
                  <span className="text-sm font-medium text-[hsl(var(--portal-accent-purple))]">
                    {resumeOrgId ? 'Resume Setup' : 'New Client Setup'}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                  {currentStepConfig?.title || 'Organization Setup'}
                </h1>
                <p className="text-[hsl(var(--portal-text-secondary))] max-w-lg">
                  {currentStepConfig?.description || 'Complete all steps to fully onboard your new client'}
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--portal-text-secondary))]">
                    Step {currentStep} of {WIZARD_STEPS.length}
                  </span>
                  <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                    {Math.round(progressPercentage)}% complete
                  </span>
                </div>
                <Progress 
                  value={progressPercentage} 
                  className="h-2 bg-[hsl(var(--portal-bg-tertiary))]"
                />
              </div>
            </div>

            {/* Right: Step indicators */}
            <div className="lg:w-[340px]">
              <WizardStepIndicator
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={goToStep}
                canNavigateToStep={canNavigateToStep}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Blocking reason banner */}
      <AnimatePresence>
        {blockingReason && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive" className="border-[hsl(var(--portal-error))]/30 bg-[hsl(var(--portal-error))]/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Setup is blocked: {blockingReason}</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    if (!organizationId) return;
                    await supabase
                      .from('org_onboarding_state')
                      .update({ status: 'in_progress', blocking_reason: null })
                      .eq('organization_id', organizationId);
                    setBlockingReason(null);
                    toast({ title: 'Blocker resolved', description: 'You can now continue with setup.' });
                  }}
                  className="border-[hsl(var(--portal-error))]/30 hover:bg-[hsl(var(--portal-error))]/10"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Mark Resolved
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Content */}
      <motion.div 
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="max-w-3xl"
      >
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
      </motion.div>
    </div>
  );
}
