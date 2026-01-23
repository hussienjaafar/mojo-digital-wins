import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserManagement } from "@/components/UserManagement";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { EnhancedContactManagement } from "@/components/EnhancedContactManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AdminInviteCodes } from "@/components/AdminInviteCodes";
import { BlogGenerator } from "@/components/BlogGenerator";
import { AuditLogs } from "@/components/AuditLogs";
import { SessionManagement } from "@/components/SessionManagement";
import ClientOrganizationManager from "@/components/admin/ClientOrganizationManager";
import ClientUserManager from "@/components/admin/ClientUserManager";
import APICredentialsManager from "@/components/admin/APICredentialsManager";
import CampaignAttributionManager from "@/components/admin/CampaignAttributionManager";
import SyncScheduler from "@/components/admin/SyncScheduler";
import EmailReportManager from "@/components/admin/EmailReportManager";
import { DataBackfillPanel } from "@/components/admin/DataBackfillPanel";
import { BackfillMonitorPanel } from "@/components/admin/BackfillMonitorPanel";
import { OnboardingBackfillPanel } from "@/components/admin/OnboardingBackfillPanel";
import AdminActivityAlerts from "@/components/admin/AdminActivityAlerts";
import UsageAnalytics from "@/components/admin/UsageAnalytics";
import ClientHealthOverview from "@/components/admin/ClientHealthOverview";
import { AdminDashboardHome } from "@/components/admin/AdminDashboardHome";
import { NewsTrendsPage } from "@/pages/admin/NewsTrendsPage";
import { BillTracker } from "@/components/bills/BillTracker";
import Analytics from "@/pages/Analytics";
import Bookmarks from "@/pages/Bookmarks";
import { CriticalAlerts } from "@/components/alerts/CriticalAlerts";
import { ExecutiveOrders } from "@/components/alerts/ExecutiveOrders";
import { StateActions } from "@/components/alerts/StateActions";
import { DailyBriefing } from "@/components/alerts/DailyBriefing";
import { AlertSettings } from "@/components/alerts/AlertSettings";
import { ReportHistory } from "@/components/reports/ReportHistory";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar, navigationGroups } from "@/components/AdminSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveRegionProvider } from "@/components/accessibility";
import { NewsFilterProvider, useNewsFilters } from "@/contexts/NewsFilterContext";
import OpsPanel from "@/components/admin/OpsPanel";
import { PortalErrorBoundary } from "@/components/portal/PortalErrorBoundary";
import { CoverageGovernancePanel } from "@/components/admin/v3";
import { OnboardingWizard } from "@/components/admin/onboarding/OnboardingWizard";
import { IntegrationCenter } from "@/components/admin/integrations/IntegrationCenter";
import { AuditActivityCenter } from "@/components/admin/audit/AuditActivityCenter";
import { BulkOperations } from "@/components/admin/bulk/BulkOperations";
import { EnvironmentBanner } from "@/components/admin/EnvironmentBanner";
import { RedirectLinkAnalytics } from "@/components/analytics/RedirectLinkAnalytics";

type ContactSubmission = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  campaign: string | null;
  organization_type: string | null;
  message: string;
};

// Inner component that uses the NewsFilterContext
const AdminContent = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { setNavigateToTab } = useNewsFilters();

  // Set up the navigation function when component mounts
  useEffect(() => {
    setNavigateToTab((tab: 'feed' | 'analytics') => {
      if (tab === 'feed') {
        setActiveTab('news');
      } else if (tab === 'analytics') {
        setActiveTab('content-analytics');
      }
    });

    // Cleanup on unmount
    return () => setNavigateToTab(null);
  }, [setActiveTab, setNavigateToTab]);

  return null; // This component only sets up the navigation
};

