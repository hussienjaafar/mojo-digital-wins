import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Minimal Top Bar - Exit only */}
      <div className="flex-shrink-0 flex items-center justify-between pb-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/admin?tab=clients')}
          className="text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-text-primary))] -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Exit Setup
        </Button>
        
        {organizationId && organizationName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))]/50 border border-[hsl(var(--portal-border))]">
            <Building2 className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
            <span className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">{organizationName}</span>
          </div>
        )}
      </div>

      {/* Blocking reason banner */}
      <AnimatePresence>
        {blockingReason && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 mb-4"
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

      {/* Unified Onboarding Card - Single Surface */}
      <motion.div 
        className="flex-1 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] shadow-sm overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-1 min-h-0">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Integrated Step Header - Inside Card */}
            <div className="flex-shrink-0 px-8 pt-6 pb-5 border-b border-[hsl(var(--portal-border))]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] font-semibold uppercase tracking-wider bg-[hsl(var(--portal-accent-blue))]/10 text-[hsl(var(--portal-accent-blue))] border-0"
                    >
                      Step {currentStep} of {WIZARD_STEPS.length}
                    </Badge>
                    {currentStepConfig && !currentStepConfig.required && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] uppercase tracking-wider text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]"
                      >
                        Optional
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] tracking-tight">
                    {currentStepConfig?.title || 'Organization Setup'}
                  </h1>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))] max-w-lg">
                    {getStepDescription(currentStep)}
                  </p>
                </div>
                {/* Mini progress indicator */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-semibold text-[hsl(var(--portal-text-primary))]">
                    {Math.round(progressPercentage)}%
                  </div>
                  <div className="text-xs text-[hsl(var(--portal-text-muted))]">Complete</div>
                </div>
              </div>
            </div>

            {/* Scrollable Form Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-8 py-6">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
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
                        organizationName={organizationName}
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
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Sticky Progress Rail */}
          <div className="w-[240px] flex-shrink-0 border-l border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]/30 flex flex-col">
            <div className="sticky top-0 p-5 flex flex-col h-full">
              <div className="text-[10px] font-semibold text-[hsl(var(--portal-text-muted))] uppercase tracking-wider mb-4">
                Setup Progress
              </div>
              
              <div className="flex-1">
                <WizardStepIndicator
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                  onStepClick={goToStep}
                  canNavigateToStep={canNavigateToStep}
                />
              </div>

              {/* Summary footer */}
              <div className="pt-4 mt-auto border-t border-[hsl(var(--portal-border))]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(var(--portal-text-muted))]">
                    {completedSteps.length} of {WIZARD_STEPS.length} done
                  </span>
                </div>
                {/* Micro progress bar */}
                <div className="mt-2 h-1 rounded-full bg-[hsl(var(--portal-bg-tertiary))] overflow-hidden">
                  <motion.div 
                    className="h-full bg-[hsl(var(--portal-accent-blue))]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Helper function for step descriptions
function getStepDescription(step: number): string {
  switch (step) {
    case 1:
      return "Create the organization record with basic information and branding. This establishes the client's identity in the system.";
    case 2:
      return "Define the organization's mission, focus areas, and geographic scope to enable intelligent alert filtering and recommendations.";
    case 3:
      return "Invite team members who will use the platform. They'll receive secure email invitations to set up their accounts.";
    case 4:
      return "Connect data sources like Meta Ads, SMS platforms, and donation processors to enable attribution and analytics.";
    case 5:
      return "Configure entities and topics to monitor. The system will track mentions, sentiment shifts, and breaking news.";
    case 6:
      return "Review the configuration and activate the organization. Once active, data pipelines will begin processing.";
    default:
      return "Complete this step to continue setup.";
  }
}
