import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, Building2, User, Users, Plug, Bell, Rocket, LucideIcon } from 'lucide-react';
import type { WizardStep, WizardStepConfig } from './types';

export const WIZARD_STEPS: (WizardStepConfig & { icon: LucideIcon })[] = [
  { step: 1, title: 'Create Organization', description: 'Basic info & branding', icon: Building2, required: true },
  { step: 2, title: 'Organization Profile', description: 'Mission & priorities', icon: User, required: true },
  { step: 3, title: 'Team Members', description: 'Invite users', icon: Users, required: false, skipLabel: 'Add later' },
  { step: 4, title: 'Integrations', description: 'Connect data sources', icon: Plug, required: false, skipLabel: 'Configure later' },
  { step: 5, title: 'Watchlists & Alerts', description: 'Configure monitoring', icon: Bell, required: false, skipLabel: 'Set up later' },
  { step: 6, title: 'Activate', description: 'Review & launch', icon: Rocket, required: true },
];

interface WizardStepIndicatorProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  onStepClick?: (step: WizardStep) => void;
  canNavigateToStep?: (step: WizardStep) => boolean;
}

export function WizardStepIndicator({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
}: WizardStepIndicatorProps) {
  const getStepStatus = (step: WizardStep): 'completed' | 'current' | 'upcoming' => {
    if (completedSteps.includes(step)) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const handleStepClick = (step: WizardStep) => {
    if (onStepClick && (!canNavigateToStep || canNavigateToStep(step))) {
      onStepClick(step);
    }
  };

  return (
    <div className="space-y-1">
      {WIZARD_STEPS.map((stepConfig, index) => {
        const status = getStepStatus(stepConfig.step);
        const isClickable = canNavigateToStep?.(stepConfig.step) ?? false;
        const Icon = stepConfig.icon;
        const isLast = index === WIZARD_STEPS.length - 1;

        return (
          <div key={stepConfig.step} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-[11px] top-[28px] w-[2px] h-[calc(100%+4px)]",
                  status === 'completed' 
                    ? 'bg-[hsl(var(--portal-success))]' 
                    : 'bg-[hsl(var(--portal-border))]'
                )}
              />
            )}
            
            <motion.button
              type="button"
              onClick={() => handleStepClick(stepConfig.step)}
              disabled={!isClickable}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cn(
                'relative w-full flex items-start gap-3 p-2 transition-all text-left rounded-md group',
                status === 'current' && 'bg-[hsl(var(--portal-accent-blue))]/8',
                status === 'upcoming' && 'opacity-50',
                isClickable && status !== 'current' && 'hover:bg-[hsl(var(--portal-bg-hover))] cursor-pointer',
                !isClickable && 'cursor-default'
              )}
            >
              {/* Step indicator */}
              <div className={cn(
                'relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ring-2 ring-[hsl(var(--portal-bg-card))]',
                status === 'completed' && 'bg-[hsl(var(--portal-success))]',
                status === 'current' && 'bg-[hsl(var(--portal-accent-blue))]',
                status === 'upcoming' && 'bg-[hsl(var(--portal-bg-tertiary))]'
              )}>
                {status === 'completed' ? (
                  <Check className="h-3 w-3 text-white" />
                ) : (
                  <Icon className={cn(
                    'h-3 w-3',
                    status === 'current' ? 'text-white' : 'text-[hsl(var(--portal-text-muted))]'
                  )} />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-xs font-medium truncate leading-tight',
                    status === 'current' 
                      ? 'text-[hsl(var(--portal-text-primary))]' 
                      : status === 'completed'
                        ? 'text-[hsl(var(--portal-text-secondary))]'
                        : 'text-[hsl(var(--portal-text-muted))]'
                  )}>
                    {stepConfig.title}
                  </span>
                </div>
                <span className={cn(
                  'text-[10px] leading-tight block mt-0.5',
                  status === 'current' 
                    ? 'text-[hsl(var(--portal-text-secondary))]'
                    : 'text-[hsl(var(--portal-text-muted))]'
                )}>
                  {stepConfig.description}
                  {!stepConfig.required && (
                    <span className="ml-1 opacity-60">• optional</span>
                  )}
                </span>
              </div>
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
