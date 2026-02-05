/**
 * WizardStepIndicator - Progress indicator for the Ad Copy Studio wizard
 *
 * Displays a horizontal step indicator showing progress through the 5-step workflow:
 * 1. Upload - Upload campaign videos
 * 2. Review - Review transcripts & analysis
 * 3. Configure - Configure campaign settings
 * 4. Generate - Generate ad copy
 * 5. Export - Review & export copy
 */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Check,
  Upload,
  FileText,
  Settings,
  Sparkles,
  Download,
  LucideIcon,
} from 'lucide-react';
import type { AdCopyStudioStep, WizardStepConfig } from '@/types/ad-copy-studio';
import { WIZARD_STEPS } from '@/types/ad-copy-studio';

// Map icon names from WIZARD_STEPS to actual Lucide components
const STEP_ICONS: Record<string, LucideIcon> = {
  Upload,
  FileText,
  Settings,
  Sparkles,
  Download,
};

interface WizardStepIndicatorProps {
  currentStep: AdCopyStudioStep;
  completedSteps: AdCopyStudioStep[];
  onStepClick?: (step: AdCopyStudioStep) => void;
  canNavigateToStep?: (step: AdCopyStudioStep) => boolean;
}

type StepStatus = 'completed' | 'current' | 'upcoming';

export function WizardStepIndicator({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
}: WizardStepIndicatorProps) {
  const getStepStatus = (step: AdCopyStudioStep): StepStatus => {
    if (completedSteps.includes(step)) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const handleStepClick = (step: AdCopyStudioStep) => {
    if (onStepClick && (!canNavigateToStep || canNavigateToStep(step))) {
      onStepClick(step);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent,
    step: AdCopyStudioStep
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepClick(step);
    }
  };

  return (
    <nav
      className="w-full"
      role="navigation"
      aria-label="Wizard progress"
    >
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((stepConfig, index) => {
          const status = getStepStatus(stepConfig.step);
          const isClickable = canNavigateToStep?.(stepConfig.step) ?? false;
          const Icon = STEP_ICONS[stepConfig.icon] || Upload;
          const isLastStep = index === WIZARD_STEPS.length - 1;

          return (
            <li
              key={stepConfig.step}
              className={cn(
                'flex items-center',
                !isLastStep && 'flex-1'
              )}
            >
              {/* Step button/indicator */}
              <motion.button
                type="button"
                onClick={() => handleStepClick(stepConfig.step)}
                onKeyDown={(e) => handleKeyDown(e, stepConfig.step)}
                disabled={!isClickable && status !== 'current'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`Step ${stepConfig.step}: ${stepConfig.title}${
                  status === 'completed' ? ' (completed)' : ''
                }${status === 'current' ? ' (current)' : ''}`}
                className={cn(
                  'group flex flex-col items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1a] rounded-lg p-2',
                  isClickable && 'cursor-pointer',
                  !isClickable && status !== 'current' && 'cursor-not-allowed'
                )}
              >
                {/* Circle with icon */}
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    // Completed: green accent with checkmark
                    status === 'completed' &&
                      'border-[#22c55e] bg-[#22c55e] text-white',
                    // Current: blue accent with icon
                    status === 'current' &&
                      'border-blue-500 bg-blue-500 text-white',
                    // Upcoming: outline circle, muted
                    status === 'upcoming' &&
                      'border-[#1e2a45] bg-transparent text-[#64748b]',
                    // Hover states for clickable steps
                    isClickable &&
                      status === 'completed' &&
                      'group-hover:bg-[#22c55e]/80',
                    isClickable &&
                      status === 'upcoming' &&
                      'group-hover:border-[#64748b] group-hover:text-[#94a3b8]'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}

                  {/* Pulsing indicator for current step */}
                  {status === 'current' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-500"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.8, 0, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    status === 'completed' && 'text-[#22c55e]',
                    status === 'current' && 'text-[#e2e8f0]',
                    status === 'upcoming' && 'text-[#64748b]',
                    isClickable &&
                      status !== 'current' &&
                      'group-hover:text-[#94a3b8]'
                  )}
                >
                  {stepConfig.title}
                </span>
              </motion.button>

              {/* Connector line to next step */}
              {!isLastStep && (
                <div className="mx-2 h-0.5 flex-1" aria-hidden="true">
                  {status === 'completed' ? (
                    <motion.div
                      className="h-full w-full rounded-full bg-[#22c55e]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      style={{ transformOrigin: 'left' }}
                    />
                  ) : status === 'current' ? (
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: 'linear-gradient(to right, #3b82f6 0%, #1e2a45 100%)',
                      }}
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-[#1e2a45]" />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default WizardStepIndicator;
