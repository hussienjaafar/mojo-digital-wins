import { useMemo } from "react";

interface ClientSparklineProps {
  data: number[];
  className?: string;
  color?: string;
}

export function ClientSparkline({ data, className = "", color = "hsl(var(--primary))" }: ClientSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const width = 100;
    const height = 24;
    const padding = 2;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    
    return `M ${points.join(" L ")}`;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className={`h-6 flex items-center text-xs text-muted-foreground ${className}`}>
        No data
      </div>
    );
  }

  return (
    <svg 
      viewBox="0 0 100 24" 
      className={`w-full h-6 ${className}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData || ""}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
