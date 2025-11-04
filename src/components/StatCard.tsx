import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "highlight" | "compact";
  duration?: number;
  className?: string;
}

export const StatCard = ({
  value,
  suffix = "",
  prefix = "",
  label,
  description,
  icon: Icon,
  variant = "default",
  duration = 2000,
  className,
}: StatCardProps) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration, isVisible]);

  if (variant === "compact") {
    return (
      <div ref={ref} className={cn("text-center", className)}>
        <div className="text-3xl md:text-4xl font-black text-secondary mb-1">
          {prefix}
          {count.toLocaleString()}
          {suffix}
        </div>
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
      </div>
    );
  }

  if (variant === "highlight") {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-card border border-border rounded-lg p-6 hover-lift",
          className
        )}
      >
        {Icon && (
          <div className="bg-secondary/10 text-secondary w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className="text-4xl md:text-5xl font-black text-secondary mb-2">
          {prefix}
          {count.toLocaleString()}
          {suffix}
        </div>
        <div className="text-lg font-semibold text-foreground mb-1">{label}</div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("text-center", className)}>
      {Icon && (
        <div className="bg-secondary/10 text-secondary w-16 h-16 rounded-lg flex items-center justify-center mb-4 mx-auto">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <div className="text-4xl md:text-5xl font-black text-secondary mb-2">
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-base md:text-lg text-muted-foreground font-medium mb-2">{label}</div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
};
