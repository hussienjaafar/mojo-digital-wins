import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Badge } from "./badge";

interface MobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  threatLevel?: "critical" | "high" | "medium" | "low";
}

const MobileCard = React.forwardRef<HTMLDivElement, MobileCardProps>(
  ({ className, children, threatLevel, ...props }, ref) => {
    const borderColors = {
      critical: "border-l-4 border-l-red-500",
      high: "border-l-4 border-l-orange-500",
      medium: "border-l-4 border-l-yellow-500",
      low: "border-l-4 border-l-gray-300",
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "touch-manipulation",
          threatLevel && borderColors[threatLevel],
          className
        )}
        {...props}
      >
        {children}
      </Card>
    );
  }
);
MobileCard.displayName = "MobileCard";

interface MobileCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MobileCardHeader = React.forwardRef<HTMLDivElement, MobileCardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <CardHeader
      ref={ref}
      className={cn("p-4 pb-2 space-y-1", className)}
      {...props}
    >
      {children}
    </CardHeader>
  )
);
MobileCardHeader.displayName = "MobileCardHeader";

interface MobileCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MobileCardContent = React.forwardRef<HTMLDivElement, MobileCardContentProps>(
  ({ className, children, ...props }, ref) => (
    <CardContent
      ref={ref}
      className={cn("p-4 pt-0", className)}
      {...props}
    >
      {children}
    </CardContent>
  )
);
MobileCardContent.displayName = "MobileCardContent";

interface MobileCardActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MobileCardActions = React.forwardRef<HTMLDivElement, MobileCardActionsProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2 p-4 pt-2 border-t bg-muted/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
MobileCardActions.displayName = "MobileCardActions";

// Swipeable card for mobile interactions
interface SwipeableCardProps extends MobileCardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const SwipeableCard = React.forwardRef<HTMLDivElement, SwipeableCardProps>(
  ({ className, children, onSwipeLeft, onSwipeRight, ...props }, ref) => {
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;

      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }
      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    };

    return (
      <MobileCard
        ref={ref}
        className={cn("transition-transform", className)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        {...props}
      >
        {children}
      </MobileCard>
    );
  }
);
SwipeableCard.displayName = "SwipeableCard";

export {
  MobileCard,
  MobileCardHeader,
  MobileCardContent,
  MobileCardActions,
  SwipeableCard,
};
