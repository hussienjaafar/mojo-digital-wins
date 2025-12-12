import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { LogOut, Sun, Moon, ArrowLeft } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { V3DateRangePicker } from "@/components/v3";
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
  const { impersonatedOrgId, isImpersonating } = useImpersonation();
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
      // If impersonating, load the impersonated org
      if (isImpersonating && impersonatedOrgId) {
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
        <div className="text-center space-y-4">
          <motion.div
            className="w-16 h-16 border-4 border-t-transparent rounded-full mx-auto"
            style={{ borderColor: "hsl(var(--portal-accent-blue))" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="portal-text-secondary font-medium">Loading...</p>
        </div>
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
            <header className="portal-header-clean" role="banner">
              <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Sidebar Trigger + Organization */}
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
                        {organizations.length > 1 && (
                          <OrganizationSelector
                            organizations={organizations}
                            selectedId={organization.id}
                            onSelect={handleOrganizationChange}
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

                  {/* Right: Controls */}
                  <TooltipProvider delayDuration={300}>
                    <nav
                      className="portal-header-actions flex items-center gap-1 sm:gap-2"
                      aria-label="Header actions"
                    >
                      {/* Date Range Picker */}
                      {showDateControls && (
                        <div className="hidden sm:block">
                          <V3DateRangePicker />
                        </div>
                      )}

                      {/* Back to Admin Button */}
                      {showBackToAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleBackToAdmin}
                              className={cn(
                                "h-9 gap-1.5 px-2 sm:px-3",
                                "bg-[hsl(var(--portal-bg-elevated))]",
                                "border-[hsl(var(--portal-border))]",
                                "text-[hsl(var(--portal-text-primary))]",
                                "hover:bg-[hsl(var(--portal-bg-hover))]",
                                "hover:border-[hsl(var(--portal-accent-blue))]"
                              )}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span className="hidden sm:inline">Admin</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>Back to Admin Dashboard</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Theme Toggle */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="portal-icon-btn"
                            aria-label="Toggle theme"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {theme === "dark" ? (
                              <Sun className="h-[18px] w-[18px]" />
                            ) : (
                              <Moon className="h-[18px] w-[18px]" />
                            )}
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Toggle theme</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Logout */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            onClick={handleLogout}
                            className="portal-icon-btn portal-icon-btn-danger"
                            aria-label="Log out of your account"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                          </motion.button>
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
            <main
              id="main-content"
              className={cn("portal-scrollbar flex-1 overflow-auto", contentClassName)}
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
