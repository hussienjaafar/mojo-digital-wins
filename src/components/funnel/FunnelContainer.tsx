import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface FunnelContainerProps {
  currentStep: number;
  direction: number;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  disableGestures?: boolean;
}

const variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

export default function FunnelContainer({
  currentStep,
  direction,
  children,
  onNext,
  onBack,
  disableGestures = false,
}: FunnelContainerProps) {
  const touchStart = useRef<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disableGestures) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter' && isInput) {
        return;
      }

      if (e.key === 'ArrowDown' || (e.key === 'Enter' && !isInput)) {
        e.preventDefault();
        onNext?.();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onBack?.();
      }
    },
    [onNext, onBack, disableGestures]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disableGestures) return;
    touchStart.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disableGestures) return;
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) onNext?.();
      else onBack?.();
    }
    touchStart.current = null;
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {currentStep > 0 && onBack && (
        <button
          onClick={onBack}
          className="fixed top-4 left-4 z-50 h-10 px-3 rounded-full bg-[#141b2d]/90 border border-[#1e2a45] flex items-center gap-1.5 text-[#94a3b8] hover:text-[#e2e8f0] hover:border-[#2d3b55] transition-colors backdrop-blur-sm"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-12 pb-24 md:pt-8 md:pb-16 overflow-y-auto will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
