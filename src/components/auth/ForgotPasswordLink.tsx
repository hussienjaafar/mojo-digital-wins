import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ForgotPasswordLinkProps {
  className?: string;
  variant?: "default" | "portal";
}

export function ForgotPasswordLink({ 
  className,
  variant = "default" 
}: ForgotPasswordLinkProps) {
  return (
    <div className={cn("flex justify-end", className)}>
      <Link
        to="/forgot-password"
        className={cn(
          "text-sm transition-colors",
          variant === "portal" 
            ? "text-[hsl(var(--portal-text-secondary))] hover:text-[hsl(var(--portal-accent-blue))]"
            : "text-muted-foreground hover:text-primary"
        )}
      >
        Forgot your password?
      </Link>
    </div>
  );
}
