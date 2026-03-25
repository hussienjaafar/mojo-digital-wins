import { Check } from 'lucide-react';

interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = ['Start', 'Path', 'Discover', 'Proof', 'Qualify', 'Done'];

export default function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  // Hide entirely on welcome step
  if (currentStep === 0) return null;

  const progress = (currentStep / (totalSteps - 1)) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      {/* Mobile: thin progress bar only */}
      <div className="sm:hidden">
        <div className="h-1 w-full bg-[#1e2a45]">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Desktop: labeled steps */}
      <div className="hidden sm:block pb-4 pt-2 px-4 bg-gradient-to-t from-[#0a0f1a] via-[#0a0f1a]/95 to-transparent">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          {Array.from({ length: totalSteps }, (_, i) => {
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;
            const label = STEP_LABELS[i] || `Step ${i + 1}`;

            return (
              <div key={i} className="flex items-center gap-2">
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
                  <span className={`text-[9px] transition-colors ${
                    isActive ? 'text-blue-400 font-medium' : isCompleted ? 'text-emerald-400/70' : 'text-[#7c8ba3]'
                  }`}>
                    {label}
                  </span>
                </div>
                {i < totalSteps - 1 && (
                  <div className={`w-6 h-px transition-colors ${
                    isCompleted ? 'bg-emerald-500/50' : 'bg-[#1e2a45]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
