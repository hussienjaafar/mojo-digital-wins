import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { useToast } from "@/hooks/use-toast";
import { SkipNavigation } from "@/components/accessibility/SkipNavigation";

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
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadUserOrganization();
    }
  }, [session]);

  const loadUserOrganization = async () => {
    try {
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

      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SkipNavigation />
      <SidebarProvider defaultOpen={!isMobile}>
        <div className="min-h-screen w-full flex bg-gradient-to-br from-background via-background to-muted/10">
          <AppSidebar organizationId={organization.id} />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-sm" role="banner">
            <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
              <div className="flex items-center justify-between gap-3">
                {/* Sidebar Trigger + Logo */}
                <div className="flex items-center gap-3 sm:gap-6">
                  <SidebarTrigger aria-label="Toggle navigation menu" />
                  {organization.logo_url && (
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" aria-hidden="true" />
                      <img
                        src={organization.logo_url}
                        alt={`${organization.name} logo`}
                        className="relative h-10 sm:h-12 w-auto object-contain"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent truncate">
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
