import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
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
import { DashboardHome } from "@/components/DashboardHome";
import { NewsFeed } from "@/components/news/NewsFeed";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveRegionProvider } from "@/components/accessibility";

type ContactSubmission = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  campaign: string | null;
  organization_type: string | null;
  message: string;
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
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<ContactSubmission[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Load active tab from localStorage on mount, default to "analytics"
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = localStorage.getItem('admin-active-tab');
    return savedTab || "analytics";
  });

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

  const checkAdminStatus = async () => {
    if (!session?.user?.id) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (error || !data) {
        navigate('/');
        return;
      }

      setIsAdmin(true);
      fetchSubmissions();
    } catch (error) {
      navigate('/');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading your dashboard...</p>
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
        return <DashboardHome />;
      case "daily-briefing":
        return <DailyBriefing />;
      case "critical-alerts":
        return <CriticalAlerts />;
      case "executive-orders":
        return <ExecutiveOrders />;
      case "state-actions":
        return <StateActions />;
      case "news":
        return <NewsFeed />;
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
      case "client-users":
        return <ClientUserManager />;
      case "api-credentials":
        return <APICredentialsManager />;
      case "attribution":
        return <CampaignAttributionManager />;
      case "scheduler":
        return <SyncScheduler />;
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
      default:
        return <AnalyticsDashboard />;
    }
  };

  return (
    <LiveRegionProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
        <div className="min-h-screen flex w-full bg-background">
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile-optimized header with breadcrumb */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex flex-col">
                <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
                  {/* Mobile menu trigger - always visible */}
                  <SidebarTrigger className="h-11 w-11" aria-label="Toggle sidebar navigation" />

                  {/* Title - responsive sizing */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight truncate">
                      Admin Dashboard
                    </h1>
                    {/* Mobile breadcrumb - shows current section */}
                    {isMobile && (
                      <p className="text-xs text-muted-foreground truncate" aria-live="polite">
                        {getCurrentSectionTitle()}
                      </p>
                    )}
                  </div>

                  {/* Actions - responsive */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <ThemeToggle />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="gap-2 min-h-[44px] min-w-[44px] hover:text-destructive"
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
              className="flex-1 overflow-auto"
              role="main"
              aria-label={`${getCurrentSectionTitle()} content`}
              tabIndex={-1}
            >
              <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </LiveRegionProvider>
  );
};

export default Admin;
