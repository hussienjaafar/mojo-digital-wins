import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, LayoutGrid } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/client/AppSidebar";
import { IntelligenceHubRedesigned } from "@/components/client/IntelligenceHubRedesigned";
import { OnboardingWizard } from "@/components/client/OnboardingWizard";
import { ClientDashboardMetrics } from "@/components/client/ClientDashboardMetrics";
import { ConsolidatedChannelMetrics } from "@/components/client/ConsolidatedChannelMetrics";
import SyncControls from "@/components/client/SyncControls";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
      loadUserOrganization();
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
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight portal-text-primary truncate">
                    {organization.name}
                  </h1>
                  <p className="text-xs sm:text-sm portal-text-secondary mt-0.5 sm:mt-1 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(var(--portal-success))' }} />
                    Live Dashboard
                  </p>
                </div>
              </div>

              {/* Action Buttons - Enhanced with Smooth Variant */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
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
              {/* HERO: Intelligence Hub - MOVED TO TOP */}
              <div className="mb-8 md:mb-10">
                <IntelligenceHubRedesigned organizationId={organization.id} />
              </div>

              {/* AT A GLANCE: Campaign Snapshot */}
              <div className="mb-6 md:mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold portal-text-primary">Campaign Snapshot</h2>
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

              {/* DEEP DIVE: Campaign Performance Details - Expandable Sections */}
              <div className="mb-6">
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold portal-text-primary">Campaign Performance</h2>
                  <p className="text-sm portal-text-secondary mt-1">Expand any channel for detailed insights</p>
                </div>
                <ConsolidatedChannelMetrics
                  organizationId={organization.id}
                  startDate={startDate}
                  endDate={endDate}
                />
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
