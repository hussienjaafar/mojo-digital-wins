import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Sun, Moon } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { useToast } from "@/hooks/use-toast";
import { SkipNavigation } from "@/components/accessibility/SkipNavigation";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientLayoutProps {
  children: ReactNode;
}

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

export const ClientLayout = ({ children }: ClientLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const { impersonatedOrgId, isImpersonating } = useImpersonation();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Allow access if impersonating (admin is logged in)
      if (!session && !isImpersonating) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Allow access if impersonating (admin is logged in)
      if (!session && !isImpersonating) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isImpersonating]);

  useEffect(() => {
    if (session?.user || isImpersonating) {
      loadUserOrganization();
    }
  }, [session, impersonatedOrgId, isImpersonating]);

  const loadUserOrganization = async () => {
    try {
      let orgId = impersonatedOrgId;

      // If not impersonating, get user's organization
      if (!isImpersonating) {
        const { data: clientUser, error: userError } = await (supabase as any)
          .from('client_users')
          .select('organization_id')
          .eq('id', session?.user?.id)
          .maybeSingle();

        if (userError) throw userError;
        if (!clientUser) {
          toast({
            title: "Error",
            description: "You don't have access to a client organization",
            variant: "destructive",
          });
          navigate('/');
          return;
        }
        orgId = clientUser.organization_id;
      }

      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!org) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive",
        });
        navigate('/');
        return;
      }
      setOrganization(org);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organization",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client-login');
  };

  if (isLoading || !organization) {
    return (
      <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'hsl(var(--portal-accent-blue))' }} />
          <p className="portal-text-secondary font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SkipNavigation />
      <SidebarProvider defaultOpen={!isMobile}>
        <div className="portal-theme min-h-screen w-full flex portal-bg">
          <AppSidebar organizationId={organization.id} />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Impersonation Banner */}
          <ImpersonationBanner />
          
          {/* Clean Modern Header */}
          <header className="portal-header-clean" role="banner">
            <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Sidebar Trigger + Organization */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <SidebarTrigger className="portal-icon-btn shrink-0" aria-label="Toggle navigation menu" />
                  
                  {organization.logo_url && (
                    <img
                      src={organization.logo_url}
                      alt={`${organization.name} logo`}
                      className="h-8 sm:h-10 w-auto object-contain shrink-0"
                    />
                  )}
                  
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold portal-text-primary truncate">
                      {organization.name}
                    </h1>
                  </div>
                </div>

                {/* Right: Icon Actions */}
                <TooltipProvider delayDuration={300}>
                  <nav className="portal-header-actions" aria-label="User actions">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                          className="portal-icon-btn"
                          aria-label="Toggle theme"
                        >
                          {theme === "dark" ? (
                            <Sun className="h-[18px] w-[18px]" />
                          ) : (
                            <Moon className="h-[18px] w-[18px]" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Toggle theme</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleLogout}
                          className="portal-icon-btn portal-icon-btn-danger"
                          aria-label="Log out of your account"
                        >
                          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Logout</p>
                      </TooltipContent>
                    </Tooltip>
                  </nav>
                </TooltipProvider>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main id="main-content" className="flex-1 overflow-auto" role="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </>
  );
};
