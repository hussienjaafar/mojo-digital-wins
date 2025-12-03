import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeftRight, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserRoles } from "@/hooks/useUserRoles";

export const RoleSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasMultipleRoles, loading } = useUserRoles();

  // Don't render if user doesn't have multiple roles
  if (loading || !hasMultipleRoles) {
    return null;
  }

  const isOnAdminDashboard = location.pathname.startsWith("/admin");
  const isOnClientDashboard = location.pathname.startsWith("/client");

  const handleSwitch = (destination: "admin" | "client") => {
    if (destination === "admin") {
      navigate("/admin");
    } else {
      navigate("/client/dashboard");
    }
  };

  // If we're on a dashboard, show a simple switch button
  if (isOnAdminDashboard || isOnClientDashboard) {
    const targetDashboard = isOnAdminDashboard ? "client" : "admin";
    const targetLabel = isOnAdminDashboard ? "Client Dashboard" : "Admin Dashboard";
    const TargetIcon = isOnAdminDashboard ? LayoutDashboard : Settings;

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSwitch(targetDashboard)}
        className="gap-2 min-h-[44px] portal-text-secondary hover:portal-text-primary transition-all duration-300"
        title={`Switch to ${targetLabel}`}
      >
        <ArrowLeftRight className="h-4 w-4" />
        <span className="hidden md:inline">Switch to {targetLabel}</span>
        <TargetIcon className="h-4 w-4 md:hidden" />
      </Button>
    );
  }

  // If we're not on a dashboard, show a dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 min-h-[44px] portal-text-secondary hover:portal-text-primary"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboards</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleSwitch("admin")} className="gap-2 cursor-pointer">
          <Settings className="h-4 w-4" />
          Admin Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSwitch("client")} className="gap-2 cursor-pointer">
          <LayoutDashboard className="h-4 w-4" />
          Client Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
