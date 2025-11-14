import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, TrendingUp, DollarSign, Users, Target, Calendar, Mail, BarChart3, FileText } from "lucide-react";
import { format, subDays } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CustomizableDashboard, WidgetConfig } from "@/components/dashboard/CustomizableDashboard";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { MetricsWidget } from "@/components/dashboard/widgets/MetricsWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { ActivityWidget } from "@/components/dashboard/widgets/ActivityWidget";
import ClientMetricsOverview from "@/components/client/ClientMetricsOverview";
import MetaAdsMetrics from "@/components/client/MetaAdsMetrics";
import SMSMetrics from "@/components/client/SMSMetrics";
import DonationMetrics from "@/components/client/DonationMetrics";
import SyncControls from "@/components/client/SyncControls";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useCustomLayout, setUseCustomLayout] = useState(false);

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
        .single();

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
        .single();

      if (orgError) throw orgError;
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
          <p className="text-muted-foreground font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Define dashboard widgets
  const dashboardWidgets: WidgetConfig[] = [
    {
      id: "total-revenue",
      title: "Total Revenue",
      defaultLayout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      component: (
        <MetricsWidget
          title="Total Revenue"
          value={125000}
          change={12.5}
          prefix="$"
          icon={<DollarSign className="h-5 w-5 text-primary" />}
        />
      ),
    },
    {
      id: "total-donors",
      title: "Total Donors",
      defaultLayout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      component: (
        <MetricsWidget
          title="Total Donors"
          value={2450}
          change={8.3}
          icon={<Users className="h-5 w-5 text-primary" />}
        />
      ),
    },
    {
      id: "campaign-roi",
      title: "Campaign ROI",
      defaultLayout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      component: (
        <MetricsWidget
          title="Campaign ROI"
          value={425}
          change={15.2}
          suffix="%"
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
      ),
    },
    {
      id: "active-campaigns",
      title: "Active Campaigns",
      defaultLayout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      component: (
        <MetricsWidget
          title="Active Campaigns"
          value={12}
          icon={<Target className="h-5 w-5 text-primary" />}
        />
      ),
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      defaultLayout: { x: 0, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
      component: (
        <QuickActionsWidget
          actions={[
            {
              label: "View Full Analytics",
              icon: <BarChart3 className="h-4 w-4" />,
              onClick: () => toast({ title: "Opening analytics..." }),
              variant: "default",
            },
            {
              label: "Download Report",
              icon: <FileText className="h-4 w-4" />,
              onClick: () => toast({ title: "Generating report..." }),
              variant: "outline",
            },
            {
              label: "Contact Support",
              icon: <Mail className="h-4 w-4" />,
              onClick: () => navigate("/contact"),
              variant: "outline",
            },
          ]}
        />
      ),
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      defaultLayout: { x: 4, y: 2, w: 8, h: 3, minW: 4, minH: 2 },
      component: (
        <ActivityWidget
          activities={[
            {
              id: "1",
              title: "New donation received",
              description: "$500 from John Doe",
              timestamp: "2 hours ago",
              icon: <DollarSign className="h-4 w-4 text-green-600" />,
            },
            {
              id: "2",
              title: "Campaign updated",
              description: "Meta Ads campaign budget increased",
              timestamp: "5 hours ago",
              icon: <Target className="h-4 w-4 text-blue-600" />,
            },
            {
              id: "3",
              title: "SMS campaign sent",
              description: "5,000 messages delivered successfully",
              timestamp: "1 day ago",
              icon: <Mail className="h-4 w-4 text-purple-600" />,
            },
          ]}
        />
      ),
    },
    {
      id: "meta-ads-overview",
      title: "Meta Ads Overview",
      defaultLayout: { x: 0, y: 5, w: 12, h: 4, minW: 6, minH: 3 },
      component: (
        <DashboardWidget title="Meta Ads Performance" icon={<Target className="h-5 w-5 text-primary" />}>
          <MetaAdsMetrics 
            organizationId={organization.id} 
            startDate={startDate} 
            endDate={endDate} 
          />
        </DashboardWidget>
      ),
    },
  ];

  // Available widgets that can be added
  const availableWidgets: WidgetConfig[] = [
    {
      id: "sms-metrics",
      title: "SMS Campaign Metrics",
      defaultLayout: { x: 0, y: 9, w: 12, h: 4, minW: 6, minH: 3 },
      component: (
        <DashboardWidget title="SMS Campaigns" icon={<Mail className="h-5 w-5 text-primary" />}>
          <SMSMetrics 
            organizationId={organization.id} 
            startDate={startDate} 
            endDate={endDate} 
          />
        </DashboardWidget>
      ),
    },
    {
      id: "donation-metrics",
      title: "Donation Metrics",
      defaultLayout: { x: 0, y: 13, w: 12, h: 4, minW: 6, minH: 3 },
      component: (
        <DashboardWidget title="Donations" icon={<DollarSign className="h-5 w-5 text-primary" />}>
          <DonationMetrics 
            organizationId={organization.id} 
            startDate={startDate} 
            endDate={endDate} 
          />
        </DashboardWidget>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Modern Header with Glassmorphism */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {organization.logo_url && (
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img 
                    src={organization.logo_url} 
                    alt={organization.name}
                    className="relative h-16 w-auto object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                  {organization.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Campaign Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 lg:px-8 py-8">
        {/* Date Range Controls with Modern Design */}
        <div className="mb-8">
          <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Campaign Performance</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Track your metrics and ROI in real-time
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <DateRangeSelector
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={handleDateChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Controls */}
        <SyncControls organizationId={organization.id} />

        {/* Customizable Dashboard */}
        <CustomizableDashboard
          storageKey={`client-dashboard-${organization.id}`}
          widgets={dashboardWidgets}
          availableWidgets={availableWidgets}
        />
      </main>
    </div>
  );
};

export default ClientDashboard;
