import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Smart login redirect page that determines the appropriate login destination
 * based on user context (admin vs organization member).
 * 
 * Priority:
 * 1. Check sessionStorage for entry point (set by ForgotPasswordLink)
 * 2. Default → /client-login (most common user type)
 * 
 * Admins can navigate to /auth directly if needed.
 */
export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const determineLoginDestination = async () => {
      // Check for stored entry point from password reset flow
      const entryPoint = sessionStorage.getItem('login_entry_point');
      if (entryPoint) {
        sessionStorage.removeItem('login_entry_point');
        navigate(entryPoint, { replace: true });
        return;
      }

      // Default to client login (most common user type)
      // Admins can navigate to /auth directly
      navigate('/client-login', { replace: true });
    };

    determineLoginDestination();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingSpinner size="lg" />
    </div>
  );
}
