import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FunnelContainerProps {
  currentStep: number;
  direction: number;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
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
}: FunnelContainerProps) {
  const touchStart = useRef<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        onNext?.();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onBack?.();
      }
    },
    [onNext, onBack]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 flex flex-col items-center px-5 pt-12 pb-24 overflow-y-auto will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
