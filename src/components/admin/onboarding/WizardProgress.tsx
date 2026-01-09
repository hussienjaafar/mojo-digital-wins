import { cn } from '@/lib/utils';
import { Check, Building2, User, Plug, Eye, Bell, Rocket } from 'lucide-react';
import type { WizardStep, WizardStepConfig } from './types';

export const WIZARD_STEPS: WizardStepConfig[] = [
  { step: 1, title: 'Create Organization', description: 'Basic info & branding', icon: Building2, required: true },
  { step: 2, title: 'Organization Profile', description: 'Mission & priorities', icon: User, required: true },
  { step: 3, title: 'Team Members', description: 'Invite users', icon: User, required: false, skipLabel: 'Add later' },
  { step: 4, title: 'Integrations', description: 'Connect data sources', icon: Plug, required: false, skipLabel: 'Configure later' },
  { step: 5, title: 'Watchlists & Alerts', description: 'Configure monitoring', icon: Bell, required: false, skipLabel: 'Set up later' },
  { step: 6, title: 'Activate', description: 'Review & launch', icon: Rocket, required: true },
];

interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  onStepClick?: (step: WizardStep) => void;
  canNavigateToStep?: (step: WizardStep) => boolean;
  compact?: boolean;
}

export function WizardProgress({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
  compact = false,
}: WizardProgressProps) {
  const getStepStatus = (step: WizardStep) => {
    if (completedSteps.includes(step)) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const handleStepClick = (step: WizardStep) => {
    if (onStepClick && (!canNavigateToStep || canNavigateToStep(step))) {
      onStepClick(step);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {WIZARD_STEPS.map((stepConfig, index) => {
          const status = getStepStatus(stepConfig.step);
          const isClickable = canNavigateToStep?.(stepConfig.step) ?? false;
          
          return (
            <div key={stepConfig.step} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStepClick(stepConfig.step)}
                disabled={!isClickable}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  status === 'completed' && 'bg-green-500 text-white',
                  status === 'current' && 'bg-[hsl(var(--portal-accent-blue))] text-white ring-2 ring-[hsl(var(--portal-accent-blue))] ring-offset-2 ring-offset-[hsl(var(--portal-bg-card))]',
                  status === 'upcoming' && 'bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]',
                  isClickable && 'cursor-pointer hover:opacity-80',
                  !isClickable && 'cursor-not-allowed'
                )}
                title={stepConfig.title}
              >
                {status === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  stepConfig.step
                )}
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={cn(
                  'w-8 h-0.5 mx-1',
                  status === 'completed' ? 'bg-green-500' : 'bg-[hsl(var(--portal-border))]'
                )} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex flex-col gap-4 md:flex-row md:gap-0">
        {WIZARD_STEPS.map((stepConfig, index) => {
          const status = getStepStatus(stepConfig.step);
          const isClickable = canNavigateToStep?.(stepConfig.step) ?? false;
          const Icon = stepConfig.icon;
          
          return (
            <li key={stepConfig.step} className="flex-1 relative">
              {/* Connector line */}
              {index < WIZARD_STEPS.length - 1 && (
                <div 
                  className={cn(
                    'hidden md:block absolute top-5 left-1/2 w-full h-0.5',
                    status === 'completed' ? 'bg-green-500' : 'bg-[hsl(var(--portal-border))]'
                  )} 
                  aria-hidden="true"
                />
              )}
              
              <button
                type="button"
                onClick={() => handleStepClick(stepConfig.step)}
                disabled={!isClickable}
                className={cn(
                  'group relative flex flex-col items-center w-full',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-not-allowed'
                )}
              >
                {/* Step circle */}
                <span className={cn(
                  'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  status === 'completed' && 'bg-green-500 border-green-500 text-white',
                  status === 'current' && 'bg-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue))] text-white',
                  status === 'upcoming' && 'bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))]',
                  isClickable && status !== 'current' && 'group-hover:border-[hsl(var(--portal-accent-blue))] group-hover:text-[hsl(var(--portal-accent-blue))]'
                )}>
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </span>
                
                {/* Step label */}
                <span className="mt-2 text-center">
                  <span className={cn(
                    'block text-sm font-medium',
                    status === 'current' ? 'text-[hsl(var(--portal-text-primary))]' : 'text-[hsl(var(--portal-text-muted))]'
                  )}>
                    {stepConfig.title}
                    {!stepConfig.required && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                    )}
                  </span>
                  <span className="block text-xs text-[hsl(var(--portal-text-muted))] mt-0.5">
                    {stepConfig.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
