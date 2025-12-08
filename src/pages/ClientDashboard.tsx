import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ChevronDown, ChevronUp, BarChart3, Sun, Moon, Brain } from "lucide-react";
import { format, subDays } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardMetrics } from "@/components/client/ClientDashboardMetrics";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { PortalSectionHeader } from "@/components/portal/PortalSectionHeader";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { OrganizationSelector } from "@/components/client/OrganizationSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Lazy load Advanced Analytics and Donor Intelligence for performance
const AdvancedAnalytics = lazy(() => import("@/components/analytics/AdvancedAnalytics"));
const DonorIntelligence = lazy(() => import("@/components/client/DonorIntelligence"));

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

const AdvancedAnalyticsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Skeleton className="h-96 w-full" />
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
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const loadUserOrganizations = async () => {
    try {
      // Check if user is admin FIRST - admins get access to ALL organizations
      const { data: isAdminUser } = await supabase.rpc("has_role", {
        _user_id: session?.user?.id,
        _role: "admin",
      });

      if (isAdminUser) {
        // Admin gets access to ALL organizations
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
        // Non-admin: check client_users table
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

  if (isLoading || !organization) {
    return (
      <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'hsl(var(--portal-accent-blue))' }} />
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
          {/* Clean Modern Header */}
          <header className="portal-header-clean">
            <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Sidebar Trigger + Organization */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <SidebarTrigger className="portal-icon-btn shrink-0" />
                  
                  {organization.logo_url && (
                    <img
                      src={organization.logo_url}
                      alt={organization.name}
                      className="h-8 sm:h-10 w-auto object-contain shrink-0"
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
                          aria-label="Logout"
                        >
                          <LogOut className="h-[18px] w-[18px]" />
                        </button>
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
              {/* AT A GLANCE: Performance Overview */}
              <div className="mb-6 md:mb-8">
                <PortalSectionHeader
                  title="Performance Overview"
                  subtitle="Key performance indicators"
                >
                  <DateRangeSelector
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={handleDateChange}
                  />
                </PortalSectionHeader>
                <ClientDashboardMetrics
                  organizationId={organization.id}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>

              {/* DEEP DIVE: Channel Details - Expandable Sections */}
              <div className="mb-6">
                <PortalSectionHeader
                  title="Channel Details"
                  subtitle="Expand for detailed channel insights"
                />
                <ConsolidatedChannelMetrics
                  organizationId={organization.id}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>

              {/* DONOR INTELLIGENCE: Attribution, Segments, Topics */}
              <div className="mb-6">
                <Collapsible open={showDonorIntelligence} onOpenChange={setShowDonorIntelligence}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border transition-colors bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-green) / 0.1)' }}>
                          <Brain className="h-5 w-5" style={{ color: 'hsl(var(--portal-accent-green))' }} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold portal-text-primary">Donor Intelligence</h3>
                          <p className="text-sm portal-text-secondary">Attribution, creative topics, donor segments & RFM scoring</p>
                        </div>
                      </div>
                      {showDonorIntelligence ? (
                        <ChevronUp className="h-5 w-5 portal-text-secondary" />
                      ) : (
                        <ChevronDown className="h-5 w-5 portal-text-secondary" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <Suspense fallback={<AdvancedAnalyticsSkeleton />}>
                      <DonorIntelligence
                        organizationId={organization.id}
                        startDate={startDate}
                        endDate={endDate}
                      />
                    </Suspense>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* ADVANCED: Attribution, Forecasting, LTV/CAC */}
              <div className="mb-6">
                <Collapsible open={showAdvancedAnalytics} onOpenChange={setShowAdvancedAnalytics}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border transition-colors bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-purple) / 0.1)' }}>
                          <BarChart3 className="h-5 w-5" style={{ color: 'hsl(var(--portal-accent-purple))' }} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold portal-text-primary">Advanced Analytics</h3>
                          <p className="text-sm portal-text-secondary">Attribution models, LTV/CAC, forecasting & comparisons</p>
                        </div>
                      </div>
                      {showAdvancedAnalytics ? (
                        <ChevronUp className="h-5 w-5 portal-text-secondary" />
                      ) : (
                        <ChevronDown className="h-5 w-5 portal-text-secondary" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <Suspense fallback={<AdvancedAnalyticsSkeleton />}>
                      <AdvancedAnalytics
                        organizationId={organization.id}
                        startDate={startDate}
                        endDate={endDate}
                      />
                    </Suspense>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Sync Controls - Compact Footer */}
              <div className="mt-8">
                <SyncControls 
                  organizationId={organization.id} 
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
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
