import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, TrendingUp, DollarSign, Users, Target, Calendar, LayoutGrid } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Modern Header with Glassmorphism - Mobile Optimized */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            {/* Logo and Title Section - Mobile Responsive */}
            <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
              {organization.logo_url && (
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    className="relative h-10 sm:h-12 md:h-16 w-auto object-contain"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent truncate">
                  {organization.name}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Campaign Dashboard
                </p>
              </div>
            </div>

            {/* Action Buttons - Enhanced with Smooth Variant */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="smooth"
                size={isMobile ? "sm" : "default"}
                onClick={() => navigate('/client/dashboard/custom')}
                className="gap-2 min-h-[44px] min-w-[44px]"
                title="Customize Dashboard"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden md:inline">Customize</span>
              </Button>
              <ThemeToggle />
              <Button
                variant="smooth"
                size={isMobile ? "sm" : "default"}
                onClick={handleLogout}
                className="hover:border-destructive/50 hover:text-destructive gap-2 min-h-[44px] min-w-[44px]"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Date Range Controls - Enhanced with Smooth Variant */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <Card variant="smooth" className="animate-fade-in-down">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-4 sm:gap-6">
                {/* Title Section */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-primary/10 rounded-xl shrink-0">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">Campaign Performance</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                      Track your metrics and ROI in real-time
                    </p>
                  </div>
                </div>
                {/* Date Range Selector */}
                <div className="w-full">
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

        {/* Modern Tabs with Better Styling - Mobile Optimized */}
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6 md:space-y-8">
          {/* Scrollable tabs on mobile */}
          <div className="relative -mx-3 sm:mx-0">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent px-3 sm:px-0">
              <TabsList className="bg-card/50 backdrop-blur border border-border/50 p-1 sm:p-1.5 h-auto gap-1 sm:gap-2 inline-flex w-auto min-w-full sm:min-w-0">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <TrendingUp className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger
                  value="meta"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <Target className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Meta Ads</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sms"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <Users className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">SMS Campaigns</span>
                </TabsTrigger>
                <TabsTrigger
                  value="donations"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <DollarSign className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Donations</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview">
            <ClientMetricsOverview 
              organizationId={organization.id} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </TabsContent>

          <TabsContent value="meta">
            <MetaAdsMetrics 
              organizationId={organization.id} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </TabsContent>

          <TabsContent value="sms">
            <SMSMetrics 
              organizationId={organization.id} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </TabsContent>

          <TabsContent value="donations">
            <DonationMetrics 
              organizationId={organization.id} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClientDashboard;