const Admin = () => {
  const isMobile = useIsMobile();

  // Load sidebar state from localStorage, default to closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    // On mobile, default to closed
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false;
    }
    // On desktop, use saved state or default to true
    const saved = localStorage.getItem('admin-sidebar-open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save sidebar state to localStorage whenever it changes
  const handleSidebarChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('admin-sidebar-open', JSON.stringify(open));
  };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<ContactSubmission[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Load active tab from URL params first, then localStorage, default to "analytics"
  const [activeTab, setActiveTab] = useState<string>(() => {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab) return urlTab;
    const savedTab = localStorage.getItem('admin-active-tab');
    return savedTab || "analytics";
  });

  // Sync URL tab param with activeTab
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('admin-active-tab', activeTab);
  }, [activeTab]);

  // Get current section title for breadcrumb
  const getCurrentSectionTitle = () => {
    for (const group of navigationGroups) {
      const item = group.items.find(i => i.value === activeTab);
      if (item) return item.title;
    }
    return "Dashboard";
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      checkAdminStatus();
    }
  }, [session]);

  const checkAdminStatus = async (retryCount = 0) => {
    if (!session?.user?.id) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      // Handle transient database errors with retry
      if (error) {
        console.error('Admin check error:', error);
        // Retry on 503/timeout errors (up to 3 times)
        if ((error.message?.includes('503') || error.code === 'PGRST002') && retryCount < 3) {
          console.log(`Retrying admin check (attempt ${retryCount + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return checkAdminStatus(retryCount + 1);
        }
        navigate('/access-denied?from=admin');
        return;
      }

      if (!data) {
        navigate('/access-denied?from=admin');
        return;
      }

      setIsAdmin(true);
      fetchSubmissions();
    } catch (error) {
      console.error('Admin check exception:', error);
      // Retry on network errors
      if (retryCount < 3) {
        console.log(`Retrying admin check after exception (attempt ${retryCount + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return checkAdminStatus(retryCount + 1);
      }
      navigate('/access-denied?from=admin');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
      setFilteredSubmissions(data || []);
    } catch (error) {
      toast.error("Failed to load submissions");
    }
  };

  useEffect(() => {
    let filtered = submissions;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.campaign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== "all") {
      if (typeFilter === "newsletter") {
        filtered = filtered.filter(sub => sub.message === "Newsletter subscription");
      } else if (typeFilter === "contact") {
        filtered = filtered.filter(sub => sub.message !== "Newsletter subscription");
      }
    }

    setFilteredSubmissions(filtered);
  }, [searchTerm, typeFilter, submissions]);

  const exportToCSV = () => {
    const headers = ["Date", "Name", "Email", "Campaign", "Type", "Message"];
    const csvData = filteredSubmissions.map(sub => [
      new Date(sub.created_at).toLocaleDateString(),
      sub.name,
      sub.email,
      sub.campaign || "N/A",
      sub.organization_type || "N/A",
      sub.message.replace(/,/g, ";") // Replace commas to avoid CSV issues
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Data exported to CSV");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'hsl(var(--portal-accent-blue))' }} />
          <p className="portal-text-secondary font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const newsletterCount = submissions.filter(s => s.message === "Newsletter subscription").length;
  const contactCount = submissions.filter(s => s.message !== "Newsletter subscription").length;

  const renderContent = () => {
    switch (activeTab) {
      case "analytics":
        return <AdminDashboardHome />;
      case "daily-briefing":
        return <DailyBriefing />;
      case "critical-alerts":
        return <CriticalAlerts />;
      case "executive-orders":
        return <ExecutiveOrders />;
      case "state-actions":
        return <StateActions />;
      case "news":
        return <NewsTrendsPage />;
      case "bills":
        return <BillTracker />;
      case "content-analytics":
        return <Analytics />;
      case "bookmarks":
        return <Bookmarks />;
      case "reports":
        return <ReportHistory />;
      case "alert-settings":
        return <AlertSettings />;
      case "clients":
        return <ClientOrganizationManager />;
      case "onboarding-wizard":
        return <OnboardingWizard />;
      case "client-users":
        return <ClientUserManager />;
      case "bulk-ops":
        return <BulkOperations />;
      case "integration-center":
        return <IntegrationCenter />;
      case "audit-activity":
        return <AuditActivityCenter />;
      case "attribution":
        return <CampaignAttributionManager />;
      case "scheduler":
        return (
          <div className="space-y-6">
            <BackfillMonitorPanel />
            <OnboardingBackfillPanel />
            <DataBackfillPanel />
            <OpsPanel />
            <SyncScheduler />
          </div>
        );
      case "users":
        return <UserManagement />;
      case "contacts":
        return <EnhancedContactManagement />;
      case "newsletter":
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Newsletter Subscribers</CardTitle>
                    <CardDescription>
                      Manage email newsletter subscriptions
                    </CardDescription>
                  </div>
                  <Button onClick={exportToCSV}>
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Newsletter subscriber management coming soon...
                </p>
              </CardContent>
            </Card>
          </div>
        );
      case "invite-codes":
        return <AdminInviteCodes />;
      case "blog-generator":
        return <BlogGenerator />;
      case "audit-logs":
        return <AuditLogs />;
      case "sessions":
        return <SessionManagement />;
      case "email-reports":
        return <EmailReportManager />;
      case "activity-alerts":
        return <AdminActivityAlerts />;
      case "usage-analytics":
        return <UsageAnalytics />;
      case "client-health":
        return <ClientHealthOverview />;
      case "redirect-clicks":
        return <RedirectLinkAnalytics title="Redirect Link Click Analytics" />;
      case "coverage-governance":
        return <CoverageGovernancePanel />;
      default:
        return <AnalyticsDashboard />;
    }
  };

  return (
    <LiveRegionProvider>
      <NewsFilterProvider>
        <AdminContent setActiveTab={setActiveTab} />
        <PortalErrorBoundary>
          <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
            <div className="portal-theme min-h-screen flex w-full portal-bg">
              <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

              <div className="flex-1 flex flex-col min-w-0">
                {/* Environment indicator for non-production */}
                <EnvironmentBanner 
                  environment={import.meta.env.MODE === "production" ? "production" : "development"} 
                />
                {/* Mobile-optimized header with breadcrumb */}
                <header className="portal-header">
              <div className="flex flex-col">
                <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
                  {/* Mobile menu trigger - always visible */}
                  <SidebarTrigger className="h-11 w-11" aria-label="Toggle sidebar navigation" />

                  {/* Title - responsive sizing */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight truncate portal-text-primary">
                      Admin Dashboard
                    </h1>
                    {/* Mobile breadcrumb - shows current section */}
                    {isMobile && (
                      <p className="text-xs portal-text-secondary truncate" aria-live="polite">
                        {getCurrentSectionTitle()}
                      </p>
                    )}
                  </div>

              {/* Actions - responsive */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <RoleSwitcher />
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2 min-h-[44px] min-w-[44px] hover:text-destructive transition-all duration-300"
                  title="Sign Out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
                </div>
              </div>
            </header>

            {/* Main content - mobile optimized padding */}
            <main
              id="main-content"
              className="flex-1 overflow-auto portal-scrollbar"
              role="main"
              aria-label={`${getCurrentSectionTitle()} content`}
              tabIndex={-1}
            >
              <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
                <PortalErrorBoundary>
                  <div className="portal-animate-fade-in">
                    {renderContent()}
                  </div>
                </PortalErrorBoundary>
              </div>
            </main>
          </div>
        </div>
        </SidebarProvider>
        </PortalErrorBoundary>
      </NewsFilterProvider>
    </LiveRegionProvider>
  );
};

export default Admin;
