import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * ClientDashboardCustom - Legacy page that redirects to the main ClientDashboard
 * This page had mobile optimization issues and duplicate functionality.
 * Redirecting to /client/dashboard which has proper mobile support.
 */
const ClientDashboardCustom = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main client dashboard which has proper mobile support
    navigate("/client/dashboard", { replace: true });
  }, [navigate]);

  // Show loading spinner during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </div>
  );
};

export default ClientDashboardCustom;
