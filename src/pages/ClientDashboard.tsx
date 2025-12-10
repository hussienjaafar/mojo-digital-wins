import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ChevronRight, BarChart3, Sun, Moon, Brain, LayoutDashboard, Layers, RefreshCw } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardMetrics } from "@/components/client/ClientDashboardMetrics";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { OrganizationSelector } from "@/components/client/OrganizationSelector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3SectionHeader,
  V3LoadingState,
  V3DateRangePicker,
} from "@/components/v3";
import { cn } from "@/lib/utils";
import { useDashboardStore, useDateRange } from "@/stores/dashboardStore";
import { Button } from "@/components/ui/button";

// Lazy load Advanced Analytics and Donor Intelligence for performance
const AdvancedAnalytics = lazy(() => import("@/components/analytics/AdvancedAnalytics"));
const DonorIntelligence = lazy(() => import("@/components/client/DonorIntelligence"));

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

// Animation variants for page sections
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

// Expand/collapse animation variants
const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.2 },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.3, delay: 0.1 },
    },
  },
};

// V3 Section Loading Skeleton
const V3SectionSkeleton = () => (
  <div className="space-y-4">
    <V3LoadingState variant="kpi-grid" />
    <V3LoadingState variant="chart" />
  </div>
);

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [showDonorIntelligence, setShowDonorIntelligence] = useState(false);
  
  // V3: Use Zustand store for global date range
  const dateRange = useDateRange();
  const triggerRefresh = useDashboardStore((s) => s.triggerRefresh);

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
      loadUserOrganizations();
      checkOnboardingStatus();
    }
  }, [session]);

  const checkOnboardingStatus = async () => {
    if (!session?.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle() as any;

    if (profile && !profile.onboarding_completed) {
      setShowOnboarding(true);
    }
  };

  const loadUserOrganizations = async () => {
    try {
      const { data: isAdminUser } = await supabase.rpc("has_role", {
        _user_id: session?.user?.id,
        _role: "admin",
      });

      if (isAdminUser) {
        const { data: allOrgs, error: orgError } = await supabase
          .from('client_organizations')
          .select('id, name, logo_url')
          .eq('is_active', true)
          .order('name');

        if (orgError) throw orgError;

        if (!allOrgs || allOrgs.length === 0) {
          toast({
            title: "No Organizations",
            description: "No client organizations exist yet",
            variant: "destructive",
          });
          navigate('/admin');
          return;
        }

        const orgs: Organization[] = allOrgs.map(org => ({
          id: org.id,
          name: org.name,
          logo_url: org.logo_url,
          role: 'admin',
        }));

        setOrganizations(orgs);
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const savedOrg = orgs.find(org => org.id === savedOrgId);
        setOrganization(savedOrg || orgs[0]);
      } else {
        const { data: clientUserData, error: userError } = await (supabase as any)
          .from('client_users')
          .select(`
            organization_id,
            role,
            client_organizations (
              id,
              name,
              logo_url
            )
          `)
          .eq('id', session?.user?.id);

        if (userError) throw userError;
        if (!clientUserData || clientUserData.length === 0) {
          navigate('/access-denied?from=client');
          return;
        }

        const orgs: Organization[] = clientUserData.map((item: any) => ({
          id: item.client_organizations.id,
          name: item.client_organizations.name,
          logo_url: item.client_organizations.logo_url,
          role: item.role,
        }));

        setOrganizations(orgs);
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const savedOrg = orgs.find(org => org.id === savedOrgId);
        setOrganization(savedOrg || orgs[0]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organizations",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrganizationChange = (newOrgId: string) => {
    const newOrg = organizations.find(org => org.id === newOrgId);
    if (newOrg) {
      setOrganization(newOrg);
      localStorage.setItem('selectedOrganizationId', newOrgId);
      toast({
        title: "Organization switched",
        description: `Now viewing ${newOrg.name}`,
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client-login');
  };

  // V3 Collapsible Section Component
  const CollapsibleSection = ({
    title,
    subtitle,
    icon: Icon,
    accent,
    isExpanded,
    onToggle,
    children,
  }: {
    title: string;
    subtitle: string;
    icon: typeof Brain;
    accent: "blue" | "green" | "purple";
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => {
    const accentColors = {
      blue: {
        bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
        text: "text-[hsl(var(--portal-accent-blue))]",
      },
      green: {
        bg: "bg-[hsl(var(--portal-success)/0.1)]",
        text: "text-[hsl(var(--portal-success))]",
      },
      purple: {
        bg: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
        text: "text-[hsl(var(--portal-accent-purple))]",
      },
    };

    return (
      <V3Card accent={accent} interactive className="overflow-hidden">
        <button
          onClick={onToggle}
          className={cn(
            "w-full px-4 sm:px-6 py-4",
            "flex items-center justify-between",
            "transition-colors duration-200",
            "hover:bg-[hsl(var(--portal-bg-elevated))]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            "focus-visible:ring-[hsl(var(--portal-accent-blue))]",
            "group"
          )}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <motion.div
              className={cn("p-2.5 rounded-lg shrink-0", accentColors[accent].bg)}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Icon
                className={cn("h-5 w-5", accentColors[accent].text)}
                aria-hidden="true"
              />
            </motion.div>
            <div className="text-left min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))] transition-colors duration-200 group-hover:text-[hsl(var(--portal-accent-blue))]">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5 truncate hidden sm:block">
                {subtitle}
              </p>
            </div>
          </div>

          <motion.div
            className={cn(
              "shrink-0 p-1.5 rounded-md transition-colors duration-200",
              isExpanded
                ? "bg-[hsl(var(--portal-accent-blue))]"
                : "bg-[hsl(var(--portal-bg-elevated))] group-hover:bg-[hsl(var(--portal-bg-tertiary))]"
            )}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4",
                isExpanded
                  ? "text-white"
                  : "text-[hsl(var(--portal-text-secondary))] group-hover:text-[hsl(var(--portal-text-primary))]"
              )}
              aria-hidden="true"
            />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-[hsl(var(--portal-border))]">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </V3Card>
    );
  };

  if (isLoading || !organization) {
    return (
      <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div
            className="w-16 h-16 border-4 border-t-transparent rounded-full mx-auto"
            style={{ borderColor: 'hsl(var(--portal-accent-blue))' }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="portal-text-secondary font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
      <SidebarProvider defaultOpen={!isMobile}>
        <div className="portal-theme min-h-screen w-full flex portal-bg">
          <AppSidebar organizationId={organization.id} />

          <div className="flex-1 flex flex-col min-w-0">
            {/* V3 Modern Header */}
            <header className="portal-header-clean">
              <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3">
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Sidebar Trigger + Organization */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <SidebarTrigger className="portal-icon-btn shrink-0" />

                    {organization.logo_url && (
                      <motion.img
                        src={organization.logo_url}
                        alt={organization.name}
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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="portal-status-dot" />
                        <span className="text-xs portal-text-muted">Live</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Icon Actions */}
                  <TooltipProvider delayDuration={300}>
                    <div className="portal-header-actions">
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

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            onClick={handleLogout}
                            className="portal-icon-btn portal-icon-btn-danger"
                            aria-label="Logout"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <LogOut className="h-[18px] w-[18px]" />
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Logout</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            </header>

            <main className="portal-scrollbar flex-1 overflow-auto">
              <div className="max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 w-full">
                <PortalErrorBoundary>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                  >
                    {/* AT A GLANCE: Performance Overview */}
                    <motion.section variants={sectionVariants}>
                      <V3SectionHeader
                        title="Performance Overview"
                        subtitle="Key performance indicators for your campaign"
                        icon={LayoutDashboard}
                        actions={
                          <div className="flex items-center gap-2">
                            <V3DateRangePicker />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={triggerRefresh}
                                  className="h-9 px-3 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))]"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Refresh data</TooltipContent>
                            </Tooltip>
                          </div>
                        }
                        className="mb-4"
                      />
                      <ClientDashboardMetrics
                        organizationId={organization.id}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </motion.section>

                    {/* DEEP DIVE: Channel Details */}
                    <motion.section variants={sectionVariants}>
                      <V3SectionHeader
                        title="Channel Details"
                        subtitle="Expand for detailed channel insights"
                        icon={Layers}
                        className="mb-4"
                      />
                      <ConsolidatedChannelMetrics
                        organizationId={organization.id}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </motion.section>

                    {/* DONOR INTELLIGENCE: Attribution, Segments, Topics */}
                    <motion.section variants={sectionVariants}>
                      <CollapsibleSection
                        title="Donor Intelligence"
                        subtitle="Attribution, creative topics, donor segments & RFM scoring"
                        icon={Brain}
                        accent="green"
                        isExpanded={showDonorIntelligence}
                        onToggle={() => setShowDonorIntelligence(!showDonorIntelligence)}
                      >
                        <Suspense fallback={<V3SectionSkeleton />}>
                          <DonorIntelligence
                            organizationId={organization.id}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                          />
                        </Suspense>
                      </CollapsibleSection>
                    </motion.section>

                    {/* ADVANCED: Attribution, Forecasting, LTV/CAC */}
                    <motion.section variants={sectionVariants}>
                      <CollapsibleSection
                        title="Advanced Analytics"
                        subtitle="Attribution models, LTV/CAC, forecasting & comparisons"
                        icon={BarChart3}
                        accent="purple"
                        isExpanded={showAdvancedAnalytics}
                        onToggle={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                      >
                        <Suspense fallback={<V3SectionSkeleton />}>
                          <AdvancedAnalytics
                            organizationId={organization.id}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                          />
                        </Suspense>
                      </CollapsibleSection>
                    </motion.section>

                    {/* Sync Controls */}
                    <motion.section variants={sectionVariants}>
                      <SyncControls
                        organizationId={organization.id}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </motion.section>
                  </motion.div>
                </PortalErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
};

export default ClientDashboard;
