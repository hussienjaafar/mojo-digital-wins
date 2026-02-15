interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i === currentStep
              ? 'bg-white scale-125'
              : i < currentStep
              ? 'bg-white/60'
              : 'bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}
