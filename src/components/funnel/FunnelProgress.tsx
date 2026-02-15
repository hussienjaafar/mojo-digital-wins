import { Check } from 'lucide-react';

interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = ['Start', 'Path', 'Opportunity', 'Proof', 'Qualify', 'Done'];

export default function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-4 pt-2 px-4 bg-gradient-to-t from-[#0a0f1a] via-[#0a0f1a]/95 to-transparent pointer-events-none">
      {/* Step counter for mobile */}
      <p className="text-center text-[#7c8ba3] text-[10px] mb-2 sm:hidden">
        Step {Math.min(currentStep + 1, totalSteps - 1)} of {totalSteps - 1}
      </p>
      <div className="flex items-center justify-center gap-1 sm:gap-2 max-w-md mx-auto">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          const label = STEP_LABELS[i] || `Step ${i + 1}`;

          return (
            <div key={i} className="flex items-center gap-1 sm:gap-2">
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-6 h-6 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : isCompleted
                      ? 'w-5 h-5 bg-emerald-500/80'
                      : 'w-5 h-5 bg-[#1e2a45]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <span className={`text-[9px] font-semibold ${isActive ? 'text-white' : 'text-[#7c8ba3]'}`}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] hidden sm:block transition-colors ${
                  isActive ? 'text-blue-400 font-medium' : isCompleted ? 'text-emerald-400/70' : 'text-[#7c8ba3]'
                }`}>
                  {label}
                </span>
              </div>
              {/* Connector line */}
              {i < totalSteps - 1 && (
                <div className={`w-3 sm:w-6 h-px transition-colors ${
                  isCompleted ? 'bg-emerald-500/50' : 'bg-[#1e2a45]'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
