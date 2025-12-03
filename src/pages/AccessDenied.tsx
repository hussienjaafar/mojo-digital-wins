import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, Home, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";

const AccessDenied = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const { isAdmin, isClientUser, loading } = useUserRoles();

  const getMessage = () => {
    switch (from) {
      case "admin":
        return {
          title: "Admin Access Required",
          description: "You don't have permission to access the Admin Dashboard. This area is restricted to users with administrator privileges.",
        };
      case "client":
        return {
          title: "Client Access Required",
          description: "You don't have permission to access the Client Portal. This area is restricted to users linked to a client organization.",
        };
      default:
        return {
          title: "Access Denied",
          description: "You don't have permission to access this page.",
        };
    }
  };

  const { title, description } = getMessage();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="portal-theme portal-bg min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl portal-text-primary">{title}</CardTitle>
          <CardDescription className="text-base portal-text-secondary">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'hsl(var(--portal-accent-blue))' }} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isClientUser && from === "admin" && (
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => navigate("/client/dashboard")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Client Dashboard
                </Button>
              )}
              {isAdmin && from === "client" && (
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => navigate("/admin")}
                >
                  <Settings className="h-4 w-4" />
                  Go to Admin Dashboard
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4" />
                Go to Home
              </Button>
            </div>
          )}
          <div className="pt-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out & Switch Account
            </Button>
          </div>
          <p className="text-sm text-center portal-text-secondary mt-4">
            Need access? Contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessDenied;
