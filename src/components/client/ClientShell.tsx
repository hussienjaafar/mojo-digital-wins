import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { motion } from "framer-motion";

import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SkipNavigation } from "@/components/accessibility/SkipNavigation";
import { OrganizationSelector } from "@/components/client/OrganizationSelector";
import { ClientHeaderControls } from "@/components/client/ClientHeaderControls";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

export interface ClientShellProps {
  children: ReactNode;
  /** Show date range picker in header (default: true) */
  showDateControls?: boolean;
  /** Optional page title for breadcrumb/header context */
  pageTitle?: string;
  /** Additional className for main content wrapper */
  contentClassName?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ClientShell = ({
  children,
  showDateControls = true,
  pageTitle,
  contentClassName,
}: ClientShellProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const { impersonatedOrgId, isImpersonating, setImpersonation } = useImpersonation();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // Auth Effect
  // ============================================================================

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  // ============================================================================
  // Load Organizations Effect
  // ============================================================================

  useEffect(() => {
    if (session?.user || isImpersonating) {
      loadUserOrganizations();
    }
  }, [session, impersonatedOrgId, isImpersonating]);

  const loadUserOrganizations = async () => {
    try {
      // If impersonating, check if user is admin to load all orgs
      if (isImpersonating && impersonatedOrgId) {
        // Get current session to check admin status
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        const { data: isAdminUser } = await supabase.rpc("has_role", {
          _user_id: currentUserId,
          _role: "admin",
        });

        if (isAdminUser) {
          // Admin impersonating: load ALL organizations for switching
          const { data: allOrgs, error: orgError } = await supabase
            .from("client_organizations")
            .select("id, name, logo_url")
            .eq("is_active", true)
            .order("name");

          if (orgError) throw orgError;

          if (allOrgs && allOrgs.length > 0) {
            const orgs: Organization[] = allOrgs.map((org) => ({
              id: org.id,
              name: org.name,
              logo_url: org.logo_url,
              role: "admin",
            }));

            setOrganizations(orgs);
            // Set the impersonated org as selected
            const selectedOrg = orgs.find((o) => o.id === impersonatedOrgId) || orgs[0];
            setOrganization(selectedOrg);
            setIsLoading(false);
            return;
          }
        } else {
          // Non-admin impersonating (fallback): load only the impersonated org
          const { data: org, error: orgError } = await (supabase as any)
            .from("client_organizations")
            .select("id, name, logo_url")
            .eq("id", impersonatedOrgId)
            .maybeSingle();

          if (orgError) throw orgError;
          if (org) {
            setOrganization(org);
            setOrganizations([org]);
          }
          setIsLoading(false);
          return;
        }
      }

      // Check if user is admin
      const { data: isAdminUser } = await supabase.rpc("has_role", {
        _user_id: session?.user?.id,
        _role: "admin",
      });

      if (isAdminUser) {
        // Admin: load all organizations
        const { data: allOrgs, error: orgError } = await supabase
          .from("client_organizations")
          .select("id, name, logo_url")
          .eq("is_active", true)
          .order("name");

        if (orgError) throw orgError;

        if (!allOrgs || allOrgs.length === 0) {
          toast({
            title: "No Organizations",
            description: "No client organizations exist yet",
            variant: "destructive",
          });
          navigate("/admin");
          return;
        }

        const orgs: Organization[] = allOrgs.map((org) => ({
          id: org.id,
          name: org.name,
          logo_url: org.logo_url,
          role: "admin",
        }));

        setOrganizations(orgs);
        const savedOrgId = localStorage.getItem("selectedOrganizationId");
        const savedOrg = orgs.find((org) => org.id === savedOrgId);
        setOrganization(savedOrg || orgs[0]);
      } else {
        // Regular client user: load their organizations
        const { data: clientUserData, error: userError } = await (supabase as any)
          .from("client_users")
          .select(
            `
            organization_id,
            role,
            client_organizations (
              id,
              name,
              logo_url
            )
          `
          )
          .eq("id", session?.user?.id);

        if (userError) throw userError;
        if (!clientUserData || clientUserData.length === 0) {
          navigate("/access-denied?from=client");
          return;
        }

        const orgs: Organization[] = clientUserData.map((item: any) => ({
          id: item.client_organizations.id,
          name: item.client_organizations.name,
          logo_url: item.client_organizations.logo_url,
          role: item.role,
        }));

        setOrganizations(orgs);
        const savedOrgId = localStorage.getItem("selectedOrganizationId");
        const savedOrg = orgs.find((org) => org.id === savedOrgId);
        setOrganization(savedOrg || orgs[0]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organizations",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleOrganizationChange = (newOrgId: string) => {
    const newOrg = organizations.find((org) => org.id === newOrgId);
    if (newOrg) {
      setOrganization(newOrg);
      localStorage.setItem("selectedOrganizationId", newOrgId);
      
      // Sync to impersonation context so child pages using useClientOrganization
      // automatically pick up the new organization
      if (isAdmin) {
        setImpersonation(
          session?.user?.id || '',
          'System Admin',
          newOrg.id,
          newOrg.name
        );
      }
      
      toast({
        title: "Organization switched",
        description: `Now viewing ${newOrg.name}`,
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client-login");
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Show "Back to Admin" button when impersonating OR when user is admin
  const showBackToAdmin = isImpersonating || (!isAdminLoading && isAdmin);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading || !organization) {
    return (
      <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
        {/* Accessibility: Ensure <main> and <h1> exist during loading for WCAG compliance */}
        <main
          id="main-content"
          role="main"
          className="text-center space-y-4"
        >
          {/* Visually hidden h1 for screen readers during loading state */}
          <h1 className="sr-only">
            {pageTitle || "Loading dashboard"}
          </h1>
          <motion.div
            className="w-16 h-16 border-4 border-t-transparent rounded-full mx-auto"
            style={{ borderColor: "hsl(var(--portal-accent-blue))" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            aria-hidden="true"
          />
          <p className="portal-text-secondary font-medium" aria-live="polite">
            Loading...
          </p>
        </main>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

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
            <header 
              className="portal-header-clean" 
              role="banner"
            >
              <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
                {/* Two-row layout on mobile/tablet, single row on xl+ */}
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
                  {/* Row 1: Sidebar Trigger + Logo + Organization */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <SidebarTrigger
                      className="portal-icon-btn shrink-0"
                      aria-label="Toggle navigation menu"
                    />

                    {organization.logo_url && (
                      <motion.img
                        src={organization.logo_url}
                        alt={`${organization.name} logo`}
                        className="h-8 sm:h-10 w-auto object-contain shrink-0"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-semibold portal-text-primary truncate">
                          {organization.name}
                        </h1>
                        {/* Show org selector for admins (always) or users with multiple orgs */}
                        {(isAdmin || organizations.length > 1) && organizations.length > 0 && (
                          <OrganizationSelector
                            organizations={organizations}
                            selectedId={organization.id}
                            onSelect={handleOrganizationChange}
                            isAdmin={isAdmin}
                          />
                        )}
                      </div>
                      {pageTitle && (
                        <p className="text-xs portal-text-muted mt-0.5 truncate">
                          {pageTitle}
                        </p>
                      )}
                      {!pageTitle && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="portal-status-dot" />
                          <span className="text-xs portal-text-muted">Live</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2 on mobile/tablet, inline on xl+: Controls */}
                  <div className="flex items-center justify-start xl:justify-end xl:shrink-0">
                    <ClientHeaderControls
                      showDateControls={showDateControls}
                      showBackToAdmin={showBackToAdmin}
                      theme={theme}
                      onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                      onBackToAdmin={handleBackToAdmin}
                      onLogout={handleLogout}
                    />
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main
              id="main-content"
              className={cn(
                "portal-scrollbar flex-1 overflow-y-auto overflow-x-hidden",
                contentClassName
              )}
              role="main"
              tabIndex={-1}
            >
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
};
