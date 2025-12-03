import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { useToast } from "@/hooks/use-toast";
import { SkipNavigation } from "@/components/accessibility/SkipNavigation";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useImpersonation } from "@/contexts/ImpersonationContext";

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
          
          {/* Header */}
          <header className="portal-header" role="banner">
            <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between gap-3">
                {/* Sidebar Trigger + Logo */}
                <div className="flex items-center gap-3 sm:gap-6">
                  <SidebarTrigger aria-label="Toggle navigation menu" />
                  {organization.logo_url && (
                    <div className="shrink-0">
                      <img
                        src={organization.logo_url}
                        alt={`${organization.name} logo`}
                        className="h-10 sm:h-12 w-auto object-contain"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight portal-text-primary truncate">
                      {organization.name}
                    </h1>
                  </div>
                </div>

                {/* Actions */}
                <nav className="flex items-center gap-2" aria-label="User actions">
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "default"}
                    onClick={handleLogout}
                    className="gap-2 min-h-[44px]"
                    aria-label="Log out of your account"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </nav>
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
