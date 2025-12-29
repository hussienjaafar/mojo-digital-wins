import { cn } from "@/lib/utils";

export type V3FilterPillVariant = "default" | "primary" | "success" | "warning" | "error";

export interface V3FilterPillProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  count?: number;
  variant?: V3FilterPillVariant;
  className?: string;
  disabled?: boolean;
}

export function V3FilterPill({
  label,
  isActive = false,
  onClick,
  count,
  variant = "default",
  className,
  disabled = false,
}: V3FilterPillProps) {
  const baseClasses = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none";
  
  const activeClasses: Record<V3FilterPillVariant, string> = {
    default: "bg-[hsl(var(--portal-accent-blue))] text-white",
    primary: "bg-[hsl(var(--portal-accent-blue))] text-white",
    success: "bg-[hsl(var(--portal-accent-green))] text-white",
    warning: "bg-[hsl(var(--portal-accent-yellow))] text-black",
    error: "bg-[hsl(var(--portal-accent-red))] text-white",
  };

  const inactiveClasses = "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]/80 hover:text-[hsl(var(--portal-text-primary))] border border-[hsl(var(--portal-border))]";
  
  const disabledClasses = "opacity-50 cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        baseClasses,
        isActive ? activeClasses[variant] : inactiveClasses,
        disabled && disabledClasses,
        className
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold",
            isActive
              ? "bg-white/20 text-inherit"
              : "bg-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
