import { ReactNode, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { proxyQuery, proxyRpc } from "@/lib/supabaseProxy";
import { motion, AnimatePresence } from "framer-motion";

import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";
import { useSessionManager, formatTimeRemaining } from "@/hooks/useSessionManager";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SkipNavigation } from "@/components/accessibility/SkipNavigation";
import { OrganizationSelector } from "@/components/client/OrganizationSelector";
import { ClientHeaderControls } from "@/components/client/ClientHeaderControls";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
// Session Expiry Banner Component
// ============================================================================

interface SessionExpiryBannerProps {
  timeUntilExpiry: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

const SessionExpiryBanner = ({
  timeUntilExpiry,
  isRefreshing,
  onRefresh,
  onDismiss,
}: SessionExpiryBannerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-amber-500/90 dark:bg-amber-600/90 text-white px-4 py-2"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">
            Session expiring in {formatTimeRemaining(timeUntilExpiry)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-7 text-xs bg-white/20 hover:bg-white/30 border-0"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                Extend Session
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 w-7 p-0 hover:bg-white/20"
            aria-label="Dismiss session warning"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

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

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [showExpiryBanner, setShowExpiryBanner] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track if expiry warning toast was shown to prevent duplicates
  const expiryToastShown = useRef(false);

  // ============================================================================
  // Session Manager - Single source of truth for auth state
  // ============================================================================

  const handleSessionExpiring = useCallback(() => {
    setShowExpiryBanner(true);
    if (!expiryToastShown.current) {
      expiryToastShown.current = true;
      toast({
        title: "Session expiring soon",
        description: "Your session will expire in less than 5 minutes. Click refresh to extend.",
        variant: "default",
      });
    }
  }, [toast]);

  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Session expired",
      description: "Please log in again to continue.",
      variant: "destructive",
    });
    navigate("/client-login");
  }, [toast, navigate]);

  const handleSessionRefreshed = useCallback(() => {
    setShowExpiryBanner(false);
    setIsRefreshing(false);
    expiryToastShown.current = false;
  }, []);

  const handleRefreshError = useCallback((error: Error) => {
    setIsRefreshing(false);
    toast({
      title: "Session refresh failed",
      description: error.message || "Please log in again.",
      variant: "destructive",
    });
  }, [toast]);

  const {
    session,
    isLoading: isSessionLoading,
    isExpiring,
    timeUntilExpiry,
    refreshSession,
    signOut,
  } = useSessionManager({
    warningThreshold: 300, // 5 minutes
    onSessionExpiring: handleSessionExpiring,
    onSessionExpired: handleSessionExpired,
    onSessionRefreshed: handleSessionRefreshed,
    onRefreshError: handleRefreshError,
  });

  // ============================================================================
  // Redirect if no session
  // ============================================================================

  useEffect(() => {
    if (!isSessionLoading && !session && !isImpersonating) {
      navigate("/client-login");
    }
  }, [isSessionLoading, session, isImpersonating, navigate]);

  // ============================================================================
  // Session Refresh Handler
  // ============================================================================

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    await refreshSession();
  };

  const handleDismissExpiryBanner = () => {
    setShowExpiryBanner(false);
  };

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

        const { data: isAdminUser } = await proxyRpc<boolean>("has_role", {
          _user_id: currentUserId,
          _role: "admin",
        });

        if (isAdminUser) {
          // Admin impersonating: load ALL organizations for switching
          const { data: allOrgs, error: orgError } = await proxyQuery<Array<{id: string; name: string; logo_url: string | null}>>({
            table: "client_organizations",
            select: "id, name, logo_url",
            filters: { is_active: true },
          });

          if (orgError) throw orgError;

          if (allOrgs && allOrgs.length > 0) {
            // Sort by name client-side since proxy doesn't support order
            const sortedOrgs = [...allOrgs].sort((a, b) => a.name.localeCompare(b.name));
            const orgs: Organization[] = sortedOrgs.map((org) => ({
              id: org.id,
              name: org.name,
              logo_url: org.logo_url,
              role: "admin",
            }));

            setOrganizations(orgs);
            // Set the impersonated org as selected
            const selectedOrg = orgs.find((o) => o.id === impersonatedOrgId) || orgs[0];
            setOrganization(selectedOrg);
            setIsLoadingOrgs(false);
            return;
          }
        } else {
          // Non-admin impersonating (fallback): load only the impersonated org
          const { data: org, error: orgError } = await proxyQuery<{id: string; name: string; logo_url: string | null}>({
            table: "client_organizations",
            select: "id, name, logo_url",
            filters: { id: impersonatedOrgId },
            single: true,
          });

          if (orgError) throw orgError;
          if (org) {
            setOrganization(org);
            setOrganizations([org]);
          }
          setIsLoadingOrgs(false);
          return;
        }
      }

      // Check if user is admin
      const { data: isAdminUser } = await proxyRpc<boolean>("has_role", {
        _user_id: session?.user?.id,
        _role: "admin",
      });

      if (isAdminUser) {
        // Admin: load all organizations
        const { data: allOrgs, error: orgError } = await proxyQuery<Array<{id: string; name: string; logo_url: string | null}>>({
          table: "client_organizations",
          select: "id, name, logo_url",
          filters: { is_active: true },
        });

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

        // Sort by name client-side since proxy doesn't support order
        const sortedOrgs = [...allOrgs].sort((a, b) => a.name.localeCompare(b.name));
        const orgs: Organization[] = sortedOrgs.map((org) => ({
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
        // Regular client user: load their organization via client_users
        // Note: proxy doesn't support joins, so we do two queries
        const { data: clientUserData, error: userError } = await proxyQuery<{organization_id: string; role: string}>({
          table: "client_users",
          select: "organization_id, role",
          filters: { id: session?.user?.id },
          single: true,
        });

        if (userError) throw userError;
        if (!clientUserData) {
          console.error("No client_users record found for user:", session?.user?.id);
          navigate("/access-denied?from=client");
          return;
        }

        // Now fetch the organization details
        const { data: orgData, error: orgError } = await proxyQuery<{id: string; name: string; logo_url: string | null}>({
          table: "client_organizations",
          select: "id, name, logo_url",
          filters: { id: clientUserData.organization_id },
          single: true,
        });

        if (orgError) throw orgError;
        if (!orgData) {
          console.error("Organization not found:", clientUserData.organization_id);
          navigate("/access-denied?from=client");
          return;
        }

        const org: Organization = {
          id: orgData.id,
          name: orgData.name,
          logo_url: orgData.logo_url,
          role: clientUserData.role,
        };

        setOrganizations([org]);
        setOrganization(org);
      }
    } catch (error: any) {
      console.error("Error loading organizations:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load organizations",
        variant: "destructive",
      });
      // Don't redirect on error - stay on loading state and let user retry
      // This prevents redirect loops when there's a temporary network issue
    } finally {
      setIsLoadingOrgs(false);
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
    await signOut();
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

  // Combined loading state
  const isLoading = isSessionLoading || isLoadingOrgs;

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
            {/* Session Expiry Banner */}
            <AnimatePresence>
              {showExpiryBanner && isExpiring && (
                <SessionExpiryBanner
                  timeUntilExpiry={timeUntilExpiry}
                  isRefreshing={isRefreshing}
                  onRefresh={handleRefreshSession}
                  onDismiss={handleDismissExpiryBanner}
                />
              )}
            </AnimatePresence>

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
