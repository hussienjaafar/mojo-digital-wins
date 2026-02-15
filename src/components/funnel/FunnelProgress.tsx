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
              ? 'bg-blue-500 scale-125 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
              : i < currentStep
              ? 'bg-[#94a3b8]'
              : 'bg-[#1e2a45]'
          }`}
        />
      ))}
    </div>
  );
}
