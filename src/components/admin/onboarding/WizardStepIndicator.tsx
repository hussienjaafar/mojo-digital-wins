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

        return (
          <motion.button
            key={stepConfig.step}
            type="button"
            onClick={() => handleStepClick(stepConfig.step)}
            disabled={!isClickable}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left',
              'border border-transparent',
              status === 'current' && 'bg-[hsl(var(--portal-accent-blue))]/10 border-[hsl(var(--portal-accent-blue))]/30',
              status === 'completed' && 'bg-[hsl(var(--portal-success))]/5',
              status === 'upcoming' && 'opacity-60',
              isClickable && status !== 'current' && 'hover:bg-[hsl(var(--portal-bg-elevated))] cursor-pointer',
              !isClickable && 'cursor-not-allowed'
            )}
          >
            {/* Step number/check indicator */}
            <div className={cn(
              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              status === 'completed' && 'bg-[hsl(var(--portal-success))] text-white',
              status === 'current' && 'bg-[hsl(var(--portal-accent-blue))] text-white',
              status === 'upcoming' && 'bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]'
            )}>
              {status === 'completed' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium truncate',
                  status === 'current' ? 'text-[hsl(var(--portal-text-primary))]' : 'text-[hsl(var(--portal-text-secondary))]'
                )}>
                  {stepConfig.title}
                </span>
                {!stepConfig.required && (
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--portal-text-muted))] font-medium">
                    Optional
                  </span>
                )}
              </div>
              <span className="text-xs text-[hsl(var(--portal-text-muted))] truncate block">
                {stepConfig.description}
              </span>
            </div>

            {/* Status indicator */}
            {status === 'completed' && (
              <div className="flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--portal-success))]" />
              </div>
            )}
            {status === 'current' && (
              <div className="flex-shrink-0">
                <motion.div 
                  className="w-2 h-2 rounded-full bg-[hsl(var(--portal-accent-blue))]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
