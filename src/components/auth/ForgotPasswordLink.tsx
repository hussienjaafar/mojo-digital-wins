import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface ForgotPasswordLinkProps {
  className?: string;
  variant?: "default" | "portal";
}

export function ForgotPasswordLink({ 
  className,
  variant = "default" 
}: ForgotPasswordLinkProps) {
  const location = useLocation();
  
  const handleClick = () => {
    // Store the current login page as the entry point for redirect after password reset
    const currentPath = location.pathname;
    if (currentPath === '/auth' || currentPath === '/client-login') {
      sessionStorage.setItem('login_entry_point', currentPath);
    }
  };

  return (
    <div className={cn("flex justify-end", className)}>
      <Link
        to="/forgot-password"
        onClick={handleClick}
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
