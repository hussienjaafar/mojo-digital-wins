import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, LayoutGrid, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardMetrics } from "@/components/client/ClientDashboardMetrics";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { OrganizationSelector } from "@/components/client/OrganizationSelector";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load Advanced Analytics for performance
const AdvancedAnalytics = lazy(() => import("@/components/analytics/AdvancedAnalytics"));

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
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
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
      // Fetch all organizations the user has access to
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
        toast({
          title: "Error",
          description: "You don't have access to a client organization",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Map to organization format with role
      const orgs: Organization[] = clientUserData.map((item: any) => ({
        id: item.client_organizations.id,
        name: item.client_organizations.name,
        logo_url: item.client_organizations.logo_url,
        role: item.role,
      }));
      
      setOrganizations(orgs);

      // Check for saved organization preference
      const savedOrgId = localStorage.getItem('selectedOrganizationId');
      const savedOrg = orgs.find(org => org.id === savedOrgId);
      
      // Use saved org or default to first
      setOrganization(savedOrg || orgs[0]);
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
          {/* Modern Header - Portal Style */}
          <header className="portal-header">
          <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              {/* Sidebar Trigger + Logo and Title Section */}
              <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
                <SidebarTrigger className="shrink-0" />
                
                {organization.logo_url && (
                  <div className="shrink-0">
                    <img
                      src={organization.logo_url}
                      alt={organization.name}
                      className="h-10 sm:h-12 md:h-14 w-auto object-contain"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight portal-text-primary truncate">
                      {organization.name}
                    </h1>
                    {/* Multi-org selector */}
                    {organizations.length > 1 && (
                      <OrganizationSelector
                        organizations={organizations}
                        selectedId={organization.id}
                        onSelect={handleOrganizationChange}
                      />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm portal-text-secondary mt-0.5 sm:mt-1 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(var(--portal-success))' }} />
                    Live Dashboard
                  </p>
                </div>
              </div>

              {/* Action Buttons - Enhanced with Smooth Variant */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                <RoleSwitcher />
                <Button
                  variant="smooth"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => navigate('/client/dashboard/custom')}
                  className="gap-2 min-h-[44px] min-w-[44px] transition-all duration-300 hover:scale-105 active:scale-95"
                  title="Customize Dashboard"
                  aria-label="Customize Dashboard"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden md:inline">Customize</span>
                </Button>
                <ThemeToggle />
                <Button
                  variant="smooth"
                  size={isMobile ? "sm" : "default"}
                  onClick={handleLogout}
                  className="hover:border-destructive/50 hover:text-destructive gap-2 min-h-[44px] min-w-[44px] transition-all duration-300 hover:scale-105 active:scale-95"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="portal-scrollbar flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 w-full">
            <PortalErrorBoundary>
              {/* AT A GLANCE: Performance Overview */}
              <div className="mb-6 md:mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold portal-text-primary">Performance Overview</h2>
                    <p className="text-sm portal-text-secondary mt-1">Key performance indicators</p>
                  </div>
                  {/* Inline Date Range - Compact */}
                  <div className="flex items-center gap-2">
                    <DateRangeSelector
                      startDate={startDate}
                      endDate={endDate}
                      onDateChange={handleDateChange}
                    />
                  </div>
                </div>
                <ClientDashboardMetrics
                  organizationId={organization.id}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>

              {/* DEEP DIVE: Channel Details - Expandable Sections */}
              <div className="mb-6">
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold portal-text-primary">Channel Details</h2>
                  <p className="text-sm portal-text-secondary mt-1">Expand for detailed channel insights</p>
                </div>
                <ConsolidatedChannelMetrics
                  organizationId={organization.id}
                  startDate={startDate}
                  endDate={endDate}
                />
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
                <SyncControls organizationId={organization.id} />
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
