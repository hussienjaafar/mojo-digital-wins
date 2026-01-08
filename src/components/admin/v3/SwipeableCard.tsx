import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Bookmark, Share2, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: { icon: React.ReactNode; label: string; color: string };
  rightAction?: { icon: React.ReactNode; label: string; color: string };
  className?: string;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 100;

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = { icon: <Bookmark className="h-5 w-5" />, label: 'Save', color: 'bg-primary' },
  rightAction = { icon: <Archive className="h-5 w-5" />, label: 'Archive', color: 'bg-muted' },
  className,
  disabled = false,
}: SwipeableCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  
  const leftOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rightOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const scale = useTransform(x, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0.95, 1, 0.95]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    if (info.offset.x > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    }
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={constraintsRef} className="relative overflow-hidden">
      {/* Left action background */}
      <motion.div 
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-start pl-4 w-24",
          leftAction.color
        )}
        style={{ opacity: leftOpacity }}
      >
        <div className="flex flex-col items-center gap-1 text-primary-foreground">
          {leftAction.icon}
          <span className="text-xs font-medium">{leftAction.label}</span>
        </div>
      </motion.div>

      {/* Right action background */}
      <motion.div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end pr-4 w-24",
          rightAction.color
        )}
        style={{ opacity: rightOpacity }}
      >
        <div className="flex flex-col items-center gap-1 text-foreground">
          {rightAction.icon}
          <span className="text-xs font-medium">{rightAction.label}</span>
        </div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x, scale }}
        className={cn(
          "relative bg-background cursor-grab active:cursor-grabbing touch-pan-y",
          isDragging && "z-10",
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
