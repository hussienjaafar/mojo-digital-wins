/**
 * WizardStepIndicator - Progress indicator for the Ad Copy Studio wizard
 *
 * Issue D1: Uses role="tablist" / role="tab" with arrow key navigation
 * Issue E4: Consistent rounded-xl border radius
 */

import { useCallback, useRef } from 'react';
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
  /** Optional data summaries keyed by step number, e.g. { 1: "3 videos", 2: "3 reviewed" } */
  stepSummaries?: Record<number, string | null>;
}

type StepStatus = 'completed' | 'current' | 'upcoming';

export function WizardStepIndicator({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
  stepSummaries,
}: WizardStepIndicatorProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

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

  // Issue D1: Arrow key navigation
  const handleKeyDown = useCallback((
    event: React.KeyboardEvent,
    step: AdCopyStudioStep,
    index: number
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepClick(step);
      return;
    }

    let targetIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      targetIndex = index < WIZARD_STEPS.length - 1 ? index + 1 : 0;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      targetIndex = index > 0 ? index - 1 : WIZARD_STEPS.length - 1;
    }

    if (targetIndex !== null && tabListRef.current) {
      const buttons = tabListRef.current.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[targetIndex]?.focus();
    }
  }, [onStepClick, canNavigateToStep]);

  return (
    <div
      ref={tabListRef}
      className="w-full"
      role="tablist"
      aria-label="Wizard progress"
    >
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((stepConfig, index) => {
          const status = getStepStatus(stepConfig.step);
          const isClickable = canNavigateToStep?.(stepConfig.step) ?? false;
          const Icon = STEP_ICONS[stepConfig.icon] || Upload;
          const isLastStep = index === WIZARD_STEPS.length - 1;

          return (
            <div
              key={stepConfig.step}
              className={cn(
                'flex items-center',
                !isLastStep && 'flex-1'
              )}
            >
              <motion.button
                type="button"
                role="tab"
                onClick={() => handleStepClick(stepConfig.step)}
                onKeyDown={(e) => handleKeyDown(e, stepConfig.step, index)}
                tabIndex={status === 'current' ? 0 : -1}
                disabled={!isClickable && status !== 'current'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                aria-selected={status === 'current'}
                aria-label={`Step ${stepConfig.step}: ${stepConfig.title}${
                  status === 'completed' ? ' (completed)' : ''
                }${status === 'current' ? ' (current)' : ''}`}
                className={cn(
                  'group flex flex-col items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141b2d] rounded-xl p-2',
                  isClickable && 'cursor-pointer',
                  !isClickable && status !== 'current' && 'cursor-not-allowed'
                )}
              >
                {/* Circle with icon */}
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    status === 'completed' && 'border-[#22c55e] bg-[#22c55e] text-white',
                    status === 'current' && 'border-blue-500 bg-blue-500 text-white',
                    status === 'upcoming' && 'border-[#1e2a45] bg-transparent text-[#64748b]',
                    isClickable && status === 'completed' && 'group-hover:bg-[#22c55e]/80',
                    isClickable && status === 'upcoming' && 'group-hover:border-[#64748b] group-hover:text-[#94a3b8]'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}

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

                {/* Step label - hidden on small screens */}
                <span
                  className={cn(
                    'text-xs font-medium transition-colors hidden sm:inline',
                    status === 'completed' && 'text-[#22c55e]',
                    status === 'current' && 'text-[#e2e8f0]',
                    status === 'upcoming' && 'text-[#64748b]',
                    isClickable && status !== 'current' && 'group-hover:text-[#94a3b8]'
                  )}
                >
                  {stepConfig.title}
                </span>

                {/* Data summary for completed steps */}
                {status === 'completed' && stepSummaries?.[stepConfig.step] && (
                  <span className="text-[10px] text-[#64748b] hidden sm:inline">
                    {stepSummaries[stepConfig.step]}
                  </span>
                )}
              </motion.button>

              {/* Connector line */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WizardStepIndicator;
