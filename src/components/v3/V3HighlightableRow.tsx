import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHoveredDataPoint, useChartInteractionStore } from "@/stores/chartInteractionStore";

interface V3HighlightableRowProps {
  dataKey: string;
  children: React.ReactNode;
  className?: string;
  highlightClassName?: string;
}

export const V3HighlightableRow: React.FC<V3HighlightableRowProps> = ({
  dataKey,
  children,
  className,
  highlightClassName = "bg-[hsl(var(--portal-accent-blue))]/10 border-[hsl(var(--portal-accent-blue))]/30",
}) => {
  const hoveredDataPoint = useHoveredDataPoint();
  const setHoveredDataPoint = useChartInteractionStore((state) => state.setHoveredDataPoint);

  const isHighlighted = hoveredDataPoint?.date === dataKey || hoveredDataPoint?.series === dataKey;

  const handleMouseEnter = React.useCallback(() => {
    setHoveredDataPoint({ date: dataKey, series: dataKey });
  }, [dataKey, setHoveredDataPoint]);

  const handleMouseLeave = React.useCallback(() => {
    setHoveredDataPoint(null);
  }, [setHoveredDataPoint]);

  return (
    <motion.div
      className={cn(
        "transition-all duration-150 rounded-lg border border-transparent",
        isHighlighted && highlightClassName,
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{
        scale: isHighlighted ? 1.01 : 1,
        backgroundColor: isHighlighted ? "hsl(var(--portal-accent-blue) / 0.05)" : "transparent",
      }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
};

V3HighlightableRow.displayName = "V3HighlightableRow";
